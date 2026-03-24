/**
 * useShuffle — implementazione definitiva, semplice e robusta.
 *
 * LOGICA:
 * - Loop di max 10 tentativi, ognuno fa UNA chiamata TMDB
 * - Ogni tentativo usa sort e pagina diversi (nessuna ripetizione)
 * - Tentativi 0-4: filtri arricchiti dal profilo (genere suggerito)
 * - Tentativi 5-9: filtri puri utente (fallback ampio)
 * - Tentativi 7-9: ignora anche watchedStatus (se utente ha visto tutto)
 * - sessionSeen si resetta automaticamente quando blocca tutti i candidati
 * - Errore solo se TMDB restituisce zero risultati dopo 10 tentativi
 */
import { useState, useCallback, useRef } from 'react';
import type { TMDBMovieDetail, TMDBMovieBasic, MovieFilters } from '../types';
import { getMovieDetail, getShuffleHistory, addToShuffleHistory } from '../services/tmdb';
import type { QueryStrategyResult, UserProfile } from './useUserTaste';
import { scoreCandidates } from './useUserTaste';

const SORT_ORDERS = [
  'popularity.desc',
  'primary_release_date.desc',
  'vote_average.desc',
  'popularity.asc',
  'revenue.desc',
];

const sessionSeen = new Set<number>();
const MAX_SESSION_SEEN = 200;

function sessionSeenAdd(id: number) {
  sessionSeen.add(id);
  if (sessionSeen.size > MAX_SESSION_SEEN) {
    const toRemove = sessionSeen.size - MAX_SESSION_SEEN;
    let removed = 0;
    for (const val of sessionSeen) {
      if (removed >= toRemove) break;
      sessionSeen.delete(val);
      removed++;
    }
  }
}

function getApiKey(): string {
  const k = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
  if (k) return k;
  try { return localStorage.getItem('tmdb_runtime_key') || ''; } catch { return ''; }
}

async function tmdbDiscover(
  mediaType: 'movie' | 'tv',
  page: number,
  sort: string,
  filters: MovieFilters
): Promise<{ results: TMDBMovieBasic[]; totalPages: number }> {
  const p = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: sort,
    page: String(page),
    'vote_count.gte': '10',
  });
  if (filters.genreIds?.length)      p.set('with_genres', filters.genreIds.join(','));
  if (filters.minImdbRating)         p.set('vote_average.gte', String(filters.minImdbRating));
  if (filters.withProviders?.length) { p.set('with_watch_providers', filters.withProviders.join('|')); p.set('watch_region', 'IT'); }
  if (filters.actorIds?.length)      p.set('with_cast', filters.actorIds.join(','));
  if (filters.withAwards)            p.set('with_keywords', '210024|155477|9748');
  if (filters.language)              p.set('with_original_language', filters.language);
  if (filters.originCountry)         p.set('with_origin_country', filters.originCountry);
  if (filters.year) {
    p.set(mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year', String(filters.year));
  } else if (filters.decade) {
    const ranges: Record<string, [number, number]> = {
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],'1960s':[1960,1969],
      '1970s':[1970,1979],'1980s':[1980,1989],'1990s':[1990,1999],'2000s':[2000,2009],
      '2010s':[2010,2019],'2020s':[2020,2029],
    };
    const r = ranges[filters.decade];
    if (r) { const k = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date'; p.set(`${k}.gte`, `${r[0]}-01-01`); p.set(`${k}.lte`, `${r[1]}-12-31`); }
  }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${p}`);
    if (!res.ok) return { results: [], totalPages: 0 };
    const data = await res.json();
    return {
      results: (data.results ?? []).map((m: TMDBMovieBasic) => ({ ...m, media_type: mediaType })),
      totalPages: Math.min(data.total_pages ?? 1, 500),
    };
  } catch {
    return { results: [], totalPages: 0 };
  }
}

export function useShuffle() {
  const [state, setState] = useState({
    movie: null as TMDBMovieDetail | null,
    loading: false,
    error: null as string | null,
    hasSearched: false,
  });

  const sortIdxRef = useRef(0);

  const shuffle = useCallback(async (
    strategyResult: QueryStrategyResult,
    watchedIds: Set<number>,
    profile: UserProfile
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const mediaType: 'movie' | 'tv' = strategyResult.baseFilters.mediaType === 'both'
        ? (Math.random() < 0.5 ? 'movie' : 'tv')
        : strategyResult.baseFilters.mediaType === 'tv' ? 'tv' : 'movie';

      // userFilters: solo ciò che l'utente ha impostato manualmente
      const userFilters: MovieFilters = { ...strategyResult.baseFilters, mediaType };
      // profileFilters: userFilters + genere suggerito dal profilo
      const profileFilters: MovieFilters = { ...strategyResult.filters, mediaType };

      const globalHistory = new Set(getShuffleHistory());
      const watchedStatus = userFilters.watchedStatus ?? 'all';

      // Scopri quante pagine esistono per i filtri puri utente
      // (una sola probe per non sprecare rate limit)
      const probe = await tmdbDiscover(mediaType, 1, 'popularity.desc', userFilters);
      if (probe.totalPages === 0) {
        setState({ movie: null, loading: false, hasSearched: true,
          error: 'Nessun film trovato. I filtri sono troppo restrittivi.' });
        return;
      }
      const totalPages = probe.totalPages;

      // Loop 10 tentativi, ognuno con sort e pagina diversi
      for (let attempt = 0; attempt < 10; attempt++) {
        sortIdxRef.current = (sortIdxRef.current + 1) % SORT_ORDERS.length;
        const sort = SORT_ORDERS[sortIdxRef.current];
        const page = Math.floor(Math.random() * totalPages) + 1;

        // Primi 5 tentativi: usa filtri profilo (con genere suggerito)
        // Ultimi 5: usa solo filtri utente (catalogo più ampio)
        const activeFilters = attempt < 5 ? profileFilters : userFilters;

        const { results } = await tmdbDiscover(mediaType, page, sort, activeFilters);
        if (results.length === 0) continue;

        // Applica watchedStatus (per i tentativi 0-6)
        // Tentativi 7-9: ignora watchedStatus (fallback se visto tutto)
        const pool = attempt < 7
          ? results.filter(m => {
              if (watchedStatus === 'unwatched') return !watchedIds.has(m.id);
              if (watchedStatus === 'watched')   return  watchedIds.has(m.id);
              return true;
            })
          : results;

        if (pool.length === 0) continue;

        // Filtra sessionSeen; se blocca tutto, resetta e riusa tutto
        const fresh = pool.filter(m => !sessionSeen.has(m.id));
        const candidates = fresh.length > 0 ? fresh : (sessionSeen.clear(), pool);

        const chosen = scoreCandidates(candidates, profile, globalHistory)
          ?? candidates[Math.floor(Math.random() * candidates.length)];

        addToShuffleHistory(chosen.id);
        sessionSeenAdd(chosen.id);
        const movie = await getMovieDetail(chosen.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true });
        return;
      }

      // 10 tentativi esauriti
      setState({ movie: null, loading: false, hasSearched: true,
        error: 'Nessun risultato. Prova a rimuovere qualche filtro.' });

    } catch {
      setState({ movie: null, loading: false, hasSearched: true,
        error: 'Errore di rete. Riprova.' });
    }
  }, []);

  return { ...state, shuffle };
}
