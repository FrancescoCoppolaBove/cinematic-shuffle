import type { TMDBMovieBasic, TMDBMovieDetail, MovieFilters, SearchResult, TrendingItem } from '../types';
import { DECADES } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

export const getImageUrl = (path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
};

// Helper: TV shows use "name" and "first_air_date" instead of "title"/"release_date"
export function getTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || 'Titolo sconosciuto';
}
export function getReleaseDate(item: { release_date?: string; first_air_date?: string }): string {
  return item.release_date || item.first_air_date || '';
}

function getApiKey(): string {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key || key === 'la_tua_tmdb_api_key_qui') {
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

// ─── Detail ───────────────────────────────────────────────────────

export async function getMovieDetail(id: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<TMDBMovieDetail> {
  const data = await apiFetch<TMDBMovieDetail>(`/${mediaType}/${id}`, {
    append_to_response: 'credits',
  });
  return { ...data, media_type: mediaType };
}

// ─── Trending (homepage) ──────────────────────────────────────────

export async function getTrending(mediaType: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week'): Promise<TrendingItem[]> {
  const res = await apiFetch<{ results: TMDBMovieBasic[] }>(`/trending/${mediaType}/${timeWindow}`);
  return res.results.slice(0, 12).map(m => ({
    id: m.id,
    title: getTitle(m),
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    vote_average: m.vote_average,
    release_date: getReleaseDate(m),
    media_type: mediaType,
    overview: m.overview,
  }));
}

// ─── Discover ─────────────────────────────────────────────────────

interface DiscoverResponse {
  results: TMDBMovieBasic[];
  total_pages: number;
  total_results: number;
}

export async function discoverContent(filters: MovieFilters, page = 1): Promise<DiscoverResponse> {
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';
  const params: Record<string, string> = {
    page: String(page),
    'vote_count.gte': '50',
    sort_by: 'vote_count.desc',
  };

  // Anno / Decade
  const dateGteKey = mediaType === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte';
  const dateLteKey = mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte';
  const yearKey = mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year';

  if (filters.year) {
    params[yearKey] = String(filters.year);
  } else if (filters.decade) {
    const decade = DECADES.find(d => d.value === filters.decade);
    if (decade) {
      params[dateGteKey] = `${decade.start}-01-01`;
      params[dateLteKey] = `${decade.end}-12-31`;
    }
  }

  if (filters.genreIds?.length) params['with_genres'] = filters.genreIds.join(',');
  if (filters.minImdbRating) params['vote_average.gte'] = String(filters.minImdbRating);
  if (filters.actorIds?.length) params['with_cast'] = filters.actorIds.join(',');

  if (filters.directorName) {
    const id = await findPersonId(filters.directorName);
    if (id) params['with_crew'] = String(id);
  }

  return apiFetch<DiscoverResponse>(`/discover/${mediaType}`, params);
}

async function findPersonId(name: string): Promise<number | null> {
  try {
    const res = await apiFetch<{ results: { id: number }[] }>('/search/person', { query: name });
    return res.results[0]?.id ?? null;
  } catch { return null; }
}

export async function searchPersons(query: string): Promise<{ id: number; name: string; profile_path: string | null; known_for_department: string }[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ results: { id: number; name: string; profile_path: string | null; known_for_department: string }[] }>('/search/person', { query });
  return res.results.slice(0, 8);
}

export async function searchContent(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  // multi-search returns both movies and TV
  const res = await apiFetch<{ results: (TMDBMovieBasic & { media_type: 'movie' | 'tv' | 'person' })[] }>('/search/multi', { query });
  return res.results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 12)
    .map(m => ({
      id: m.id,
      title: getTitle(m),
      poster_path: m.poster_path,
      release_date: getReleaseDate(m),
      vote_average: m.vote_average,
      genre_ids: m.genre_ids || [],
      media_type: m.media_type as 'movie' | 'tv',
    }));
}

// Legacy for backward compat
export const searchMovies = searchContent;

// ─── Shuffle algorithm ────────────────────────────────────────────

const SHUFFLE_HISTORY_KEY = 'cinematic_shuffle_history';
const MAX_HISTORY = 50;

function getShuffleHistory(): number[] {
  try { return JSON.parse(localStorage.getItem(SHUFFLE_HISTORY_KEY) || '[]') as number[]; }
  catch { return []; }
}
function addToShuffleHistory(id: number) {
  const h = getShuffleHistory();
  localStorage.setItem(SHUFFLE_HISTORY_KEY, JSON.stringify([id, ...h.filter(x => x !== id)].slice(0, MAX_HISTORY)));
}
export function clearShuffleHistory() { localStorage.removeItem(SHUFFLE_HISTORY_KEY); }

function shuffleArray<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export async function getRandomContent(filters: MovieFilters, watchedIds: Set<number>): Promise<TMDBMovieDetail | null> {
  const history = getShuffleHistory();
  const first = await discoverContent(filters, 1);
  const totalPages = Math.min(first.total_pages, 50);
  if (first.total_results === 0) return null;

  const pagePool = shuffleArray(Array.from({ length: totalPages }, (_, i) => i + 1));
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';

  for (let attempt = 0; attempt < Math.min(5, totalPages); attempt++) {
    const page = pagePool[attempt];
    const response = page === 1 ? first : await discoverContent(filters, page);
    let candidates = response.results.filter(m => {
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });
    const recent = history.slice(0, 10);
    const pool = candidates.filter(m => !recent.includes(m.id));
    const chosen = (pool.length > 0 ? pool : candidates)[Math.floor(Math.random() * (pool.length > 0 ? pool : candidates).length)];
    if (chosen) {
      addToShuffleHistory(chosen.id);
      return getMovieDetail(chosen.id, mediaType);
    }
  }

  const fallback = first.results.find(m => {
    if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
    if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
    return true;
  });
  if (!fallback) return null;
  addToShuffleHistory(fallback.id);
  return getMovieDetail(fallback.id, mediaType);
}
