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

// Rileva se una stringa contiene caratteri non-latini (giapponese, coreano, cinese, arabo, russo, ecc.)
function hasNonLatinChars(s: string): boolean {
  // Copre: CJK, Hangul, Hiragana, Katakana, Arabo, Ebraico, Cirillico, Thai, Devanagari, ecc.
  return /[\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(s);
}

export function getTitle(item: { title?: string; name?: string; original_title?: string; original_name?: string }): string {
  const orig = item.original_title || item.original_name;
  const localized = item.title || item.name;

  if (!orig) return localized || 'Titolo sconosciuto';

  // Se il titolo originale è in caratteri non-latini → usa quello localizzato
  // (TMDB lo restituisce già in inglese/italiano con caratteri latini)
  if (hasNonLatinChars(orig)) return localized || orig;

  // Altrimenti usa sempre il titolo originale (es. "The Godfather" invece di "Il Padrino")
  return orig;
}

/**
 * Restituisce il titolo originale del film da mostrare sotto il titolo principale,
 * solo quando è diverso dal titolo principale.
 * Esempi:
 *   "Parasite" (en) + "기생충" (ko) → mostra "기생충"
 *   "Il Padrino" (it) → getTitle = "The Godfather", orig = "The Godfather" → non mostrare
 *   "Seven Samurai" + "七人の侍" → mostra "七人の侍"
 *   "Pulp Fiction" + "Pulp Fiction" → non mostrare (uguale)
 */
/**
 * Titolo in inglese da mostrare come titolo principale.
 * Con language=en-US, il campo `title` è già in inglese.
 * Usare questo per il titolo principale in tutta l'app.
 */
/**
 * Nome persona sempre in caratteri latini/occidentali.
 * TMDB con language=en-US restituisce già i nomi traslitterati,
 * ma questa funzione garantisce che non passino caratteri non-latini.
 * Nessun nome originale affianco — solo il nome occidentale.
 */
export function getPersonName(name: string): string {
  if (!name) return 'Unknown';
  // Se il nome contiene solo caratteri non-latini, restituisci come-è
  // (TMDB con en-US dovrebbe già essere traslitterato)
  return name;
}

export function getEnglishTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || 'Unknown title';
}

export function getOriginalTitle(item: { title?: string; name?: string; original_title?: string; original_name?: string }): string | null {
  const englishTitle = getEnglishTitle(item);
  const orig = item.original_title || item.original_name;
  if (!orig) return null;
  // Non mostrare se identico al titolo inglese (case-insensitive, ignora spazi)
  if (orig.trim().toLowerCase() === englishTitle.trim().toLowerCase()) return null;
  return orig;
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
  url.searchParams.set('language', 'en-US');
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
  // Awards: TMDB keyword IDs — 210024=academy award, 155477=best picture, 9748=oscar winner
  if (filters.withAwards) {
    params['with_keywords'] = '210024|155477|9748';
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

// ─── Search: People ──────────────────────────────────────────────

export interface PersonSearchResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
}

export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ results: PersonSearchResult[] }>('/search/person', { query });
  return (res.results ?? []).slice(0, 15).map(p => ({
    id: p.id,
    name: p.name,
    profile_path: p.profile_path,
    known_for_department: p.known_for_department || 'Acting',
    popularity: p.popularity,
  }));
}

// ─── Search: Companies/Studios ───────────────────────────────────

export interface CompanySearchResult {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ results: CompanySearchResult[] }>('/search/company', { query });
  return (res.results ?? []).slice(0, 10);
}

export async function getCompanyMovies(
  companyId: number,
  page = 1
): Promise<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }> {
  const res = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    '/discover/movie',
    { with_companies: String(companyId), sort_by: 'popularity.desc', page: String(page), 'vote_count.gte': '5' }
  );
  return {
    results: (res.results ?? []).map(m => ({ ...m, media_type: 'movie' as const })),
    total_pages: res.total_pages ?? 1,
    total_results: res.total_results ?? 0,
  };
}

// ─── Browse By — general discover with flexible params ────────────
export interface BrowseFilters {
  mediaType?: 'movie' | 'tv';
  sortBy?: string;
  year?: number;
  decade?: string;
  genreIds?: number[];
  language?: string;
  originCountry?: string;
  withProviders?: number[];
  minVoteCount?: number;
  minRating?: number;
}

export async function browseDiscover(
  filters: BrowseFilters,
  page = 1
): Promise<DiscoverPageResult> {
  const mediaType = filters.mediaType ?? 'movie';
  const params: Record<string, string> = {
    sort_by: filters.sortBy ?? 'popularity.desc',
    'vote_count.gte': String(filters.minVoteCount ?? 50),
    page: String(page),
  };

  if (filters.genreIds?.length) params['with_genres'] = filters.genreIds.join(',');
  if (filters.language) params['with_original_language'] = filters.language;
  if (filters.originCountry) params['with_origin_country'] = filters.originCountry;
  if (filters.minRating) params['vote_average.gte'] = String(filters.minRating);
  if (filters.withProviders?.length) {
    params['with_watch_providers'] = filters.withProviders.join('|');
    params['watch_region'] = 'IT';
  }
  if (filters.year) {
    const k = mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year';
    params[k] = String(filters.year);
  } else if (filters.decade) {
    const ranges: Record<string, [number, number]> = {
      '1870s':[1870,1879],'1880s':[1880,1889],'1890s':[1890,1899],
      '1900s':[1900,1909],'1910s':[1910,1919],'1920s':[1920,1929],
      '1930s':[1930,1939],'1940s':[1940,1949],'1950s':[1950,1959],
      '1960s':[1960,1969],'1970s':[1970,1979],'1980s':[1980,1989],
      '1990s':[1990,1999],'2000s':[2000,2009],'2010s':[2010,2019],'2020s':[2020,2029],
    };
    const r = ranges[filters.decade];
    if (r) {
      const k = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      params[`${k}.gte`] = `${r[0]}-01-01`;
      params[`${k}.lte`] = `${r[1]}-12-31`;
    }
  }

  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    `/discover/${mediaType}`, params
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: mediaType })),
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  };
}

// Upcoming movies (release_date.gte = today)
export async function getUpcoming(page = 1): Promise<DiscoverPageResult> {
  const today = new Date().toISOString().split('T')[0];
  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    '/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': today,
      'vote_count.gte': '0',
      page: String(page),
    }
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: 'movie' as const })),
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  };
}

// Top 500 narrative features (popular, high quality)
export async function getTop500(page = 1): Promise<DiscoverPageResult> {
  const pageNum = Math.min(page, 25); // 25 pages × 20 = 500
  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    '/discover/movie', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '5000',
      'vote_average.gte': '7.0',
      page: String(pageNum),
    }
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: 'movie' as const })),
    totalPages: Math.min(data.total_pages ?? 1, 25),
    totalResults: Math.min(data.total_results ?? 0, 500),
  };
}

// Most anticipated (upcoming + high popularity)
export async function getMostAnticipated(page = 1): Promise<DiscoverPageResult> {
  const today = new Date().toISOString().split('T')[0];
  const sixMonths = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    '/discover/movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': today,
      'primary_release_date.lte': sixMonths,
      page: String(page),
    }
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: 'movie' as const })),
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  };
}

// Fetch available TMDB genres for movies or TV
export async function getTmdbGenres(mediaType: 'movie' | 'tv' = 'movie'): Promise<{ id: number; name: string }[]> {
  const data = await apiFetch<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`);
  return data.genres ?? [];
}

// Fetch available TMDB countries
export async function getTmdbCountries(): Promise<{ iso_3166_1: string; english_name: string }[]> {
  try {
    const data = await apiFetch<{ iso_3166_1: string; english_name: string }[]>('/configuration/countries');
    return (Array.isArray(data) ? data : []).sort((a, b) => a.english_name.localeCompare(b.english_name));
  } catch { return []; }
}

// Fetch available TMDB languages
export async function getTmdbLanguages(): Promise<{ iso_639_1: string; english_name: string }[]> {
  try {
    const data = await apiFetch<{ iso_639_1: string; english_name: string; name: string }[]>('/configuration/languages');
    return (Array.isArray(data) ? data : [])
      .filter(l => l.iso_639_1 && l.english_name)
      .sort((a, b) => a.english_name.localeCompare(b.english_name));
  } catch { return []; }
}

// ─── Shuffle ──────────────────────────────────────────────────────

const SHUFFLE_HISTORY_KEY = 'cinematic_shuffle_history';
const MAX_HISTORY = 100;  // più lunga per evitare ripetizioni

export function getShuffleHistory(): number[] {
  try { return JSON.parse(localStorage.getItem(SHUFFLE_HISTORY_KEY) || '[]') as number[]; }
  catch { return []; }
}
export function addToShuffleHistory(id: number) {
  const h = getShuffleHistory();
  localStorage.setItem(SHUFFLE_HISTORY_KEY,
    JSON.stringify([id, ...h.filter(x => x !== id)].slice(0, MAX_HISTORY)));
}
export function clearShuffleHistory() { localStorage.removeItem(SHUFFLE_HISTORY_KEY); }

/**
 * Seleziona una pagina random con distribuzione pesata verso pagine alte.
 * Evita sempre le prime pagine (che TMDB restituisce sempre uguali).
 * Peso: pagina alta = più probabilità (esplora la coda del catalogo).
 */
function weightedRandomPage(totalPages: number): number {
  // Divide il pool in 4 fasce e pesa le fasce superiori di più
  const capped = Math.min(totalPages, 200);
  // 10% dalle pagine 1-5 (top noti), 20% 6-25, 30% 26-75, 40% 76-fine
  const r = Math.random();
  if (r < 0.10 || capped <= 5) return Math.floor(Math.random() * Math.min(5, capped)) + 1;
  if (r < 0.30 || capped <= 25) return Math.floor(Math.random() * Math.min(20, capped - 5)) + 6;
  if (r < 0.60 || capped <= 75) return Math.floor(Math.random() * Math.min(50, capped - 25)) + 26;
  return Math.floor(Math.random() * Math.max(1, capped - 75)) + 76;
}


export async function getRandomContent(
  filters: MovieFilters,
  watchedIds: Set<number>
): Promise<TMDBMovieDetail | null> {
  const history = getShuffleHistory();
  const recentHistory = new Set(history.slice(0, 20)); // escludi gli ultimi 20

  // Prima chiamata: scopriamo quante pagine esistono (usiamo pagina pesata subito)
  const first = await discoverContent(filters, 1);
  if (first.total_results === 0) return null;
  const totalPages = first.total_pages;
  const mediaType = filters.mediaType === 'tv' ? 'tv' : 'movie';

  // Genera 6 pagine candidate con distribuzione pesata (evita sempre le prime)
  // Se pochi risultati (≤2 pagine), usa pagina 1 o 2 direttamente
  const pageCandidates: number[] = [];
  if (totalPages <= 2) {
    pageCandidates.push(1, 2);
  } else {
    const seen = new Set<number>();
    // Forza almeno una pagina "alta" e una "media"
    while (pageCandidates.length < 6) {
      const p = weightedRandomPage(totalPages);
      if (!seen.has(p)) { seen.add(p); pageCandidates.push(p); }
    }
  }

  for (const page of pageCandidates) {
    const response = page === 1 ? first : await discoverContent(filters, page);
    const candidates = response.results.filter(m => {
      if (filters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
      if (filters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
      return true;
    });
    // Preferisci film non visti di recente nello shuffle
    const fresh = candidates.filter(m => !recentHistory.has(m.id));
    const source = fresh.length > 0 ? fresh : candidates;
    if (source.length === 0) continue;

    // Scegli casualmente tra i candidati disponibili
    const chosen = source[Math.floor(Math.random() * source.length)];
    if (chosen) {
      addToShuffleHistory(chosen.id);
      return getMovieDetail(chosen.id, mediaType);
    }
  }

  // Fallback: usa qualsiasi film dalla prima pagina che rispetti i filtri
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

// ─── Person detail ─────────────────────────────────────────────────

export interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
}

export interface TMDBPersonCreditMovie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  character?: string;       // cast
  job?: string;             // crew
  department?: string;      // crew
  media_type: 'movie' | 'tv';
}

export interface TMDBPersonCredits {
  cast: TMDBPersonCreditMovie[];
  crew: TMDBPersonCreditMovie[];
}

export async function getPersonDetail(personId: number): Promise<TMDBPerson> {
  return apiFetch<TMDBPerson>(`/person/${personId}`);
}

export async function getPersonCredits(personId: number): Promise<TMDBPersonCredits> {
  // combined_credits gives both movie and TV in one call
  const data = await apiFetch<{ cast: (TMDBPersonCreditMovie & { media_type: string })[]; crew: (TMDBPersonCreditMovie & { media_type: string })[] }>(
    `/person/${personId}/combined_credits`
  );
  // Filtra SOLO film e serie TV — escludi episodi, stagioni, cortometraggi TV, ecc.
  const isValidMedia = (m: { media_type: string }) =>
    m.media_type === 'movie' || m.media_type === 'tv';

  const toItem = (m: TMDBPersonCreditMovie & { media_type: string }): TMDBPersonCreditMovie => ({
    ...m,
    media_type: m.media_type === 'tv' ? 'tv' : 'movie',
  });

  // Deduplicazione per id (stessa persona può avere più ruoli nello stesso film)
  const dedupe = (arr: TMDBPersonCreditMovie[]) => {
    const seen = new Set<number>();
    return arr.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  };

  return {
    cast: dedupe(data.cast.filter(isValidMedia).map(toItem))
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0)),
    crew: dedupe(data.crew.filter(isValidMedia).map(toItem))
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0)),
  };
}

// ─── Keywords ──────────────────────────────────────────────────────

export interface TMDBKeyword { id: number; name: string; }

export async function getMovieKeywords(movieId: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<TMDBKeyword[]> {
  if (mediaType === 'tv') {
    const data = await apiFetch<{ results: TMDBKeyword[] }>(`/tv/${movieId}/keywords`);
    return data.results ?? [];
  }
  const data = await apiFetch<{ keywords: TMDBKeyword[] }>(`/movie/${movieId}/keywords`);
  return data.keywords ?? [];
}

// ─── Discover by keyword ────────────────────────────────────────────

export interface DiscoverPageResult {
  items: TMDBMovieBasic[];
  totalPages: number;
  totalResults: number;
}

export async function discoverByKeyword(
  keywordId: number,
  mediaType: 'movie' | 'tv' = 'movie',
  page = 1,
  extraParams: Record<string, string> = {}
): Promise<DiscoverPageResult> {
  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    `/discover/${mediaType}`, {
      with_keywords: String(keywordId),
      sort_by: 'vote_average.desc',
      'vote_count.gte': '50',
      page: String(page),
      ...extraParams,
    }
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: mediaType })),
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  };
}

// ─── Discover by genre ─────────────────────────────────────────────

export async function discoverByGenre(
  genreId: number,
  mediaType: 'movie' | 'tv' = 'movie',
  page = 1,
  extraParams: Record<string, string> = {}
): Promise<DiscoverPageResult> {
  const data = await apiFetch<{ results: TMDBMovieBasic[]; total_pages: number; total_results: number }>(
    `/discover/${mediaType}`, {
      with_genres: String(genreId),
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
      page: String(page),
      ...extraParams,
    }
  );
  return {
    items: (data.results ?? []).map(m => ({ ...m, media_type: mediaType })),
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  };
}

// ─── Tonight: fetch trending + cinephile picks ─────────────────────

export async function getTrendingThisWeek(mediaType: 'movie' | 'tv' = 'movie'): Promise<TMDBMovieBasic[]> {
  const data = await apiFetch<{ results: TMDBMovieBasic[] }>(`/trending/${mediaType}/week`);
  return (data.results ?? []).map(m => ({ ...m, media_type: mediaType }));
}

// "Film da cinefilo" — alta valutazione ma basso vote_count (cult, underrated, ricercato)
export async function getCinephilePick(mediaType: 'movie' | 'tv' = 'movie'): Promise<TMDBMovieBasic[]> {
  const data = await apiFetch<{ results: TMDBMovieBasic[] }>(`/discover/${mediaType}`, {
    sort_by: 'vote_average.desc',
    'vote_average.gte': '7.5',
    'vote_count.gte': '200',
    'vote_count.lte': '3000',  // molto votato in qualità ma non mainstream
    'with_original_language': 'en|fr|it|ja|ko|de|es',
    page: String(Math.floor(Math.random() * 5) + 1),
  });
  return (data.results ?? []).map(m => ({ ...m, media_type: mediaType }));
}

// "Il mio consiglio" — da gusti utente, ignora watchlist, scoperta pura
export async function getPersonalizedPick(
  topGenreIds: number[],
  mediaType: 'movie' | 'tv' = 'movie',
  minRating: number = 6.5,
  excludeIds: number[] = []
): Promise<TMDBMovieBasic[]> {
  const params: Record<string, string> = {
    sort_by: 'vote_average.desc',
    'vote_average.gte': String(minRating),
    'vote_count.gte': '500',
    page: String(Math.floor(Math.random() * 8) + 1),
  };
  if (topGenreIds.length > 0) {
    params['with_genres'] = topGenreIds.slice(0, 2).join(',');
  }
  const data = await apiFetch<{ results: TMDBMovieBasic[] }>(`/discover/${mediaType}`, params);
  const results = (data.results ?? []).map(m => ({ ...m, media_type: mediaType }));
  return results.filter(m => !excludeIds.includes(m.id));
}

// ─── Tonight: nuovi slot ──────────────────────────────────────────────

// Film brevi e di qualità (runtime ≤ 95 min)
export async function getShortQualityPick(
  topGenreIds: number[] = [],
  excludeIds: number[] = []
): Promise<TMDBMovieBasic[]> {
  const params: Record<string, string> = {
    sort_by: 'vote_average.desc',
    'vote_average.gte': '7.0',
    'vote_count.gte': '300',
    'with_runtime.lte': '95',
    'with_runtime.gte': '60',
    page: String(Math.floor(Math.random() * 5) + 1),
  };
  if (topGenreIds.length > 0) {
    params['with_genres'] = topGenreIds.slice(0, 2).join(',');
  }
  const data = await apiFetch<{ results: TMDBMovieBasic[] }>('/discover/movie', params);
  return (data.results ?? []).filter(m => !excludeIds.includes(m.id)).map(m => ({ ...m, media_type: 'movie' as const }));
}

// Keyword TMDB stagionali per mese
const SEASONAL_KEYWORDS: Record<number, { keywordId: number; label: string; emoji: string }> = {
  1:  { keywordId: 9672,  label: "Perfetto per l'inverno",   emoji: '❄️' },
  2:  { keywordId: 9672,  label: 'San Valentino in arrivo',   emoji: '❤️' },
  3:  { keywordId: 9951,  label: 'Aria di primavera',         emoji: '🌸' },
  4:  { keywordId: 9951,  label: 'Atmosfera primaverile',     emoji: '🌷' },
  5:  { keywordId: 10349, label: 'Spirito avventuroso',       emoji: '🌿' },
  6:  { keywordId: 10349, label: 'Mood estivo',               emoji: '☀️' },
  7:  { keywordId: 10349, label: 'Cinema estivo',             emoji: '🏖️' },
  8:  { keywordId: 10349, label: 'Fine estate',               emoji: '🌅' },
  9:  { keywordId: 9840,  label: 'Autunno alle porte',        emoji: '🍂' },
  10: { keywordId: 210074, label: 'Atmosfera Halloween',      emoji: '🎃' },
  11: { keywordId: 9840,  label: 'Serate autunnali',          emoji: '🍁' },
  12: { keywordId: 207350, label: 'Spirito natalizio',        emoji: '🎄' },
};

export function getSeasonalKeyword(): { keywordId: number; label: string; emoji: string } | null {
  const month = new Date().getMonth() + 1;
  return SEASONAL_KEYWORDS[month] ?? null;
}

export async function getSeasonalPick(excludeIds: number[] = []): Promise<TMDBMovieBasic[]> {
  const seasonal = getSeasonalKeyword();
  if (!seasonal) return [];
  const data = await apiFetch<{ results: TMDBMovieBasic[] }>('/discover/movie', {
    with_keywords: String(seasonal.keywordId),
    sort_by: 'vote_average.desc',
    'vote_average.gte': '6.5',
    'vote_count.gte': '200',
    page: String(Math.floor(Math.random() * 3) + 1),
  });
  return (data.results ?? []).filter(m => !excludeIds.includes(m.id)).map(m => ({ ...m, media_type: 'movie' as const }));
}

// Film in watchlist disponibili sulle piattaforme dell'utente
// Usa i dati watch/providers già in ogni film — ma qui dobbiamo fetcharli per i film watchlist
// Che non hanno i provider nella risposta di base. Fetchiamo in batch.
export async function getWatchlistProviders(
  movieIds: { id: number; mediaType: 'movie' | 'tv' }[]
): Promise<Record<number, number[]>> {
  // Ritorna mappa movieId → array provider_ids disponibili in IT (flatrate + free)
  const result: Record<number, number[]> = {};
  const fetches = movieIds.slice(0, 20).map(async ({ id, mediaType }) => {
    try {
      const data = await apiFetch<{ results: Record<string, { flatrate?: { provider_id: number }[]; free?: { provider_id: number }[] }> }>(
        `/${mediaType}/${id}/watch/providers`
      );
      const region = data.results?.['IT'] ?? data.results?.['US'] ?? null;
      if (!region) { result[id] = []; return; }
      const ids = [
        ...(region.flatrate ?? []),
        ...(region.free ?? []),
      ].map(p => p.provider_id);
      result[id] = [...new Set(ids)];
    } catch {
      result[id] = [];
    }
  });
  await Promise.all(fetches);
  return result;
}
