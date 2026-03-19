import {
  doc, setDoc, deleteDoc, collection, getDocs,
  serverTimestamp, Timestamp, type FieldValue,
} from 'firebase/firestore';
import { db } from './firebase';
import type { WatchedMovie, WatchlistItem } from '../types';

// ─── Refs ─────────────────────────────────────────────────────────
const watchedRef   = (uid: string, id: number) => doc(db, 'users', uid, 'watched',   String(id));
const watchlistRef = (uid: string, id: number) => doc(db, 'users', uid, 'watchlist', String(id));
const watchedCol   = (uid: string) => collection(db, 'users', uid, 'watched');
const watchlistCol = (uid: string) => collection(db, 'users', uid, 'watchlist');

function toISOString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

// ─── Watched ──────────────────────────────────────────────────────

export async function fetchWatchedMovies(uid: string): Promise<WatchedMovie[]> {
  const snap = await getDocs(watchedCol(uid));
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: data.id as number,
        title: data.title as string,
        poster_path: data.poster_path as string | null,
        release_date: (data.release_date as string) || '',
        vote_average: data.vote_average as number,
        personal_rating: (data.personal_rating as number | null) ?? null,
        liked: (data.liked as boolean) ?? false,
        rewatchCount: (data.rewatchCount as number) ?? 0,
        media_type: (data.media_type as 'movie' | 'tv') ?? 'movie',
        addedAt: toISOString(data.addedAt),
      } satisfies WatchedMovie;
    })
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export async function addWatchedToFirestore(uid: string, movie: Omit<WatchedMovie, 'addedAt'>) {
  await setDoc(watchedRef(uid, movie.id), {
    ...movie,
    addedAt: serverTimestamp() as FieldValue,
  }, { merge: true });
}

export async function updateRewatchCount(uid: string, movieId: number, count: number) {
  await setDoc(watchedRef(uid, movieId), { rewatchCount: count }, { merge: true });
}

export async function updateLiked(uid: string, movieId: number, liked: boolean) {
  await setDoc(watchedRef(uid, movieId), { liked }, { merge: true });
}

export async function removeWatchedFromFirestore(uid: string, movieId: number) {
  await deleteDoc(watchedRef(uid, movieId));
}

export async function updatePersonalRating(uid: string, movieId: number, rating: number | null) {
  await setDoc(watchedRef(uid, movieId), { personal_rating: rating }, { merge: true });
}

// ─── Watchlist ────────────────────────────────────────────────────

export async function fetchWatchlist(uid: string): Promise<WatchlistItem[]> {
  const snap = await getDocs(watchlistCol(uid));
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        id: data.id as number,
        title: data.title as string,
        poster_path: data.poster_path as string | null,
        release_date: (data.release_date as string) || '',
        vote_average: data.vote_average as number,
        media_type: (data.media_type as 'movie' | 'tv') ?? 'movie',
        addedAt: toISOString(data.addedAt),
      } satisfies WatchlistItem;
    })
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export async function addToWatchlistFirestore(uid: string, item: Omit<WatchlistItem, 'addedAt'>) {
  await setDoc(watchlistRef(uid, item.id), {
    ...item,
    addedAt: serverTimestamp() as FieldValue,
  });
}

export async function removeFromWatchlistFirestore(uid: string, itemId: number) {
  await deleteDoc(watchlistRef(uid, itemId));
}
