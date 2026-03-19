import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, TMDBMovieDetail } from '../types';
import {
  getWatchedMovies as getLsMovies,
  getWatchedIds as getLsIds,
  addWatchedMovie as addLsMovie,
  removeWatchedMovie as removeLsMovie,
} from '../store/watched';
import {
  fetchWatchedMovies,
  addWatchedMovieToFirestore,
  removeWatchedMovieFromFirestore,
  updatePersonalRating as updateRatingFirestore,
  migrateLocalStorageToFirestore,
} from '../services/firestore';

interface UseWatchedReturn {
  watchedMovies: WatchedMovie[];
  watchedIds: Set<number>;
  loading: boolean;
  migratedCount: number | null;
  markWatched: (movie: TMDBMovieDetail, personalRating?: number | null) => Promise<void>;
  unmarkWatched: (id: number) => Promise<void>;
  updateRating: (movieId: number, rating: number | null) => Promise<void>;
  checkWatched: (id: number) => boolean;
  refresh: () => Promise<void>;
}

export function useWatched(user: User | null): UseWatchedReturn {
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [migratedCount, setMigratedCount] = useState<number | null>(null);
  const prevUid = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      if (user) {
        if (prevUid.current !== user.uid) {
          prevUid.current = user.uid;
          setLoading(true);
          const migrated = await migrateLocalStorageToFirestore(user.uid);
          if (migrated > 0) setMigratedCount(migrated);
          const movies = await fetchWatchedMovies(user.uid);
          setWatchedMovies(movies);
          setWatchedIds(new Set(movies.map(m => m.id)));
          setLoading(false);
        }
      } else {
        prevUid.current = null;
        const movies = getLsMovies();
        setWatchedMovies(movies);
        setWatchedIds(getLsIds());
      }
    }
    void load();
  }, [user]);

  const refresh = useCallback(async () => {
    if (user) {
      setLoading(true);
      const movies = await fetchWatchedMovies(user.uid);
      setWatchedMovies(movies);
      setWatchedIds(new Set(movies.map(m => m.id)));
      setLoading(false);
    } else {
      const movies = getLsMovies();
      setWatchedMovies(movies);
      setWatchedIds(getLsIds());
    }
  }, [user]);

  const markWatched = useCallback(async (
    movie: TMDBMovieDetail,
    personalRating: number | null = null
  ) => {
    const entry: WatchedMovie = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      personal_rating: personalRating,
      addedAt: new Date().toISOString(),
    };
    if (user) {
      await addWatchedMovieToFirestore(user.uid, entry, personalRating);
    } else {
      addLsMovie(entry);
    }
    await refresh();
  }, [user, refresh]);

  const unmarkWatched = useCallback(async (id: number) => {
    if (user) {
      await removeWatchedMovieFromFirestore(user.uid, id);
    } else {
      removeLsMovie(id);
    }
    await refresh();
  }, [user, refresh]);

  const updateRating = useCallback(async (movieId: number, rating: number | null) => {
    if (user) {
      await updateRatingFirestore(user.uid, movieId, rating);
    } else {
      const movies = getLsMovies();
      const updated = movies.map(m =>
        m.id === movieId ? { ...m, personal_rating: rating } : m
      );
      localStorage.setItem('cinematic_watched_movies', JSON.stringify(updated));
    }
    await refresh();
  }, [user, refresh]);

  const checkWatched = useCallback((id: number): boolean => {
    return watchedIds.has(id);
  }, [watchedIds]);

  return {
    watchedMovies,
    watchedIds,
    loading,
    migratedCount,
    markWatched,
    unmarkWatched,
    updateRating,
    checkWatched,
    refresh,
  };
}
