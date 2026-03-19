import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, WatchlistItem, TMDBMovieDetail } from '../types';
import { getTitle, getReleaseDate } from '../services/tmdb';
import {
  fetchWatchedMovies, addWatchedToFirestore, removeWatchedFromFirestore,
  updatePersonalRating as updateRatingFs, updateLiked as updateLikedFs,
  fetchWatchlist, addToWatchlistFirestore, removeFromWatchlistFirestore,
} from '../services/firestore';

export function useWatched(user: User | null) {
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const prevUid = useRef<string | null>(null);

  const loadAll = useCallback(async (uid: string) => {
    setLoading(true);
    const [watched, wl] = await Promise.all([
      fetchWatchedMovies(uid),
      fetchWatchlist(uid),
    ]);
    setWatchedMovies(watched);
    setWatchedIds(new Set(watched.map(m => m.id)));
    setWatchlist(wl);
    setWatchlistIds(new Set(wl.map(m => m.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && prevUid.current !== user.uid) {
      prevUid.current = user.uid;
      void loadAll(user.uid);
    }
    if (!user) {
      prevUid.current = null;
      setWatchedMovies([]); setWatchedIds(new Set());
      setWatchlist([]); setWatchlistIds(new Set());
    }
  }, [user, loadAll]);

  const refresh = useCallback(async () => {
    if (user) await loadAll(user.uid);
  }, [user, loadAll]);

  // ─── Watched ────────────────────────────────────────────────────
  const markWatched = useCallback(async (movie: TMDBMovieDetail, personalRating: number | null = null) => {
    if (!user) return;
    const entry: Omit<WatchedMovie, 'addedAt'> = {
      id: movie.id,
      title: getTitle(movie),
      poster_path: movie.poster_path,
      release_date: getReleaseDate(movie),
      vote_average: movie.vote_average,
      personal_rating: personalRating,
      liked: false,
      media_type: movie.media_type,
    };
    await addWatchedToFirestore(user.uid, entry);
    // If it was on watchlist, remove it
    if (watchlistIds.has(movie.id)) {
      await removeFromWatchlistFirestore(user.uid, movie.id);
    }
    await refresh();
  }, [user, watchlistIds, refresh]);

  const unmarkWatched = useCallback(async (id: number) => {
    if (!user) return;
    await removeWatchedFromFirestore(user.uid, id);
    await refresh();
  }, [user, refresh]);

  const updateRating = useCallback(async (movieId: number, rating: number | null) => {
    if (!user) return;
    await updateRatingFs(user.uid, movieId, rating);
    setWatchedMovies(prev => prev.map(m => m.id === movieId ? { ...m, personal_rating: rating } : m));
  }, [user]);

  const toggleLiked = useCallback(async (movieId: number) => {
    if (!user) return;
    const current = watchedMovies.find(m => m.id === movieId);
    const newLiked = !(current?.liked ?? false);
    await updateLikedFs(user.uid, movieId, newLiked);
    setWatchedMovies(prev => prev.map(m => m.id === movieId ? { ...m, liked: newLiked } : m));
  }, [user, watchedMovies]);

  // ─── Watchlist ──────────────────────────────────────────────────
  const addToWatchlist = useCallback(async (movie: TMDBMovieDetail) => {
    if (!user) return;
    if (watchlistIds.has(movie.id)) return;
    const item: Omit<WatchlistItem, 'addedAt'> = {
      id: movie.id,
      title: getTitle(movie),
      poster_path: movie.poster_path,
      release_date: getReleaseDate(movie),
      vote_average: movie.vote_average,
      media_type: movie.media_type,
    };
    await addToWatchlistFirestore(user.uid, item);
    await refresh();
  }, [user, watchlistIds, refresh]);

  const removeFromWatchlist = useCallback(async (id: number) => {
    if (!user) return;
    await removeFromWatchlistFirestore(user.uid, id);
    await refresh();
  }, [user, refresh]);

  return {
    watchedMovies, watchedIds, watchlist, watchlistIds,
    loading, refresh,
    markWatched, unmarkWatched, updateRating, toggleLiked,
    addToWatchlist, removeFromWatchlist,
  };
}
