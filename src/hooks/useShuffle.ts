/**
 * useShuffle — shuffle robusto che trova sempre un film.
 *
 * PRINCIPIO FONDAMENTALE: l'utente non deve mai vedere un errore
 * per colpa dell'algoritmo. L'errore compare SOLO se i filtri
 * manuali dell'utente rendono impossibile la query (es. attore
 * specifico + anno + genere che non esiste).
 *
 * STRATEGIA A RILASSAMENTO PROGRESSIVO:
 * Round 1-3: query con tutti i filtri del profilo (genere, qualità)
 * Round 4-5: rimuovi il filtro qualità (minImdbRating)
 * Round 6-7: rimuovi anche i generi del profilo
 * Round 8:   query completamente nuda (solo filtri manuali utente)
 * Se round 8 fallisce → errore (filtri manuali impossibili)
 *
 * Per ogni round si fetcha 4 pagine in parallelo su punti diversi
 * del catalogo, con sort order variato ogni volta.
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
];

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
): Promise<TMDBMovieBasic[]> {
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
  const params = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: sortOrder,
    page: String(Math.max(1, page)),
    'vote_count.gte': '20',
  });

  if (filters.genreIds?.length) params.set('with_genres', filters.genreIds.join(','));
  if (filters.minImdbRating) params.set('vote_average.gte', String(filters.minImdbRating));
  if (filters.withProviders?.length) {
    params.set('with_watch_providers', filters.withProviders.join('|'));
    params.set('watch_region', 'IT');
  }
  if (filters.actorIds?.length) params.set('with_cast', filters.actorIds.join(','));
  if (filters.year) {
    params.set(mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year', String(filters.year));
  } else if (filters.decade) {
    const decades: Record<string, [number, number]> = {
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],
      '1960s':[1960,1969],'1970s':[1970,1979],'1980s':[1980,1989],
      '1990s':[1990,1999],'2000s':[2000,2009],'2010s':[2010,2019],'2020s':[2020,2029],
    };
    const range = decades[filters.decade];
    if (range) {
      const k = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      params.set(`${k}.gte`, `${range[0]}-01-01`);
      params.set(`${k}.lte`, `${range[1]}-12-31`);
    }
  }
  if (filters.withAwards) params.set('with_keywords', '207317|210024');

  try {
    const res = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((m: TMDBMovieBasic) => ({
      ...m,
      media_type: mediaType as 'movie' | 'tv',
    }));
  } catch {
    return [];
  }
}

/** Controlla se esistono risultati per questi filtri (pagina 1, sort popolare) */
async function probeFilters(filters: MovieFilters): Promise<number> {
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
  const params = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: 'popularity.desc',
    page: '1',
    'vote_count.gte': '20',
  });
  if (filters.genreIds?.length) params.set('with_genres', filters.genreIds.join(','));
  if (filters.minImdbRating) params.set('vote_average.gte', String(filters.minImdbRating));
  if (filters.withProviders?.length) {
    params.set('with_watch_providers', filters.withProviders.join('|'));
    params.set('watch_region', 'IT');
  }
  if (filters.actorIds?.length) params.set('with_cast', filters.actorIds.join(','));
  if (filters.year) {
    params.set(mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year', String(filters.year));
  } else if (filters.decade) {
    const decades: Record<string, [number, number]> = {
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],
      '1960s':[1960,1969],'1970s':[1970,1979],'1980s':[1980,1989],
      '1990s':[1990,1999],'2000s':[2000,2009],'2010s':[2010,2019],'2020s':[2020,2029],
    };
    const range = decades[filters.decade];
    if (range) {
      const k = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      params.set(`${k}.gte`, `${range[0]}-01-01`);
      params.set(`${k}.lte`, `${range[1]}-12-31`);
    }
  }
  if (filters.withAwards) params.set('with_keywords', '207317|210024');
  try {
    const res = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${params}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total_pages ?? 0;
  } catch {
    return 0;
  }
}

/** Scegli 4 pagine sparse su tutto il catalogo disponibile */
function spreadPages(totalPages: number): number[] {
  const max = Math.min(totalPages, 500);
  if (max <= 4) return Array.from({ length: max }, (_, i) => i + 1);
  // Quattro punti equidistanti + offset random per varietà
  const step = Math.floor(max / 4);
  return [
    Math.max(1, Math.floor(Math.random() * step) + 1),
    Math.max(1, step + Math.floor(Math.random() * step)),
    Math.max(1, step * 2 + Math.floor(Math.random() * step)),
    Math.max(1, step * 3 + Math.floor(Math.random() * (max - step * 3))),
  ].map(p => Math.min(max, p));
}

async function tryFetch(
  filters: MovieFilters,
  totalPages: number,
  sortOrder: string,
  watchedIds: Set<number>,
  globalHistory: Set<number>,
  profile: UserProfile
): Promise<TMDBMovieBasic | null> {
  const pages = spreadPages(totalPages);

  const allResults = await Promise.allSettled(
    pages.map(p => discoverPage(filters, p, sortOrder))
  );

  const candidates: TMDBMovieBasic[] = [];
  const seen = new Set<number>();
  for (const r of allResults) {
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value) {
      if (!seen.has(m.id)) { seen.add(m.id); candidates.push(m); }
    }
  }

  // Applica filtro watchedStatus
  const valid = candidates.filter(m => {
    if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
    if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
    return true;
  });

  if (valid.length === 0) return null;

  // Pool con degradazione: prefer fresh → non-session → anything
  const notSession = valid.filter(m => !sessionSeen.has(m.id));
  const notHistory = notSession.filter(m => !globalHistory.has(m.id));
  const pool = notHistory.length > 0 ? notHistory
    : notSession.length > 0 ? notSession
    : valid;

  return scoreCandidates(pool, profile, globalHistory)
    ?? pool[Math.floor(Math.random() * pool.length)];
}

async function findCandidate(
  baseFilters: MovieFilters,
  profileFilters: MovieFilters,    // filtri del profilo (genreIds, minImdbRating dall'algoritmo)
  watchedIds: Set<number>,
  profile: UserProfile,
  lastSortIdx: number
): Promise<{ movie: TMDBMovieDetail; sortIdx: number } | { error: string }> {
  const globalHistory = new Set(getShuffleHistory());
  let sortIdx = lastSortIdx;

  /**
   * Rounds con filtri progressivamente più rilassati:
   * - round 0,1: tutti i filtri profilo (genere + qualità)
   * - round 2,3: solo genere profilo (no qualità)
   * - round 4,5: no filtri profilo, solo quelli manuali utente
   * - round 6,7: filtri manuali e stop sessione (ignora sessionSeen)
   */
  const roundFilters = [
    profileFilters,                                          // 0: tutto
    profileFilters,                                          // 1: tutto (sort diverso)
    { ...baseFilters, genreIds: profileFilters.genreIds },  // 2: genere profilo, no qualità
    { ...baseFilters, genreIds: profileFilters.genreIds },  // 3: genere profilo, no qualità
    baseFilters,                                             // 4: solo filtri manuali
    baseFilters,                                             // 5: solo filtri manuali
    baseFilters,                                             // 6: filtri manuali + ignora session
    baseFilters,                                             // 7: fallback assoluto
  ];

  for (let round = 0; round < roundFilters.length; round++) {
    sortIdx = (sortIdx + 1) % SORT_ORDERS.length;
    const sortOrder = SORT_ORDERS[sortIdx];
    const filters = roundFilters[round];

    // Scopri quante pagine ci sono per questa combinazione di filtri
    const totalPages = await probeFilters(filters);
    if (totalPages === 0) {
      // Questa combinazione di filtri non ha risultati → prova il prossimo round
      continue;
    }

    // Se siamo al round 6-7, ignora anche sessionSeen
    if (round >= 6) sessionSeen.clear();

    // Prova 2 volte con pagine diverse per questo round
    for (let attempt = 0; attempt < 2; attempt++) {
      const chosen = await tryFetch(filters, totalPages, sortOrder, watchedIds, globalHistory, profile);
      if (chosen) {
        addToShuffleHistory(chosen.id);
        sessionSeen.add(chosen.id);
        const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
        const movie = await getMovieDetail(chosen.id, mediaType);
        return { movie, sortIdx };
      }
      // Ruota sort per il secondo tentativo
      sortIdx = (sortIdx + 1) % SORT_ORDERS.length;
    }
  }

  // Tutti i round esauriti — solo i filtri MANUALI dell'utente sono impossibili
  return { error: 'Nessun film trovato. Controlla i filtri che hai impostato.' };
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
      // baseFilters = solo i filtri impostati manualmente dall'utente
      // (niente generi/qualità dal profilo)
      const userFilters = strategyResult.filters;
      const effectiveMedia: MovieFilters['mediaType'] = userFilters.mediaType === 'both'
        ? (Math.random() < 0.5 ? 'movie' : 'tv')
        : userFilters.mediaType;

      const baseFilters: MovieFilters = { ...userFilters, mediaType: effectiveMedia };

      // profileFilters = baseFilters + arricchimento profilo (genere, qualità)
      // ma SOLO se non ci sono già filtri manuali per quelle dimensioni
      const profileFilters: MovieFilters = { ...baseFilters };
      if (!baseFilters.genreIds?.length && strategyResult.filters.genreIds?.length) {
        profileFilters.genreIds = strategyResult.filters.genreIds;
      }
      if (!baseFilters.minImdbRating && profile.qualityThreshold > 5.5) {
        profileFilters.minImdbRating = profile.qualityThreshold;
      }

      const result = await findCandidate(
        baseFilters, profileFilters, watchedIds, profile, lastSortIdx.current
      );

      if ('error' in result) {
        setState({ movie: null, loading: false, error: result.error, hasSearched: true });
        return;
      }

      lastSortIdx.current = result.sortIdx;
      setState({ movie: result.movie, loading: false, error: null, hasSearched: true });

    } catch {
      setState({ movie: null, loading: false, error: 'Errore di rete.', hasSearched: true });
    }
  }, []);

  return { ...state, shuffle };
}
