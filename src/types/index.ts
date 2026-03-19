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

export interface TMDBMovieBasic {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  overview: string;
  original_language: string;
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: TMDBGenre[];
  overview: string;
  runtime: number | null;
  original_language: string;
  tagline: string;
  status: string;
  credits: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
}

// App types
export interface MovieFilters {
  year?: number;
  decade?: string; // e.g. "1980s", "1990s", "2000s"
  genreIds?: number[];
  watchedStatus: 'all' | 'unwatched' | 'watched';
  actorIds?: number[];
  actorNames?: string[];
  directorName?: string;
  minImdbRating?: number;
}

export interface WatchedMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  personal_rating: number | null; // 1-5 stelle, null = non valutato
  addedAt: string; // ISO date string
}

export interface SearchResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export type AppView = 'shuffle' | 'search' | 'watched';

export const TMDB_GENRES: TMDBGenre[] = [
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
  { id: 10770, name: 'Film TV' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Western' },
];

export const DECADES = [
  { label: 'Anni \'50', value: '1950s', start: 1950, end: 1959 },
  { label: 'Anni \'60', value: '1960s', start: 1960, end: 1969 },
  { label: 'Anni \'70', value: '1970s', start: 1970, end: 1979 },
  { label: 'Anni \'80', value: '1980s', start: 1980, end: 1989 },
  { label: 'Anni \'90', value: '1990s', start: 1990, end: 1999 },
  { label: 'Anni 2000', value: '2000s', start: 2000, end: 2009 },
  { label: 'Anni 2010', value: '2010s', start: 2010, end: 2019 },
  { label: 'Anni 2020', value: '2020s', start: 2020, end: 2029 },
];
