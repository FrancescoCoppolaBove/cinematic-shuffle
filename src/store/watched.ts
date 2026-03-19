import type { WatchedMovie } from '../types';

const STORAGE_KEY = 'cinematic_watched_movies';

export function getWatchedMovies(): WatchedMovie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchedMovie[];
    // Backward compat: aggiungi personal_rating se manca
    return parsed.map(m => ({
      ...m,
      personal_rating: m.personal_rating !== undefined ? m.personal_rating : null,
    }));
  } catch {
    return [];
  }
}

export function getWatchedIds(): Set<number> {
  return new Set(getWatchedMovies().map(m => m.id));
}

export function addWatchedMovie(movie: WatchedMovie): void {
  const current = getWatchedMovies();
  if (current.some(m => m.id === movie.id)) return;
  const entry: WatchedMovie = {
    ...movie,
    personal_rating: movie.personal_rating !== undefined ? movie.personal_rating : null,
    addedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...current]));
}

export function removeWatchedMovie(id: number): void {
  const updated = getWatchedMovies().filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function isMovieWatched(id: number): boolean {
  return getWatchedMovies().some(m => m.id === id);
}
