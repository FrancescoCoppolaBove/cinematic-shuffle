import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { MovieList, ListMovie, TMDBMovieDetail } from '../types';
import { getTitle, getReleaseDate } from '../services/tmdb';
import {
  fetchLists, createList as createListFs, renameList as renameListFs,
  deleteList as deleteListFs, setListItems,
} from '../services/firestore';

function toListMovie(movie: TMDBMovieDetail): ListMovie {
  return {
    id: movie.id,
    title: getTitle(movie),
    poster_path: movie.poster_path,
    release_date: getReleaseDate(movie),
    media_type: movie.media_type,
    addedAt: new Date().toISOString(),
  };
}

export function useLists(user: User | null) {
  const [lists, setLists] = useState<MovieList[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUid = useRef<string | null>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try { setLists(await fetchLists(uid)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user && prevUid.current !== user.uid) {
      prevUid.current = user.uid;
      void load(user.uid);
    }
    if (!user) { prevUid.current = null; setLists([]); }
  }, [user, load]);

  const createList = useCallback(async (name: string): Promise<MovieList | null> => {
    if (!user) return null;
    const created = await createListFs(user.uid, name);
    setLists(prev => [created, ...prev]);
    return created;
  }, [user]);

  const renameList = useCallback(async (listId: string, name: string) => {
    if (!user) return;
    await renameListFs(user.uid, listId, name);
    setLists(prev => prev.map(l => l.id === listId ? { ...l, name: name.trim() || 'Lista' } : l));
  }, [user]);

  const deleteList = useCallback(async (listId: string) => {
    if (!user) return;
    await deleteListFs(user.uid, listId);
    setLists(prev => prev.filter(l => l.id !== listId));
  }, [user]);

  // Aggiunge un film a una lista (no-op se già presente)
  const addToList = useCallback(async (listId: string, movie: TMDBMovieDetail) => {
    if (!user) return;
    const list = lists.find(l => l.id === listId);
    if (!list || list.items.some(i => i.id === movie.id)) return;
    const items = [toListMovie(movie), ...list.items];
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items } : l));
    await setListItems(user.uid, listId, items);
  }, [user, lists]);

  const removeFromList = useCallback(async (listId: string, movieId: number) => {
    if (!user) return;
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    const items = list.items.filter(i => i.id !== movieId);
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items } : l));
    await setListItems(user.uid, listId, items);
  }, [user, lists]);

  return { lists, loading, createList, renameList, deleteList, addToList, removeFromList };
}
