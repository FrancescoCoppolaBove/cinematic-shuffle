import { useState, useCallback, useRef } from 'react';
import type { TMDBMovieDetail, TMDBMovieBasic, MovieFilters } from '../types';
import { getMovieDetail, getShuffleHistory, addToShuffleHistory } from '../services/tmdb';
import type { QueryStrategyResult, UserProfile } from './useUserTaste';
import { scoreCandidates } from './useUserTaste';

const SORT_ORDERS = [
  'popularity.desc',
  'popularity.asc',
  'vote_average.desc',
  'primary_release_date.desc',
];

// Film già mostrati in questa sessione (si azzera al refresh della PWA)
const sessionSeen = new Set<number>();

function getApiKey(): string {
  const envKey = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
  if (envKey) return envKey;
  try { return localStorage.getItem('tmdb_runtime_key') || ''; } catch { return ''; }
}

async function discoverPage(
  filters: MovieFilters,
  page: number,
  sortOrder: string
): Promise<{ results: TMDBMovieBasic[]; total_pages: number }> {
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
  const params = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: sortOrder,
    page: String(page),
    'vote_count.gte': '30',
  });

  if (filters.genreIds?.length) params.set('with_genres', filters.genreIds.join(','));
  if (filters.minImdbRating) params.set('vote_average.gte', String(filters.minImdbRating));
  if (filters.withProviders?.length) {
    params.set('with_watch_providers', filters.withProviders.join('|'));
    params.set('watch_region', 'IT');
  }
  if (filters.actorIds?.length) params.set('with_cast', filters.actorIds.join(','));
  if (filters.year) {
    const key = mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year';
    params.set(key, String(filters.year));
  } else if (filters.decade) {
    const decades: Record<string, [number, number]> = {
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],
      '1960s':[1960,1969],'1970s':[1970,1979],'1980s':[1980,1989],
      '1990s':[1990,1999],'2000s':[2000,2009],'2010s':[2010,2019],'2020s':[2020,2029],
    };
    const range = decades[filters.decade];
    if (range) {
      const gKey = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      params.set(`${gKey}.gte`, `${range[0]}-01-01`);
      params.set(`${gKey}.lte`, `${range[1]}-12-31`);
    }
  }
  if (filters.withAwards) params.set('with_keywords', '207317|210024');

  const res = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    results: (data.results ?? []).map((m: TMDBMovieBasic) => ({ ...m, media_type: mediaType as 'movie' | 'tv' })),
    total_pages: data.total_pages ?? 1,
  };
}

/**
 * Tenta di trovare un film valido.
 * Fa fino a MAX_ATTEMPTS giri cambiando pagine e sort ad ogni tentativo.
 * NON mostra mai errore se ci sono risultati TMDB — insiste finché trova qualcosa.
 */
async function findCandidate(
  filters: MovieFilters,
  watchedIds: Set<number>,
  profile: UserProfile,
  lastSortIdx: number
): Promise<{ movie: TMDBMovieDetail; sortIdx: number } | { error: string }> {
  const globalHistory = new Set(getShuffleHistory());
  const MAX_ATTEMPTS = 8;

  let sortIdx = lastSortIdx;
  let totalPagesCache: number | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Cambia sort ogni tentativo (garantito diverso dall'ultimo)
    sortIdx = (sortIdx + 1 + Math.floor(Math.random() * (SORT_ORDERS.length - 1))) % SORT_ORDERS.length;
    const sortOrder = SORT_ORDERS[sortIdx];

    // Al primo tentativo scopri quante pagine ci sono
    if (totalPagesCache === null || attempt === 0) {
      try {
        const probe = await discoverPage(filters, 1, sortOrder);
        if (probe.total_pages === 0 || probe.results.length === 0) {
          return { error: 'Nessun film trovato con questi filtri. Prova ad allargarne qualcuno.' };
        }
        totalPagesCache = probe.total_pages;
      } catch {
        continue;
      }
    }

    const totalPages = totalPagesCache;

    // Scegli 4 pagine casuali sparse — mai la stessa due volte nell'attempt
    const maxPage = Math.min(totalPages, 500);
    const pagesToTry = new Set<number>();
    // Forza varietà: una pagina bassa, una media, due alte
    pagesToTry.add(Math.max(2, Math.floor(Math.random() * Math.min(20, maxPage)) + 1));
    pagesToTry.add(Math.floor(maxPage * 0.3) + Math.floor(Math.random() * 10));
    pagesToTry.add(Math.floor(maxPage * 0.6) + Math.floor(Math.random() * 10));
    pagesToTry.add(Math.floor(maxPage * 0.9) + Math.floor(Math.random() * Math.max(1, maxPage * 0.1)));
    const pages = [...pagesToTry].map(p => Math.max(1, Math.min(maxPage, p)));

    // Fetch in parallelo
    const pageResults = await Promise.allSettled(
      pages.map(p => discoverPage(filters, p, sortOrder))
    );

    // Aggrega e deduplica
    const allCandidates: TMDBMovieBasic[] = [];
    const seen = new Set<number>();
    for (const r of pageResults) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value.results) {
        if (!seen.has(m.id)) { seen.add(m.id); allCandidates.push(m); }
      }
    }

    // Applica filtro watchedStatus
    const filtered = allCandidates.filter(m => {
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });

    if (filtered.length === 0) continue; // nessun candidato valido, riprova

    // Tier di preferenza: evita history e session
    // Se history piena ignoriamo la history (ma non la session)
    const historyTooFull = globalHistory.size >= 80;
    const notInSession = filtered.filter(m => !sessionSeen.has(m.id));
    const notInHistory = notInSession.filter(m => historyTooFull || !globalHistory.has(m.id));

    // Pool finale: usa il più esclusivo possibile, ma non svuotarlo mai
    const pool = notInHistory.length > 0 ? notInHistory
      : notInSession.length > 0 ? notInSession
      : filtered; // fallback assoluto: ignora tutto, prendi qualsiasi

    // Scoreua
    const chosen = scoreCandidates(pool, profile, globalHistory);
    if (!chosen) continue;

    // Trovato! Salva e restituisci
    addToShuffleHistory(chosen.id);
    sessionSeen.add(chosen.id);

    const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
    const movie = await getMovieDetail(chosen.id, mediaType);
    return { movie, sortIdx };
  }

  // Tutti gli 8 tentativi falliti — errore genuino (filtri troppo restrittivi)
  return { error: 'Troppi filtri attivi: nessun film trovato. Prova a rimuovere qualche filtro.' };
}

export function useShuffle() {
  const [state, setState] = useState({
    movie: null as TMDBMovieDetail | null,
    loading: false,
    error: null as string | null,
    hasSearched: false,
  });

  const lastSortIdx = useRef<number>(-1);

  const shuffle = useCallback(async (
    strategyResult: QueryStrategyResult,
    watchedIds: Set<number>,
    profile: UserProfile
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const filters = strategyResult.filters;
      const effectiveFilters: MovieFilters = filters.mediaType === 'both'
        ? { ...filters, mediaType: Math.random() < 0.5 ? 'movie' : 'tv' }
        : filters;

      const result = await findCandidate(effectiveFilters, watchedIds, profile, lastSortIdx.current);

      if ('error' in result) {
        setState({ movie: null, loading: false, error: result.error, hasSearched: true });
        return;
      }

      lastSortIdx.current = result.sortIdx;
      setState({ movie: result.movie, loading: false, error: null, hasSearched: true });

    } catch (err) {
      setState({
        movie: null, loading: false,
        error: 'Errore di rete. Controlla la connessione.',
        hasSearched: true,
      });
    }
  }, []);

  return { ...state, shuffle };
}
