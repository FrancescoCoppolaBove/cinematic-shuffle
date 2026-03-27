import {
  doc, setDoc, deleteDoc, collection, getDocs, getDoc,
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
        genre_ids: (data.genre_ids as number[]) ?? [],
        runtime: (data.runtime as number | null) ?? null,
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
        genre_ids: (data.genre_ids as number[]) ?? [],
        runtime: (data.runtime as number | null) ?? null,
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

// ─── User Preferences ──────────────────────────────────────────────


export interface UserPreferences {
  favoriteProviderIds: number[];   // provider IDs selezionati dall'utente
}

const prefsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'preferences');

export async function fetchUserPreferences(uid: string): Promise<UserPreferences> {
  try {
    const snap = await getDoc(prefsRef(uid));
    if (!snap.exists()) return { favoriteProviderIds: [] };
    const data = snap.data();
    return { favoriteProviderIds: (data.favoriteProviderIds as number[]) ?? [] };
  } catch { return { favoriteProviderIds: [] }; }
}

export async function saveUserPreferences(uid: string, prefs: UserPreferences): Promise<void> {
  await setDoc(prefsRef(uid), prefs, { merge: true });
}

// ── Episode tracking ──────────────────────────────────────────────
const episodesRef = (uid: string, seriesId: number) =>
  doc(db, 'users', uid, 'watchedEpisodes', String(seriesId));

export async function fetchWatchedEpisodes(uid: string, seriesId: number): Promise<Set<string>> {
  const snap = await getDoc(episodesRef(uid, seriesId));
  if (!snap.exists()) return new Set();
  const data = snap.data();
  return new Set<string>(data.episodes ?? []);
}

export async function toggleWatchedEpisode(
  uid: string, seriesId: number, key: string, allKeys: Set<string>
): Promise<Set<string>> {
  const next = new Set(allKeys);
  if (next.has(key)) next.delete(key); else next.add(key);
  await setDoc(episodesRef(uid, seriesId), { episodes: Array.from(next) }, { merge: false });
  return next;
}

export async function markAllEpisodesInSeason(
  uid: string, seriesId: number, seasonKeys: string[], allKeys: Set<string>
): Promise<Set<string>> {
  const next = new Set(allKeys);
  const allWatched = seasonKeys.every(k => next.has(k));
  if (allWatched) seasonKeys.forEach(k => next.delete(k));
  else seasonKeys.forEach(k => next.add(k));
  await setDoc(episodesRef(uid, seriesId), { episodes: Array.from(next) }, { merge: false });
  return next;
}

// ── TV Series Status ──────────────────────────────────────────────
export type TVSeriesStatus = 'following' | 'completed';

const tvStatusRef = (uid: string, seriesId: number) =>
  doc(db, 'users', uid, 'tvStatus', String(seriesId));
const tvStatusCol = (uid: string) =>
  collection(db, 'users', uid, 'tvStatus');

export async function fetchAllTVStatus(uid: string): Promise<Map<number, TVSeriesStatus>> {
  const snap = await getDocs(tvStatusCol(uid));
  const map = new Map<number, TVSeriesStatus>();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.status) map.set(Number(d.id), data.status as TVSeriesStatus);
  });
  return map;
}

export async function setTVStatus(uid: string, seriesId: number, status: TVSeriesStatus | null): Promise<void> {
  if (status === null) {
    await deleteDoc(tvStatusRef(uid, seriesId));
  } else {
    await setDoc(tvStatusRef(uid, seriesId), { status });
  }
}

export async function markAllEpisodesCompleted(
  uid: string,
  seriesId: number,
  seasons: { season_number: number; episode_count: number }[]
): Promise<Set<string>> {
  // Build all episode keys for all valid seasons (season_number > 0)
  const allKeys: string[] = [];
  seasons
    .filter(s => s.season_number > 0 && s.episode_count > 0)
    .forEach(s => {
      for (let ep = 1; ep <= s.episode_count; ep++) {
        allKeys.push(`${s.season_number}_${ep}`);
      }
    });
  const epSet = new Set(allKeys);
  await setDoc(
    doc(db, 'users', uid, 'watchedEpisodes', String(seriesId)),
    { episodes: Array.from(epSet) },
    { merge: false }
  );
  await setTVStatus(uid, seriesId, 'completed');
  return epSet;
}

export async function clearAllEpisodes(uid: string, seriesId: number): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'watchedEpisodes', String(seriesId)));
}
