import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { WatchedMovie } from '../types';

// ─── Struttura Firestore ───────────────────────────────────────────
// users/{uid}/watched/{movieId}  →  WatchedMovieDoc
// ──────────────────────────────────────────────────────────────────

export interface WatchedMovieDoc {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;          // voto TMDB
  personal_rating: number | null; // voto personale 1-5 stelle
  addedAt: Timestamp | null;
}

function watchedRef(uid: string, movieId: number) {
  return doc(db, 'users', uid, 'watched', String(movieId));
}

function watchedColRef(uid: string) {
  return collection(db, 'users', uid, 'watched');
}

// ─── Read ──────────────────────────────────────────────────────────

export async function fetchWatchedMovies(uid: string): Promise<WatchedMovie[]> {
  const snap = await getDocs(watchedColRef(uid));
  return snap.docs
    .map(d => {
      const data = d.data() as WatchedMovieDoc;
      return {
        id: data.id,
        title: data.title,
        poster_path: data.poster_path,
        release_date: data.release_date,
        vote_average: data.vote_average,
        personal_rating: data.personal_rating ?? null,
        addedAt: data.addedAt instanceof Timestamp
          ? data.addedAt.toDate().toISOString()
          : new Date().toISOString(),
      } satisfies WatchedMovie;
    })
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

// ─── Write ─────────────────────────────────────────────────────────

export async function addWatchedMovieToFirestore(
  uid: string,
  movie: Omit<WatchedMovie, 'addedAt'>,
  personalRating: number | null = null
): Promise<void> {
  const payload: WatchedMovieDoc = {
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    personal_rating: personalRating,
    addedAt: serverTimestamp() as unknown as Timestamp,
  };
  await setDoc(watchedRef(uid, movie.id), payload, { merge: true });
}

export async function updatePersonalRating(
  uid: string,
  movieId: number,
  rating: number | null
): Promise<void> {
  await setDoc(watchedRef(uid, movieId), { personal_rating: rating }, { merge: true });
}

export async function removeWatchedMovieFromFirestore(
  uid: string,
  movieId: number
): Promise<void> {
  await deleteDoc(watchedRef(uid, movieId));
}

// ─── Migrazione localStorage → Firestore ───────────────────────────

const LS_KEY = 'cinematic_watched_movies';
const LS_MIGRATED_KEY = 'cinematic_ls_migrated';

interface LegacyWatchedMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  addedAt: string;
}

export async function migrateLocalStorageToFirestore(uid: string): Promise<number> {
  // Già migrato per questo uid
  if (localStorage.getItem(`${LS_MIGRATED_KEY}_${uid}`) === 'true') return 0;

  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    localStorage.setItem(`${LS_MIGRATED_KEY}_${uid}`, 'true');
    return 0;
  }

  let movies: LegacyWatchedMovie[] = [];
  try {
    movies = JSON.parse(raw) as LegacyWatchedMovie[];
  } catch {
    return 0;
  }

  if (movies.length === 0) {
    localStorage.setItem(`${LS_MIGRATED_KEY}_${uid}`, 'true');
    return 0;
  }

  // Batch write per efficienza (Firestore limita a 500 per batch)
  const batches: ReturnType<typeof writeBatch>[] = [];
  let current = writeBatch(db);
  let count = 0;

  for (const movie of movies) {
    const ref = watchedRef(uid, movie.id);
    const payload: WatchedMovieDoc = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      personal_rating: null,
      addedAt: Timestamp.fromDate(new Date(movie.addedAt)),
    };
    current.set(ref, payload, { merge: true });
    count++;

    if (count % 499 === 0) {
      batches.push(current);
      current = writeBatch(db);
    }
  }
  batches.push(current);

  await Promise.all(batches.map(b => b.commit()));
  localStorage.setItem(`${LS_MIGRATED_KEY}_${uid}`, 'true');

  return movies.length;
}
