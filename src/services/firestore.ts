import {
  doc, setDoc, deleteDoc, collection, getDocs, getDoc,
  serverTimestamp, Timestamp, type FieldValue,
  query, where, limit, addDoc, updateDoc, increment,
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

// ─── Types ────────────────────────────────────────────────────────
export interface Review {
  id: string;
  movieId: number;
  mediaType: 'movie' | 'tv';
  movieTitle: string;
  moviePosterPath: string | null;
  movieReleaseDate: string;
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  rating: number | null;
  liked: boolean;
  text: string;
  watchedOn: string | null;       // ISO date when user actually watched
  firstView: boolean;             // first time watching
  hasSpoilers: boolean;
  repliesAllowed: 'all' | 'following' | 'none';
  likes: number;
  dislikes: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  text: string;
  createdAt: string;
}

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  followersCount: number;
  followingCount: number;
  moviesWatchedCount: number;
  reviewsCount: number;
}

// ─── Reviews ──────────────────────────────────────────────────────
const reviewsCol = () => collection(db, 'reviews');
const reviewDoc = (id: string) => doc(db, 'reviews', id);
const reviewLikesCol = () => collection(db, 'reviewLikes');
const reviewLikeDoc = (reviewId: string, uid: string) =>
  doc(db, 'reviewLikes', `${reviewId}_${uid}`);
const repliesCol = () => collection(db, 'reviewReplies');
const followCol = (uid: string) => collection(db, 'users', uid, 'following');
const followerCol = (uid: string) => collection(db, 'users', uid, 'followers');
const userPublicDoc = (uid: string) => doc(db, 'userPublic', uid);

function toISO(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val && typeof val === 'object' && 'seconds' in val)
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function docToReview(d: import('firebase/firestore').DocumentSnapshot): Review {
  const data = d.data()!;
  return {
    id: d.id,
    movieId: data.movieId,
    mediaType: data.mediaType ?? 'movie',
    movieTitle: data.movieTitle ?? '',
    moviePosterPath: data.moviePosterPath ?? null,
    movieReleaseDate: data.movieReleaseDate ?? '',
    userId: data.userId,
    userName: data.userName ?? 'Anonymous',
    userPhotoURL: data.userPhotoURL ?? null,
    rating: data.rating ?? null,
    liked: data.liked ?? false,
    text: data.text ?? '',
    watchedOn: data.watchedOn ?? null,
    firstView: data.firstView ?? true,
    hasSpoilers: data.hasSpoilers ?? false,
    repliesAllowed: data.repliesAllowed ?? 'all',
    likes: data.likes ?? 0,
    dislikes: data.dislikes ?? 0,
    replyCount: data.replyCount ?? 0,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt ?? data.createdAt),
  };
}

export type ReviewSortMode =
  | 'popular'        // likes desc (default)
  | 'highest'        // rating desc
  | 'lowest'         // rating asc
  | 'newest'         // createdAt desc
  | 'friends';       // liked by following (client-side filter)

export async function fetchReviewsForMovie(
  movieId: number,
  sortMode: ReviewSortMode = 'popular',
  maxResults = 50
): Promise<Review[]> {
  // Use simple single-field query to avoid composite index requirement.
  // Sort client-side for flexibility.
  const q = query(
    reviewsCol(),
    where('movieId', '==', movieId),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  const reviews = snap.docs.filter(d => d.exists()).map(docToReview);

  // Client-side sort by selected mode
  switch (sortMode) {
    case 'highest':
      return reviews.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'lowest':
      return reviews.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
    case 'newest':
      return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    default: // popular + friends
      return reviews.sort((a, b) => (b.likes - a.likes) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }
}

export async function fetchUserReview(uid: string, movieId: number): Promise<Review | null> {
  const q = query(reviewsCol(), where('movieId', '==', movieId), where('userId', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToReview(snap.docs[0]);
}

export async function saveReview(
  uid: string,
  data: Omit<Review, 'id' | 'likes' | 'dislikes' | 'replyCount' | 'createdAt' | 'updatedAt'>
): Promise<Review> {
  // Check if user already has a review for this movie
  const existing = await fetchUserReview(uid, data.movieId);
  if (existing) {
    // Update existing
    await updateDoc(reviewDoc(existing.id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { ...existing, ...data, updatedAt: new Date().toISOString() };
  } else {
    // Create new
    const ref = await addDoc(reviewsCol(), {
      ...data,
      likes: 0,
      dislikes: 0,
      replyCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Update user public stats — ensure doc exists first with setDoc merge
    try {
      await setDoc(userPublicDoc(uid), { reviewsCount: increment(1) }, { merge: true });
    } catch { /* silent */ }
    const snap = await getDoc(ref);
    return docToReview(snap);
  }
}

export async function deleteReview(reviewId: string, uid: string): Promise<void> {
  await deleteDoc(reviewDoc(reviewId));
  try {
    await setDoc(userPublicDoc(uid), { reviewsCount: increment(-1) }, { merge: true });
  } catch { /* silent */ }
}

export async function voteReview(
  reviewId: string,
  uid: string,
  voteType: 'like' | 'dislike' | null
): Promise<void> {
  const likeRef = reviewLikeDoc(reviewId, uid);
  const existing = await getDoc(likeRef);
  
  if (existing.exists()) {
    const prev = existing.data().type as 'like' | 'dislike';
    if (voteType === null || prev === voteType) {
      // Remove vote
      await deleteDoc(likeRef);
      await updateDoc(reviewDoc(reviewId), { [prev === 'like' ? 'likes' : 'dislikes']: increment(-1) });
    } else {
      // Switch vote
      await setDoc(likeRef, { type: voteType, uid });
      await updateDoc(reviewDoc(reviewId), {
        [prev === 'like' ? 'likes' : 'dislikes']: increment(-1),
        [voteType === 'like' ? 'likes' : 'dislikes']: increment(1),
      });
    }
  } else if (voteType) {
    await setDoc(likeRef, { type: voteType, uid });
    await updateDoc(reviewDoc(reviewId), { [voteType === 'like' ? 'likes' : 'dislikes']: increment(1) });
  }
}

export async function fetchUserVote(reviewId: string, uid: string): Promise<'like' | 'dislike' | null> {
  const snap = await getDoc(reviewLikeDoc(reviewId, uid));
  if (!snap.exists()) return null;
  return snap.data().type as 'like' | 'dislike';
}

export async function fetchUserVotesForMovie(uid: string, _movieId: number): Promise<Map<string, 'like' | 'dislike'>> {
  const q = query(reviewLikesCol(), where('uid', '==', uid));
  const snap = await getDocs(q);
  const map = new Map<string, 'like' | 'dislike'>();
  snap.docs.forEach(d => {
    const reviewId = d.id.split('_').slice(0, -1).join('_'); // remove uid suffix
    map.set(reviewId, d.data().type);
  });
  return map;
}

// ─── Replies ──────────────────────────────────────────────────────
export async function fetchReplies(reviewId: string): Promise<ReviewReply[]> {
  // Simple query without orderBy to avoid composite index requirement
  const q = query(repliesCol(), where('reviewId', '==', reviewId), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    reviewId: d.data().reviewId,
    userId: d.data().userId,
    userName: d.data().userName ?? 'Anonymous',
    userPhotoURL: d.data().userPhotoURL ?? null,
    text: d.data().text,
    createdAt: toISO(d.data().createdAt),
  })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function addReply(
  reviewId: string,
  uid: string,
  userName: string,
  userPhotoURL: string | null,
  text: string
): Promise<ReviewReply> {
  const ref = await addDoc(repliesCol(), {
    reviewId, userId: uid, userName, userPhotoURL, text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(reviewDoc(reviewId), { replyCount: increment(1) });
  return { id: ref.id, reviewId, userId: uid, userName, userPhotoURL, text, createdAt: new Date().toISOString() };
}

// ─── User Public Profiles ─────────────────────────────────────────
export async function fetchUserPublicProfile(uid: string): Promise<UserPublicProfile | null> {
  const snap = await getDoc(userPublicDoc(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    displayName: d.displayName ?? 'User',
    photoURL: d.photoURL ?? null,
    bio: d.bio ?? '',
    followersCount: d.followersCount ?? 0,
    followingCount: d.followingCount ?? 0,
    moviesWatchedCount: d.moviesWatchedCount ?? 0,
    reviewsCount: d.reviewsCount ?? 0,
  };
}

export async function upsertUserPublicProfile(
  uid: string,
  profile: Partial<Omit<UserPublicProfile, 'uid'>>
): Promise<void> {
  await setDoc(userPublicDoc(uid), profile, { merge: true });
}

// ─── Following ────────────────────────────────────────────────────
export async function followUser(myUid: string, targetUid: string): Promise<void> {
  await setDoc(doc(followCol(myUid), targetUid), { followedAt: serverTimestamp() });
  await setDoc(doc(followerCol(targetUid), myUid), { followedAt: serverTimestamp() });
  await updateDoc(userPublicDoc(myUid), { followingCount: increment(1) });
  await updateDoc(userPublicDoc(targetUid), { followersCount: increment(1) });
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  await deleteDoc(doc(followCol(myUid), targetUid));
  await deleteDoc(doc(followerCol(targetUid), myUid));
  await updateDoc(userPublicDoc(myUid), { followingCount: increment(-1) });
  await updateDoc(userPublicDoc(targetUid), { followersCount: increment(-1) });
}

export async function fetchFollowing(uid: string): Promise<string[]> {
  const snap = await getDocs(followCol(uid));
  return snap.docs.map(d => d.id);
}

export async function fetchFollowers(uid: string): Promise<string[]> {
  const snap = await getDocs(followerCol(uid));
  return snap.docs.map(d => d.id);
}

export async function isFollowing(myUid: string, targetUid: string): Promise<boolean> {
  const snap = await getDoc(doc(followCol(myUid), targetUid));
  return snap.exists();
}

export async function fetchUserReviews(uid: string, maxResults = 20): Promise<Review[]> {
  // Simple query without orderBy to avoid composite index requirement
  const q = query(reviewsCol(), where('userId', '==', uid), limit(maxResults));
  const snap = await getDocs(q);
  return snap.docs
    .filter(d => d.exists())
    .map(docToReview)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
