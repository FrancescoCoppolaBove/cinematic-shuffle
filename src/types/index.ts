// TMDB API types
export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBVideo {
  id: string;
  key: string;          // YouTube video ID
  name: string;
  site: string;         // "YouTube"
  type: string;         // "Trailer", "Teaser", etc.
  official: boolean;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchProviders {
  flatrate?: TMDBWatchProvider[]; // streaming
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
}

export interface TMDBMovieBasic {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  overview: string;
  original_language: string;
  media_type?: 'movie' | 'tv';
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  name?: string;
  original_title: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genres: TMDBGenre[];
  overview: string;
  runtime: number | null;
  episode_run_time?: number[];
  original_language: string;
  tagline: string;
  status?: string;
  media_type: 'movie' | 'tv';
  number_of_seasons?: number;
  number_of_episodes?: number;
  in_production?: boolean;
  next_episode_to_air?: {
    air_date: string;
    season_number: number;
    episode_number: number;
    name: string;
  } | null;
  last_episode_to_air?: {
    air_date: string;
    season_number: number;
    name: string;
  } | null;
  seasons?: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
    overview: string;
  }[];
  // belongs_to_collection — for franchise/saga
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  credits: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
  videos?: {
    results: TMDBVideo[];
  };
  similar?: {
    results: TMDBMovieBasic[];
  };
  recommendations?: {
    results: TMDBMovieBasic[];
  };
  'watch/providers'?: {
    results: Record<string, TMDBWatchProviders & { link?: string }>;
  };
}

// App types
export type MediaType = 'movie' | 'tv' | 'both';

export interface MovieFilters {
  year?: number;
  decade?: string;
  genreIds?: number[];
  withoutGenreIds?: number[];      // generi da escludere (es. quelli votati basso)
  minRuntime?: number;             // durata minima in minuti (per i mood)
  maxRuntime?: number;             // durata massima in minuti (per i mood)
  watchedStatus: 'all' | 'unwatched' | 'watched';
  actorIds?: number[];
  actorNames?: string[];
  directorName?: string;
  minImdbRating?: number;
  mediaType: MediaType;
  withProviders?: number[];       // TMDB watch provider IDs
  withAwards?: boolean;           // candidature/vittorie Oscar
  language?: string;              // ISO 639-1 (es. 'en', 'it', 'ja', 'ko', 'fr')
  originCountry?: string;         // ISO 3166-1 (es. 'US', 'IT', 'JP', 'KR', 'FR')
}

// Languages più comuni per il filtro
export const COMMON_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italian' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
] as const;

// Countries più rilevanti per il filtro
export const COMMON_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'IT', name: 'Italy' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'ES', name: 'Spain' },
  { code: 'IN', name: 'India' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'DK', name: 'Denmark' },
  { code: 'SE', name: 'Sweden' },
  { code: 'RU', name: 'Russia' },
  { code: 'IR', name: 'Iran' },
  { code: 'AR', name: 'Argentina' },
  { code: 'PL', name: 'Poland' },
] as const;

export interface WatchedMovie {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  personal_rating: number | null;
  liked: boolean;
  rewatchCount: number;
  genre_ids: number[];
  runtime?: number | null;
  original_language?: string;      // ISO 639-1
  addedAt: string;
  watchedDate?: string;            // data di visione (YYYY-MM-DD); default = giorno di addedAt
  media_type: 'movie' | 'tv';
  runtimeBackfilled?: boolean;     // TV: runtime ricalcolato sull'intera serie
}

export interface WatchlistItem {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  runtime?: number | null;
  original_language?: string;      // ISO 639-1
  addedAt: string;
  media_type: 'movie' | 'tv';
}

// Liste tematiche personalizzate (es. "Maratona Nolan", "Da vedere con lei")
export interface ListMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  media_type: 'movie' | 'tv';
  addedAt: string;
}

export interface MovieList {
  id: string;
  name: string;
  note?: string;
  items: ListMovie[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  media_type: 'movie' | 'tv';
}

export interface TrendingItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
  media_type: 'movie' | 'tv';
  overview: string;
}

export type AppView = 'home' | 'shuffle' | 'tonight' | 'search' | 'profile';

export const TMDB_MOVIE_GENRES: TMDBGenre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

export const TMDB_TV_GENRES: TMDBGenre[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

export const TMDB_GENRES = TMDB_MOVIE_GENRES;

export const DECADES = [
  { label: "30s", value: '1930s', start: 1930, end: 1939 },
  { label: "40s", value: '1940s', start: 1940, end: 1949 },
  { label: "50s", value: '1950s', start: 1950, end: 1959 },
  { label: "60s", value: '1960s', start: 1960, end: 1969 },
  { label: "70s", value: '1970s', start: 1970, end: 1979 },
  { label: "80s", value: '1980s', start: 1980, end: 1989 },
  { label: "90s", value: '1990s', start: 1990, end: 1999 },
  { label: '2000s', value: '2000s', start: 2000, end: 2009 },
  { label: '2010s', value: '2010s', start: 2010, end: 2019 },
  { label: '2020s', value: '2020s', start: 2020, end: 2029 },
];
