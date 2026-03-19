import type {
  TMDBMovieBasic, TMDBMovieDetail, MovieFilters,
  SearchResult, TrendingItem,
} from '../types';
import { DECADES } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const PROVIDER_IMG = 'https://image.tmdb.org/t/p/w92';

export const getImageUrl = (
  path: string | null,
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
) => path ? `${IMG_BASE}/${size}${path}` : null;

export const getProviderLogoUrl = (path: string) => `${PROVIDER_IMG}${path}`;

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

// ─── Detail (with all append_to_response) ─────────────────────────

export async function getMovieDetail(id: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<TMDBMovieDetail> {
  const data = await apiFetch<TMDBMovieDetail>(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos,similar,recommendations,watch/providers',
    // watch/providers uses IT region by default (language param sets it)
  });
  return { ...data, media_type: mediaType };
}

// Extract best trailer (official IT first, then EN, then any)
export function getBestTrailer(movie: TMDBMovieDetail): string | null {
  const videos = movie.videos?.results ?? [];
  const trailers = videos.filter(v => v.site === 'YouTube' && v.type === 'Trailer');
  const official = trailers.find(v => v.official);
  const chosen = official ?? trailers[0] ?? videos.find(v => v.site === 'YouTube');
  return chosen ? `https://www.youtube.com/watch?v=${chosen.key}` : null;
}

// Extract IT watch providers (streaming/flatrate first)
export function getWatchProviders(movie: TMDBMovieDetail) {
  const results = movie['watch/providers']?.results ?? {};
  // Try IT, fallback to empty
  const region = results['IT'] ?? results['US'] ?? null;
  if (!region) return null;
  return {
    link: region.link ?? null,
    flatrate: region.flatrate ?? [],
    rent: region.rent ?? [],
    buy: region.buy ?? [],
    free: region.free ?? [],
    ads: region.ads ?? [],
  };
}

// ─── Trending ─────────────────────────────────────────────────────

export async function getTrending(
  mediaType: 'movie' | 'tv',
  timeWindow: 'day' | 'week' = 'week',
  limit = 12
): Promise<TrendingItem[]> {
  const res = await apiFetch<{ results: TMDBMovieBasic[] }>(
    `/trending/${mediaType}/${timeWindow}`
  );
  return res.results.slice(0, limit).map(m => ({
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

// Paginato — per la pagina "Popular this week"
export async function getTrendingPage(
  mediaType: 'movie' | 'tv',
  page = 1
): Promise<{ items: TrendingItem[]; totalPages: number }> {
  // TMDB trending endpoint doesn't support pages directly —
  // we use /discover sorted by popularity for more pages
  const params: Record<string, string> = {
    sort_by: 'popularity.desc',
    page: String(page),
    'vote_count.gte': '20',
  };
  const res = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number }>(
    `/discover/${mediaType}`,
    params
  );
  return {
    items: res.results.map(m => ({
      id: m.id,
      title: getTitle(m),
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path ?? null,
      vote_average: m.vote_average,
      release_date: getReleaseDate(m),
      media_type: mediaType,
      overview: m.overview ?? '',
    })),
    totalPages: Math.min(res.total_pages, 20), // max 400 results (20 pages × 20)
  };
}

// ─── Collection (franchise/saga) ──────────────────────────────────

export async function getCollection(collectionId: number): Promise<{
  name: string;
  parts: TMDBMovieBasic[];
}> {
  const data = await apiFetch<{ name: string; parts: TMDBMovieBasic[] }>(
    `/collection/${collectionId}`
  );
  return { name: data.name, parts: data.parts };
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
  if (filters.withProviders?.length) {
    params['with_watch_providers'] = filters.withProviders.join('|');
    params['watch_region'] = 'IT';
  }
  // Awards: TMDB keyword IDs for Oscar winner (207317) and nominee (207317 + 210024)
  if (filters.withAwards) {
    params['with_keywords'] = '207317|210024';
  }

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

export async function searchPersons(query: string): Promise<{
  id: number; name: string; profile_path: string | null; known_for_department: string
}[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{
    results: { id: number; name: string; profile_path: string | null; known_for_department: string }[]
  }>('/search/person', { query });
  return res.results.slice(0, 8);
}

export async function searchContent(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{
    results: (TMDBMovieBasic & { media_type: 'movie' | 'tv' | 'person' })[]
  }>('/search/multi', { query });
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

export const searchMovies = searchContent;

// ─── Shuffle ──────────────────────────────────────────────────────

const SHUFFLE_HISTORY_KEY = 'cinematic_shuffle_history';
const MAX_HISTORY = 50;

function getShuffleHistory(): number[] {
  try { return JSON.parse(localStorage.getItem(SHUFFLE_HISTORY_KEY) || '[]') as number[]; }
  catch { return []; }
}
function addToShuffleHistory(id: number) {
  const h = getShuffleHistory();
  localStorage.setItem(SHUFFLE_HISTORY_KEY,
    JSON.stringify([id, ...h.filter(x => x !== id)].slice(0, MAX_HISTORY)));
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

export async function getRandomContent(
  filters: MovieFilters,
  watchedIds: Set<number>
): Promise<TMDBMovieDetail | null> {
  const history = getShuffleHistory();
  const first = await discoverContent(filters, 1);
  const totalPages = Math.min(first.total_pages, 50);
  if (first.total_results === 0) return null;

  const pagePool = shuffleArray(Array.from({ length: totalPages }, (_, i) => i + 1));
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';

  for (let attempt = 0; attempt < Math.min(5, totalPages); attempt++) {
    const page = pagePool[attempt];
    const response = page === 1 ? first : await discoverContent(filters, page);
    const candidates = response.results.filter(m => {
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });
    const recent = history.slice(0, 10);
    const pool = candidates.filter(m => !recent.includes(m.id));
    const source = pool.length > 0 ? pool : candidates;
    const chosen = source[Math.floor(Math.random() * source.length)];
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

// ─── Watch Providers list (for filter panel) ──────────────────────

export interface ProviderInfo {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

const POPULAR_PROVIDERS_IT: ProviderInfo[] = [
  { provider_id: 8,    provider_name: 'Netflix',       logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  { provider_id: 119,  provider_name: 'Amazon Prime',  logo_path: '/dQeAar5H991VYporEjUspolDarG.jpg' },
  { provider_id: 337,  provider_name: 'Disney+',       logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19d.jpg' },
  { provider_id: 1899, provider_name: 'Max',           logo_path: '/Ajqyt5aNxNx8rDHQEhTHcPnNpjw.jpg' },
  { provider_id: 35,   provider_name: 'Apple TV+',     logo_path: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  { provider_id: 531,  provider_name: 'Paramount+',    logo_path: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  { provider_id: 39,   provider_name: 'NOW',           logo_path: '/ixVmHmFEKhxCG07LMnLBMZMFGlO.jpg' },
  { provider_id: 59,   provider_name: 'Rakuten TV',    logo_path: '/5oYxSbIKKCMQ4D5AqxRQKbLZfVQ.jpg' },
  { provider_id: 222,  provider_name: 'Timvision',     logo_path: '/bZGFHCAPgdD44ByaHFLAlqJGvSl.jpg' },
  { provider_id: 2,    provider_name: 'Apple TV Store', logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
];

export function getPopularProviders(): ProviderInfo[] {
  return POPULAR_PROVIDERS_IT;
}
