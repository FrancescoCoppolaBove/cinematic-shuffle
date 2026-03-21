/**
 * useShuffle — motore di shuffle con vera varietà.
 *
 * PROBLEMA PRECEDENTE: sort_by=vote_count.desc → pagina 1 sempre uguale.
 * SOLUZIONE: sort_by randomizzato tra 4 varianti + nessuna pagina "fissa".
 *
 * Strategia:
 * - Sceglie random tra 4 ordinamenti TMDB (popularity, vote_avg, date, random)
 * - Salta sempre la pagina 1 (troppo mainstream) a meno che non ci sia 1 sola pagina
 * - Fetcha 3 pagine casuali non sovrapposte
 * - Aggrega i candidati, filtra history, scoreua con profilo utente
 * - Seleziona tra i top-5 con distribuzione pesata (non sempre il primo)
 */
import { useState, useCallback, useRef } from 'react';
import type { TMDBMovieDetail, TMDBMovieBasic, MovieFilters } from '../types';
import { getMovieDetail, getShuffleHistory, addToShuffleHistory } from '../services/tmdb';
import type { QueryStrategyResult, UserProfile } from './useUserTaste';
import { scoreCandidates } from './useUserTaste';

// ── Sort orders TMDB disponibili ──────────────────────────────────
// Usiamo 4 varianti per assicurare varietà: ognuna espone una diversa
// "sezione" del catalogo TMDB. Alternando evita sempre gli stessi top film.
const SORT_ORDERS = [
  'popularity.desc',
  'popularity.asc',       // film di nicchia, meno conosciuti
  'vote_average.desc',    // film più acclamati dalla critica
  'primary_release_date.desc', // film recenti
];

// ── Session blacklist: film già mostrati in questa sessione ─────────
// Persiste tra shuffle della stessa sessione, si azzera al refresh.
const sessionSeen = new Set<number>();

async function apiFetchRaw<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getApiKey(): string {
  // Stesso meccanismo di tmdb.ts
  const envKey = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
  if (envKey) return envKey;
  try { return localStorage.getItem('tmdb_runtime_key') || ''; } catch { return ''; }
}

/**
 * Fetcha una singola pagina dal discover TMDB con sort randomizzato.
 */
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
    'vote_count.gte': '30',  // abbassato per avere più varietà
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

  const data = await apiFetchRaw<{ results: TMDBMovieBasic[]; total_pages: number }>(
    `https://api.themoviedb.org/3/discover/${mediaType}?${params}`
  );
  return {
    results: (data.results ?? []).map(m => ({ ...m, media_type: mediaType as 'movie' | 'tv' })),
    total_pages: data.total_pages ?? 1,
  };
}

/**
 * Genera N pagine casuali distinte, evitando la pagina 1 se possibile.
 * La pagina 1 ha sempre i film più "mainstream" e tende a ripetersi.
 */
function pickRandomPages(totalPages: number, count: number, avoidPage1 = true): number[] {
  const pages = new Set<number>();
  const maxPage = Math.min(totalPages, 500); // TMDB permette max 500

  // Se totalPages è piccolo, non possiamo evitare pagina 1
  const startFrom = (avoidPage1 && maxPage > 5) ? 2 : 1;

  let attempts = 0;
  while (pages.size < Math.min(count, maxPage - startFrom + 1) && attempts < 50) {
    const p = startFrom + Math.floor(Math.random() * (maxPage - startFrom + 1));
    pages.add(p);
    attempts++;
  }

  // Se non abbiamo abbastanza pagine, aggiungi pagina 1
  if (pages.size < count && !pages.has(1)) pages.add(1);

  return [...pages];
}

export function useShuffle() {
  const [state, setState] = useState({
    movie: null as TMDBMovieDetail | null,
    loading: false,
    error: null as string | null,
    hasSearched: false,
  });

  // Tiene traccia del sort usato nell'ultima chiamata per variarlo
  const lastSortIndex = useRef<number>(-1);

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

      const mediaType = effectiveFilters.mediaType === 'tv' ? 'tv' : 'movie';

      // Scegli un sort order DIVERSO dall'ultimo usato
      let sortIdx: number;
      do {
        sortIdx = Math.floor(Math.random() * SORT_ORDERS.length);
      } while (sortIdx === lastSortIndex.current && SORT_ORDERS.length > 1);
      lastSortIndex.current = sortIdx;
      const sortOrder = SORT_ORDERS[sortIdx];

      // Scopri quante pagine esistono (pagina 1 per info)
      const firstPage = await discoverPage(effectiveFilters, 1, sortOrder);
      const totalPages = firstPage.total_pages;

      if (totalPages === 0 || firstPage.results.length === 0) {
        setState({ movie: null, loading: false, error: 'Nessun risultato. Prova ad allargare i filtri.', hasSearched: true });
        return;
      }

      // Scegli 3 pagine casuali (evita pagina 1 se ci sono abbastanza pagine)
      const randomPages = pickRandomPages(totalPages, 3, totalPages > 5);

      // Fetcha tutte le pagine in parallelo per velocità
      const pageResults = await Promise.allSettled(
        randomPages.map(p => discoverPage(effectiveFilters, p, sortOrder))
      );

      // Aggrega tutti i candidati
      const globalHistory = new Set(getShuffleHistory());
      const allCandidates: TMDBMovieBasic[] = [];

      // Includi anche i risultati di pagina 1 nell'aggregazione
      for (const r of firstPage.results) {
        allCandidates.push(r);
      }
      for (const result of pageResults) {
        if (result.status === 'fulfilled') {
          allCandidates.push(...result.value.results);
        }
      }

      // Deduplicazione per id
      const seen = new Set<number>();
      const deduped = allCandidates.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      // Filtra per watchedStatus
      const filtered = deduped.filter(m => {
        if (effectiveFilters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
        if (effectiveFilters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
        return true;
      });

      // Separa in 3 tier:
      // 1. Fresh: non in history globale, non visti questa sessione
      // 2. Old: in history globale ma non questa sessione
      // 3. Session: visti questa sessione (usati solo come fallback)
      const fresh = filtered.filter(m => !globalHistory.has(m.id) && !sessionSeen.has(m.id));
      const old = filtered.filter(m => globalHistory.has(m.id) && !sessionSeen.has(m.id));
      const pool = fresh.length >= 3 ? fresh
        : fresh.length > 0 ? [...fresh, ...old]
        : old.length > 0 ? old
        : filtered; // fallback: tutto

      if (pool.length === 0) {
        // Fallback totale: pulisci session e riprova
        sessionSeen.clear();
        setState({ movie: null, loading: false, error: 'Hai visto quasi tutto! History resettata.', hasSearched: true });
        return;
      }

      // Scoreua con il profilo utente
      const chosen = scoreCandidates(pool, profile, globalHistory);
      if (!chosen) {
        setState({ movie: null, loading: false, error: 'Nessun film trovato.', hasSearched: true });
        return;
      }

      // Aggiungi a history e session
      addToShuffleHistory(chosen.id);
      sessionSeen.add(chosen.id);

      const movie = await getMovieDetail(chosen.id, mediaType);
      setState({ movie, loading: false, error: null, hasSearched: true });

    } catch (err) {
      setState({
        movie: null, loading: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
        hasSearched: true,
      });
    }
  }, []);

  return { ...state, shuffle };
}
