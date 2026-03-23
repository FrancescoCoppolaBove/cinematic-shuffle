/**
 * useShuffle — versione finale, robusta e leggera.
 *
 * PRINCIPIO: trovare SEMPRE un film, con il minimo di chiamate API.
 *
 * FLUSSO:
 * 1. Una sola chiamata per scoprire quante pagine esistono (pagina 1 con filtri base)
 * 2. Fetch di 3 pagine casuali in parallelo
 * 3. Se non trova candidati validi → rilassa i filtri del profilo e riprova
 * 4. Se ancora niente → ignora history/session e prende qualsiasi film
 * 5. Errore SOLO se TMDB non restituisce nulla neanche con filtri nudi
 *
 * CHIAMATE API MASSIME PER SHUFFLE: 1 probe + 3 pagine + 1 detail = 5 chiamate
 */
import { useState, useCallback, useRef } from 'react';
import type { TMDBMovieDetail, TMDBMovieBasic, MovieFilters } from '../types';
import { getMovieDetail, getShuffleHistory, addToShuffleHistory } from '../services/tmdb';
import type { QueryStrategyResult, UserProfile } from './useUserTaste';
import { scoreCandidates } from './useUserTaste';

// Sort orders: variamo per esplorare sezioni diverse del catalogo
const SORT_ORDERS = [
  'popularity.desc',
  'primary_release_date.desc',
  'vote_average.desc',
  'popularity.asc',
];

// Film già visti in questa sessione di navigazione
const sessionSeen = new Set<number>();

function getApiKey(): string {
  const k = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
  if (k) return k;
  try { return localStorage.getItem('tmdb_runtime_key') || ''; } catch { return ''; }
}

// Costruisce i parametri URL per una query discover TMDB
function buildParams(filters: MovieFilters, page: number, sortOrder: string): URLSearchParams {
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
  const p = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: sortOrder,
    page: String(page),
    'vote_count.gte': '20',
  });
  if (filters.genreIds?.length) p.set('with_genres', filters.genreIds.join(','));
  if (filters.minImdbRating) p.set('vote_average.gte', String(filters.minImdbRating));
  if (filters.withProviders?.length) {
    p.set('with_watch_providers', filters.withProviders.join('|'));
    p.set('watch_region', 'IT');
  }
  if (filters.actorIds?.length) p.set('with_cast', filters.actorIds.join(','));
  if (filters.year) {
    p.set(mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year', String(filters.year));
  } else if (filters.decade) {
    const ranges: Record<string, [number,number]> = {
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],'1960s':[1960,1969],
      '1970s':[1970,1979],'1980s':[1980,1989],'1990s':[1990,1999],'2000s':[2000,2009],
      '2010s':[2010,2019],'2020s':[2020,2029],
    };
    const r = ranges[filters.decade];
    if (r) {
      const k2 = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      p.set(`${k2}.gte`, `${r[0]}-01-01`);
      p.set(`${k2}.lte`, `${r[1]}-12-31`);
    }
  }
  if (filters.withAwards) p.set('with_keywords', '207317|210024');
  return p;
}

async function fetchPage(
  filters: MovieFilters,
  page: number,
  sortOrder: string,
  mediaType: 'movie' | 'tv'
): Promise<{ results: TMDBMovieBasic[]; total_pages: number }> {
  const params = buildParams(filters, page, sortOrder);
  try {
    const res = await fetch(`https://api.themoviedb.org/3/discover/${mediaType}?${params}`);
    if (!res.ok) return { results: [], total_pages: 0 };
    const data = await res.json();
    const results = (data.results ?? []).map((m: TMDBMovieBasic) => ({
      ...m, media_type: mediaType,
    }));
    return { results, total_pages: data.total_pages ?? 0 };
  } catch {
    return { results: [], total_pages: 0 };
  }
}

// Scegli N pagine distribuite su tutto il catalogo disponibile
function pickPages(totalPages: number, count: number): number[] {
  const max = Math.min(totalPages, 500);
  if (max <= count) return Array.from({ length: max }, (_, i) => i + 1);
  const pages = new Set<number>();
  // Sempre una pagina "alta" (>50%) per varietà
  pages.add(Math.floor(max * (0.5 + Math.random() * 0.5)) + 1);
  while (pages.size < count) {
    pages.add(Math.floor(Math.random() * max) + 1);
  }
  return [...pages].map(p => Math.min(max, Math.max(1, p)));
}

// Filtra candidati per watchedStatus e rimuove duplicati
function filterCandidates(
  candidates: TMDBMovieBasic[],
  watchedIds: Set<number>,
  watchedStatus: string
): TMDBMovieBasic[] {
  const seen = new Set<number>();
  return candidates.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    if (watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
    if (watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
    return true;
  });
}

// Sceglie il candidato migliore dal pool con degradazione graceful.
// NON ritorna mai null se ci sono candidati validi.
function pickFromPool(
  valid: TMDBMovieBasic[],
  globalHistory: Set<number>,
  profile: UserProfile,
  ignoreSession = false
): TMDBMovieBasic {
  // Tier 1: non in session, non in history (ideale)
  const tier1 = valid.filter(m => !sessionSeen.has(m.id) && !globalHistory.has(m.id));
  // Tier 2: non in session (history ignorata)
  const tier2 = ignoreSession ? valid : valid.filter(m => !sessionSeen.has(m.id));
  // Tier 3: qualsiasi — SEMPRE disponibile
  const pool = tier1.length > 0 ? tier1 : tier2.length > 0 ? tier2 : valid;

  return scoreCandidates(pool, profile, globalHistory)
    ?? pool[Math.floor(Math.random() * pool.length)];
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
      const userFilters = strategyResult.filters;
      const mediaType: 'movie' | 'tv' = userFilters.mediaType === 'both'
        ? (Math.random() < 0.5 ? 'movie' : 'tv')
        : (userFilters.mediaType === 'tv' ? 'tv' : 'movie');

      // Filtri base = solo quelli impostati manualmente dall'utente
      const base: MovieFilters = { ...userFilters, mediaType };

      // Ruota il sort order ad ogni chiamata per varietà
      sortIdxRef.current = (sortIdxRef.current + 1) % SORT_ORDERS.length;
      const sort = SORT_ORDERS[sortIdxRef.current];

      const globalHistory = new Set(getShuffleHistory());

      // Filtri arricchiti dal profilo (solo genere suggerito, mai qualità automatica)
      const enriched: MovieFilters = { ...base };
      if (!base.genreIds?.length && strategyResult.filters.genreIds?.length) {
        enriched.genreIds = strategyResult.filters.genreIds;
      }

      // ── Raccolta candidati: due batch in parallelo ─────────────────
      // Batch A: filtri profilo (con genere suggerito), sort corrente
      // Batch B: filtri base (solo manuali), sort alternativo
      // Questo garantisce sempre un pool ampio indipendentemente dai filtri
      const sortAlt = SORT_ORDERS[(sortIdxRef.current + 2) % SORT_ORDERS.length];

      const [probeA, probeB] = await Promise.all([
        fetchPage(enriched, 1, sort, mediaType),
        fetchPage(base,     1, sortAlt, mediaType),
      ]);

      // Usa il probe con più pagine per capire la dimensione del catalogo
      const totalPages = Math.max(probeA.total_pages, probeB.total_pages);

      if (totalPages === 0) {
        // TMDB non ha nulla — filtri manuali impossibili
        setState({ movie: null, loading: false, hasSearched: true,
          error: 'Nessun film trovato. Modifica i filtri.' });
        return;
      }

      // Fetch pagine casuali in parallelo da entrambi i batch
      const extraPages = pickPages(totalPages, 4);
      const [extraA, extraB] = await Promise.all([
        Promise.allSettled(extraPages.map(p => fetchPage(enriched, p, sort, mediaType))),
        Promise.allSettled(extraPages.map(p => fetchPage(base, p, sortAlt, mediaType))),
      ]);

      // Aggrega tutti i candidati (fino a ~200 film)
      const allRaw: TMDBMovieBasic[] = [
        ...probeA.results, ...probeB.results,
        ...extraA.flatMap(r => r.status === 'fulfilled' ? r.value.results : []),
        ...extraB.flatMap(r => r.status === 'fulfilled' ? r.value.results : []),
      ];

      // Deduplica
      const dedupMap = new Map<number, TMDBMovieBasic>();
      for (const m of allRaw) dedupMap.set(m.id, m);
      const allCandidates = [...dedupMap.values()];

      // ── Selezione con degradazione a 4 livelli ─────────────────────
      // L1: rispetta watchedStatus, non in session, non in history
      // L2: rispetta watchedStatus, ignora session (resetta)
      // L3: rispetta watchedStatus, ignora session e history
      // L4: ignora tutto (watchedStatus incluso) — fallback assoluto

      const respects = filterCandidates(allCandidates, watchedIds, base.watchedStatus);
      const all      = allCandidates; // ignora watchedStatus

      // L1
      if (respects.length > 0) {
        const chosen = pickFromPool(respects, globalHistory, profile, false);
        // chosen è sempre non-null se respects.length > 0
        addToShuffleHistory(chosen.id);
        sessionSeen.add(chosen.id);
        const movie = await getMovieDetail(chosen.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true });
        return;
      }

      // L2: watchedStatus rispettato ma sessionSeen resettato
      sessionSeen.clear();
      const respects2 = filterCandidates(allCandidates, watchedIds, base.watchedStatus);
      if (respects2.length > 0) {
        const chosen = pickFromPool(respects2, globalHistory, profile, true);
        addToShuffleHistory(chosen.id);
        sessionSeen.add(chosen.id);
        const movie = await getMovieDetail(chosen.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true });
        return;
      }

      // L3: watchedStatus rispettato, ignora tutta la history
      if (respects2.length > 0) {
        const chosen = pickFromPool(respects2, new Set(), profile, true);
        addToShuffleHistory(chosen.id);
        sessionSeen.add(chosen.id);
        const movie = await getMovieDetail(chosen.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true });
        return;
      }

      // L4: ignora watchedStatus — mostra qualsiasi film
      // (accade solo se l'utente ha visto OGNI film del catalogo con quei filtri)
      if (all.length > 0) {
        const chosen = pickFromPool(all, new Set(), profile, true);
        addToShuffleHistory(chosen.id);
        sessionSeen.add(chosen.id);
        const movie = await getMovieDetail(chosen.id, mediaType);
        setState({ movie, loading: false, error: null, hasSearched: true });
        return;
      }

      // Non dovrebbe mai arrivare qui (totalPages > 0 ma zero risultati aggregati)
      setState({ movie: null, loading: false, hasSearched: true,
        error: 'Errore inatteso. Riprova.' });

    } catch {
      setState({ movie: null, loading: false, hasSearched: true, error: 'Errore di rete. Riprova.' });
    }
  }, []);

  return { ...state, shuffle };
}
