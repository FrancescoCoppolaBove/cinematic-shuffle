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
  status: string;
  media_type: 'movie' | 'tv';
  number_of_seasons?: number;
  number_of_episodes?: number;
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
  watchedStatus: 'all' | 'unwatched' | 'watched';
  actorIds?: number[];
  actorNames?: string[];
  directorName?: string;
  minImdbRating?: number;
  mediaType: MediaType;
  withProviders?: number[];    // TMDB watch provider IDs
  withAwards?: boolean;        // candidature/vincite Oscar
}

export interface WatchedMovie {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  personal_rating: number | null;
  liked: boolean;
  rewatchCount: number;            // volte che l'utente ha rivisto
  addedAt: string;
  media_type: 'movie' | 'tv';
}

export interface WatchlistItem {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  addedAt: string;
  media_type: 'movie' | 'tv';
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

export type AppView = 'home' | 'shuffle' | 'search' | 'watched' | 'watchlist' | 'profile';

export const TMDB_MOVIE_GENRES: TMDBGenre[] = [
  { id: 28, name: 'Azione' },
  { id: 12, name: 'Avventura' },
  { id: 16, name: 'Animazione' },
  { id: 35, name: 'Commedia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentario' },
  { id: 18, name: 'Drammatico' },
  { id: 10751, name: 'Famiglia' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'Storia' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Musica' },
  { id: 9648, name: 'Mistero' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Fantascienza' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Western' },
];

export const TMDB_TV_GENRES: TMDBGenre[] = [
  { id: 10759, name: 'Azione & Avventura' },
  { id: 16, name: 'Animazione' },
  { id: 35, name: 'Commedia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentario' },
  { id: 18, name: 'Dramma' },
  { id: 10751, name: 'Famiglia' },
  { id: 10762, name: 'Per bambini' },
  { id: 9648, name: 'Mistero' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10768, name: 'Guerra & Politica' },
  { id: 37, name: 'Western' },
];

export const TMDB_GENRES = TMDB_MOVIE_GENRES;

export const DECADES = [
  { label: "Anni '30", value: '1930s', start: 1930, end: 1939 },
  { label: "Anni '40", value: '1940s', start: 1940, end: 1949 },
  { label: "Anni '50", value: '1950s', start: 1950, end: 1959 },
  { label: "Anni '60", value: '1960s', start: 1960, end: 1969 },
  { label: "Anni '70", value: '1970s', start: 1970, end: 1979 },
  { label: "Anni '80", value: '1980s', start: 1980, end: 1989 },
  { label: "Anni '90", value: '1990s', start: 1990, end: 1999 },
  { label: 'Anni 2000', value: '2000s', start: 2000, end: 2009 },
  { label: 'Anni 2010', value: '2010s', start: 2010, end: 2019 },
  { label: 'Anni 2020', value: '2020s', start: 2020, end: 2029 },
];
