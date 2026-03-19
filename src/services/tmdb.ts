import type { TMDBMovieBasic, TMDBMovieDetail, MovieFilters, SearchResult } from '../types';
import { DECADES } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

export const getImageUrl = (path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
};

function getApiKey(): string {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key || key === 'la_tua_api_key_qui') {
    throw new Error('API key TMDB mancante. Configura VITE_TMDB_API_KEY nel file .env');
  }
  return key;
}

async function apiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'it-IT');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { status_message?: string }).status_message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getMovieDetail(id: number): Promise<TMDBMovieDetail> {
  return apiFetch<TMDBMovieDetail>(`/movie/${id}`, {
    append_to_response: 'credits',
  });
}

interface DiscoverResponse {
  results: TMDBMovieBasic[];
  total_pages: number;
  total_results: number;
}

export async function discoverMovies(filters: MovieFilters, page: number = 1): Promise<DiscoverResponse> {
  const params: Record<string, string> = {
    page: String(page),
    'vote_count.gte': '50', // Evita film con troppi pochi voti
    sort_by: 'vote_count.desc',
  };

  // Anno specifico
  if (filters.year) {
    params['primary_release_year'] = String(filters.year);
  }

  // Decade
  if (filters.decade && !filters.year) {
    const decade = DECADES.find(d => d.value === filters.decade);
    if (decade) {
      params['primary_release_date.gte'] = `${decade.start}-01-01`;
      params['primary_release_date.lte'] = `${decade.end}-12-31`;
    }
  }

  // Generi
  if (filters.genreIds && filters.genreIds.length > 0) {
    params['with_genres'] = filters.genreIds.join(',');
  }

  // Rating minimo
  if (filters.minImdbRating) {
    params['vote_average.gte'] = String(filters.minImdbRating);
  }

  // Attori
  if (filters.actorIds && filters.actorIds.length > 0) {
    params['with_cast'] = filters.actorIds.join(',');
  }

  // Regista
  if (filters.directorName) {
    // Cerchiamo prima la person, poi usiamo l'ID
    const directorId = await findPersonId(filters.directorName, 'directing');
    if (directorId) {
      params['with_crew'] = String(directorId);
    }
  }

  return apiFetch<DiscoverResponse>('/discover/movie', params);
}

async function findPersonId(name: string, _department?: string): Promise<number | null> {
  try {
    const res = await apiFetch<{ results: { id: number; name: string; known_for_department: string }[] }>('/search/person', {
      query: name,
    });
    if (res.results.length > 0) {
      return res.results[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchPersons(query: string): Promise<{ id: number; name: string; profile_path: string | null; known_for_department: string }[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ results: { id: number; name: string; profile_path: string | null; known_for_department: string }[] }>('/search/person', {
    query,
  });
  return res.results.slice(0, 8);
}

export async function searchMovies(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ results: TMDBMovieBasic[] }>('/search/movie', {
    query,
  });
  return res.results.slice(0, 10).map(m => ({
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    release_date: m.release_date,
    vote_average: m.vote_average,
    genre_ids: m.genre_ids,
  }));
}

// ====================================================
// ALGORITMO SHUFFLE AVANZATO
// Evita ripetizioni recenti usando un pool rotante
// ====================================================

const SHUFFLE_HISTORY_KEY = 'cinematic_shuffle_history';
const MAX_HISTORY = 50; // Tiene traccia degli ultimi 50 film estratti

function getShuffleHistory(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SHUFFLE_HISTORY_KEY) || '[]') as number[];
  } catch {
    return [];
  }
}

function addToShuffleHistory(id: number): void {
  const history = getShuffleHistory();
  const updated = [id, ...history.filter(h => h !== id)].slice(0, MAX_HISTORY);
  localStorage.setItem(SHUFFLE_HISTORY_KEY, JSON.stringify(updated));
}

export function clearShuffleHistory(): void {
  localStorage.removeItem(SHUFFLE_HISTORY_KEY);
}

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getRandomMovie(
  filters: MovieFilters,
  watchedIds: Set<number>
): Promise<TMDBMovieDetail | null> {
  const history = getShuffleHistory();

  // Prima scopri quante pagine totali ci sono
  const firstPage = await discoverMovies(filters, 1);
  const totalPages = Math.min(firstPage.total_pages, 50); // TMDB limita a 500 risultati (50 pagine da 20)
  const totalResults = firstPage.total_results;

  if (totalResults === 0) return null;

  // Pool di pagine disponibili (randomizzato)
  const pagePool = shuffleArray(Array.from({ length: totalPages }, (_, i) => i + 1));

  // Proviamo fino a 5 pagine diverse
  for (let attempt = 0; attempt < Math.min(5, totalPages); attempt++) {
    const page = pagePool[attempt];
    const response = page === 1 ? firstPage : await discoverMovies(filters, page);

    // Candidati: esclude visti (se richiesto) e film visti di recente nello shuffle
    let candidates = response.results.filter(m => {
      // Filtro "già visto"
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });

    // Scoraggia (non blocca) i film visti di recente nello shuffle
    // I primi 10 della history hanno 90% di probabilità di essere esclusi
    const recentHistory = history.slice(0, 10);
    const penalizedCandidates = candidates.filter(m => !recentHistory.includes(m.id));

    // Se ci sono candidati non recenti, usali. Altrimenti usa tutti i candidati
    const pool = penalizedCandidates.length > 0 ? penalizedCandidates : candidates;

    if (pool.length > 0) {
      // Scegli un film random dal pool
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      addToShuffleHistory(chosen.id);
      return getMovieDetail(chosen.id);
    }
  }

  // Fallback: prendi un qualsiasi film dalla prima pagina ignorando la history
  const allCandidates = firstPage.results.filter(m => {
    if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
    if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
    return true;
  });

  if (allCandidates.length === 0) return null;

  const fallback = allCandidates[Math.floor(Math.random() * allCandidates.length)];
  addToShuffleHistory(fallback.id);
  return getMovieDetail(fallback.id);
}
