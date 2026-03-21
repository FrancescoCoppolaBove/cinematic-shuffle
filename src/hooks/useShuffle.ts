import { useState, useCallback } from 'react';
import type { TMDBMovieDetail } from '../types';
import type { TMDBMovieBasic } from '../types';
import { discoverContent, getMovieDetail, getShuffleHistory, addToShuffleHistory } from '../services/tmdb';
import type { QueryStrategyResult } from './useUserTaste';
import { scoreCandidates } from './useUserTaste';
import type { UserProfile } from './useUserTaste';

interface ShuffleState {
  movie: TMDBMovieDetail | null;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  lastStrategy?: string; // per debug/feedback visivo
}

/**
 * Distribuzione pesata verso pagine alte del catalogo TMDB.
 * Evita sempre le prime pagine (le stesse ogni volta).
 */
function weightedRandomPage(totalPages: number): number {
  const capped = Math.min(totalPages, 200);
  const r = Math.random();
  if (r < 0.10 || capped <= 5) return Math.floor(Math.random() * Math.min(5, capped)) + 1;
  if (r < 0.30 || capped <= 25) return Math.floor(Math.random() * Math.min(20, capped - 5)) + 6;
  if (r < 0.60 || capped <= 75) return Math.floor(Math.random() * Math.min(50, capped - 25)) + 26;
  return Math.floor(Math.random() * Math.max(1, capped - 75)) + 76;
}

/**
 * Fetcha candidati da più pagine TMDB e li scoreua con il profilo utente.
 * Restituisce il candidato migliore (non necessariamente il primo).
 */
async function fetchAndScore(
  strategyResult: QueryStrategyResult,
  watchedIds: Set<number>,
  profile: UserProfile
): Promise<{ candidate: TMDBMovieBasic; page: number } | null> {
  const { filters } = strategyResult;
  const history = getShuffleHistory();
  const recentHistory = new Set(history.slice(0, 20));

  const first = await discoverContent(filters, 1);
  if (first.total_results === 0) return null;

  const totalPages = first.total_pages;

  // Con profilo maturo, fetcha più pagine per avere più candidati da scorare
  const pagesToFetch = profile.confidence > 0.5 ? 3 : profile.confidence > 0.2 ? 2 : 1;
  const pageCandidates: number[] = [1];

  const seen = new Set([1]);
  while (pageCandidates.length < pagesToFetch + 2 && totalPages > 1) {
    const p = weightedRandomPage(totalPages);
    if (!seen.has(p)) { seen.add(p); pageCandidates.push(p); }
  }

  // Aggrega candidati da tutte le pagine
  const allCandidates: TMDBMovieBasic[] = [];

  for (const page of pageCandidates) {
    const response = page === 1 ? first : await discoverContent(filters, page);
    const valid = response.results.filter(m => {
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });
    allCandidates.push(...valid);
  }

  if (allCandidates.length === 0) return null;

  // Preferisci candidati non nella history recente
  const fresh = allCandidates.filter(m => !recentHistory.has(m.id));
  const pool = fresh.length > 0 ? fresh : allCandidates;

  // Usa lo scorer del profilo utente
  const chosen = scoreCandidates(pool, profile, recentHistory);
  if (!chosen) return null;

  return { candidate: chosen, page: 1 };
}

export function useShuffle() {
  const [state, setState] = useState<ShuffleState>({
    movie: null, loading: false, error: null, hasSearched: false,
  });

  /**
   * shuffle ora richiede il profilo utente per personalizzare.
   * ShuffleView passa il profilo da useUserTaste.
   */
  const shuffle = useCallback(async (
    strategyResult: QueryStrategyResult,
    watchedIds: Set<number>,
    profile: UserProfile
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const filters = strategyResult.filters;
      // Gestisci mediaType 'both'
      const effectiveFilters = filters.mediaType === 'both'
        ? { ...filters, mediaType: Math.random() < 0.5 ? 'movie' as const : 'tv' as const }
        : filters;

      const result = await fetchAndScore(
        { ...strategyResult, filters: effectiveFilters },
        watchedIds,
        profile
      );

      if (!result) {
        // Fallback: riprova con filtri base (senza personalizzazione)
        const fallbackResult = await fetchAndScore(
          { strategy: 'random', filters: { ...effectiveFilters, genreIds: [], minImdbRating: undefined }, label: 'fallback' },
          watchedIds,
          profile
        );
        if (!fallbackResult) {
          setState({ movie: null, loading: false, error: 'Nessun risultato. Prova ad allargare i filtri.', hasSearched: true, lastStrategy: 'fallback' });
          return;
        }
        const mediaType = effectiveFilters.mediaType === 'tv' ? 'tv' : 'movie';
        addToShuffleHistory(fallbackResult.candidate.id);
        const movie = await getMovieDetail(fallbackResult.candidate.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true, lastStrategy: 'fallback' });
        return;
      }

      const mediaType = effectiveFilters.mediaType === 'tv' ? 'tv' : 'movie';
      addToShuffleHistory(result.candidate.id);
      const movie = await getMovieDetail(result.candidate.id, mediaType);
      setState({ movie, loading: false, error: null, hasSearched: true, lastStrategy: strategyResult.strategy });

    } catch (err) {
      setState({ movie: null, loading: false, error: err instanceof Error ? err.message : 'Errore sconosciuto', hasSearched: true });
    }
  }, []);

  return { ...state, shuffle };
}
