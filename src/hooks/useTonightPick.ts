/**
 * useTonightPick — "Stasera cosa guardo?"
 *
 * CINQUE SLOT:
 *   1. "Perfetto per stasera"  — dalla watchlist, score composito (gusti + contesto)
 *   2. "Il più acclamato"      — dalla watchlist, massimo voto TMDB
 *   3. "Aspetti da più tempo"  — dalla watchlist, il più vecchio non visto
 *   4. "Il più chiacchierato"  — TMDB trending settimana, non già visto
 *   5. "Consiglio cinefilo"    — TMDB cult/underrated (alto voto, bassa popolarità)
 *   6. "Il mio consiglio"      — fuori watchlist, calibrato sui gusti personali
 */

import { useState, useEffect, useMemo } from 'react';
import type { WatchedMovie, WatchlistItem } from '../types';
import type { TMDBMovieBasic } from '../types';
import {
  getTrendingThisWeek,
  getCinephilePick,
  getPersonalizedPick,
  getTitle,
  getReleaseDate,
} from '../services/tmdb';

export interface TonightPick {
  item: WatchlistItem | TMDBMovieBasic;
  score: number;
  slot: 'tonight' | 'acclaimed' | 'waiting' | 'trending' | 'cinephile' | 'personal';
  reason: string;
  reasonEmoji: string;
  fromWatchlist: boolean;
}

interface TimeContext {
  hour: number;
  isWeekend: boolean;
  isLateNight: boolean;
  isAfternoon: boolean;
  isEvening: boolean;
  suggestedMaxRuntime: number;
}

export interface TasteProfile {
  genreWeights: Record<number, number>;
  recentGenreIds: number[];
  preferredRuntime: number | null;
  avgPersonalRating: number;
  qualityThreshold: number;
  topGenreIds: number[];
  hasData: boolean;
}

function getTimeContext(): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 5 || day === 6;
  return {
    hour,
    isWeekend,
    isLateNight: hour >= 22 || hour < 2,
    isAfternoon: hour >= 14 && hour < 18,
    isEvening: hour >= 18 && hour < 22,
    suggestedMaxRuntime: isWeekend ? 180 : hour >= 22 ? 100 : 130,
  };
}

export function buildTasteProfile(watched: WatchedMovie[]): TasteProfile {
  if (watched.length === 0) {
    return { genreWeights: {}, recentGenreIds: [], preferredRuntime: null,
      avgPersonalRating: 3, qualityThreshold: 5, topGenreIds: [], hasData: false };
  }

  const goodMovies = watched.filter(m => m.liked || (m.personal_rating !== null && m.personal_rating >= 4));
  const rated = watched.filter(m => m.personal_rating !== null);

  // Genre weights from all watched, weighted by quality
  const genreRaw: Record<number, { sum: number; count: number }> = {};
  for (const m of watched) {
    const score = m.liked ? 5 : (m.personal_rating ?? m.vote_average / 2);
    for (const gid of (m.genre_ids ?? [])) {
      if (!genreRaw[gid]) genreRaw[gid] = { sum: 0, count: 0 };
      genreRaw[gid].sum += score;
      genreRaw[gid].count += 1;
    }
  }
  const entries = Object.entries(genreRaw)
    .map(([id, { sum, count }]) => [Number(id), sum / count] as [number, number]);
  const maxW = Math.max(...entries.map(([, w]) => w), 1);
  const genreWeights: Record<number, number> = {};
  for (const [id, w] of entries) genreWeights[id] = w / maxW;

  // Top 3 genre IDs for external queries
  const topGenreIds = entries
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => id);

  // Recent mood
  const recent = [...watched]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, 5);
  const recentGenreIds = [...new Set(recent.flatMap(m => m.genre_ids ?? []))];

  // Preferred runtime
  const runtimes = goodMovies.filter(m => m.runtime && m.runtime > 0).map(m => m.runtime!);
  const preferredRuntime = runtimes.length > 0
    ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;

  const avgPersonalRating = rated.length > 0
    ? rated.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / rated.length : 3;

  const qualityThreshold = avgPersonalRating >= 4 ? 6.5 : avgPersonalRating >= 3 ? 5.5 : 4.5;

  return { genreWeights, recentGenreIds, preferredRuntime, avgPersonalRating, qualityThreshold, topGenreIds, hasData: watched.length >= 3 };
}

function scoreItem(
  item: WatchlistItem,
  taste: TasteProfile,
  ctx: TimeContext,
  watchedIds: Set<number>
): number {
  if (watchedIds.has(item.id)) return -1;
  let score = 0;

  const genreIds = item.genre_ids ?? [];
  if (genreIds.length > 0 && taste.hasData) {
    const genreScore = genreIds.reduce((s, gid) => s + (taste.genreWeights[gid] ?? 0), 0) / genreIds.length;
    score += genreScore * 35;
  }
  score += (item.vote_average / 10) * 25;

  const runtime = item.runtime ?? 90;
  const maxRt = ctx.suggestedMaxRuntime;
  score += runtime <= maxRt ? (runtime / maxRt) * 20 : Math.max(0, 20 - ((runtime - maxRt) / 10) * 5);

  const daysInWatchlist = (Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24);
  score += daysInWatchlist > 30 ? 10 : daysInWatchlist > 14 ? 6 : daysInWatchlist > 7 ? 3 : 0;

  if (taste.recentGenreIds.length > 0) {
    const recentMatch = genreIds.filter(g => taste.recentGenreIds.includes(g)).length;
    score += (recentMatch / Math.max(1, genreIds.length)) * 10;
  }

  const HORROR = [27, 53, 9648], COMEDY = [35, 10751, 16], DRAMA = [18, 36, 10752], ACTION = [28, 12];
  if (ctx.isLateNight && genreIds.some(g => HORROR.includes(g))) score += 8;
  if (ctx.isAfternoon && genreIds.some(g => COMEDY.includes(g))) score += 6;
  if (ctx.isWeekend && genreIds.some(g => DRAMA.includes(g))) score += 5;
  if (!ctx.isWeekend && ctx.isEvening && genreIds.some(g => ACTION.includes(g))) score += 4;

  return score;
}

function buildWatchlistReason(item: WatchlistItem, slot: TonightPick['slot'], ctx: TimeContext, taste: TasteProfile) {
  const runtime = item.runtime;
  const daysWaiting = Math.floor((Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24));
  const gids = item.genre_ids ?? [];
  const HORROR = [27, 53, 9648], COMEDY = [35, 10751, 16], ACTION = [28, 12], DRAMA = [18, 36];

  if (slot === 'acclaimed') return { reason: `Il più acclamato della tua lista · ${item.vote_average.toFixed(1)}/10 TMDB`, reasonEmoji: '⭐' };
  if (slot === 'waiting') {
    return daysWaiting >= 30
      ? { reason: `In watchlist da ${daysWaiting} giorni — è ora`, reasonEmoji: '⏳' }
      : { reason: `Salvato ${daysWaiting > 7 ? `${Math.floor(daysWaiting / 7)} sett.` : `${daysWaiting} gg`} fa`, reasonEmoji: '📌' };
  }
  // slot === 'tonight'
  const candidates: { reason: string; emoji: string }[] = [];
  if (ctx.isWeekend && runtime && runtime > 120) candidates.push({ reason: `Weekend ideale per ${runtime} min`, emoji: '🎬' });
  if (!ctx.isWeekend && runtime && runtime <= 100) candidates.push({ reason: `${runtime} min perfetti per questa sera`, emoji: '🌙' });
  if (ctx.isLateNight && gids.some(g => HORROR.includes(g))) candidates.push({ reason: 'Perfetto per la notte — se ti fidi', emoji: '👻' });
  if (ctx.isAfternoon && gids.some(g => COMEDY.includes(g))) candidates.push({ reason: 'Leggero e perfetto per il pomeriggio', emoji: '☀️' });
  if (gids.some(g => ACTION.includes(g)) && ctx.isEvening) candidates.push({ reason: 'Adrenalina per la serata', emoji: '⚡' });
  if (gids.some(g => DRAMA.includes(g)) && taste.hasData && taste.avgPersonalRating >= 4) candidates.push({ reason: 'In linea con i film che hai amato', emoji: '❤️' });
  if (item.vote_average >= 8) candidates.push({ reason: `Eccellente: ${item.vote_average.toFixed(1)}/10 su TMDB`, emoji: '🏆' });
  if (taste.hasData) {
    const match = gids.filter(g => taste.genreWeights[g] > 0.7).length;
    if (match > 0) candidates.push({ reason: 'Genere che apprezzi particolarmente', emoji: '🎯' });
  }
  if (daysWaiting > 14) candidates.push({ reason: `In lista da ${daysWaiting} giorni`, emoji: '📅' });
  const chosen = candidates[0] ?? { reason: 'Scelto per te questa sera', emoji: '✨' };
  return { reason: chosen.reason, reasonEmoji: chosen.emoji };
}

function toWatchlistLike(m: TMDBMovieBasic): WatchlistItem {
  return {
    id: m.id,
    title: getTitle(m),
    poster_path: m.poster_path,
    release_date: getReleaseDate(m),
    vote_average: m.vote_average,
    genre_ids: m.genre_ids ?? [],
    runtime: null,
    addedAt: new Date().toISOString(),
    media_type: (m.media_type as 'movie' | 'tv') ?? 'movie',
  };
}

export function useTonightPick(
  watchlist: WatchlistItem[],
  watchedMovies: WatchedMovie[],
  watchedIds: Set<number>,
  seed: number = 0
) {
  const ctx = useMemo(() => getTimeContext(), []);
  const taste = useMemo(() => buildTasteProfile(watchedMovies), [watchedMovies]);

  // External picks fetched from TMDB
  const [trendingItems, setTrendingItems] = useState<TMDBMovieBasic[]>([]);
  const [cinephileItems, setCinephileItems] = useState<TMDBMovieBasic[]>([]);
  const [personalItems, setPersonalItems] = useState<TMDBMovieBasic[]>([]);
  const [loading, setLoading] = useState(true);

  const allKnownIds = useMemo(() => {
    const ids = new Set(watchedIds);
    watchlist.forEach(i => ids.add(i.id));
    return ids;
  }, [watchedIds, watchlist]);

  useEffect(() => {
    setLoading(true);
    const mediaType = 'movie';
    const excludeIds = [...allKnownIds];

    Promise.all([
      getTrendingThisWeek(mediaType),
      getCinephilePick(mediaType),
      getPersonalizedPick(taste.topGenreIds, mediaType, taste.qualityThreshold, excludeIds),
    ]).then(([trending, cinephile, personal]) => {
      setTrendingItems(trending);
      setCinephileItems(cinephile);
      setPersonalItems(personal);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [seed]); // refetch when user refreshes

  const picks = useMemo<TonightPick[]>(() => {
    const available = watchlist.filter(i => !watchedIds.has(i.id));
    const result: TonightPick[] = [];
    const usedIds = new Set<number>();

    const scored = available.map(item => ({
      item, score: scoreItem(item, taste, ctx, watchedIds),
    })).sort((a, b) => b.score - a.score);

    if (seed > 0) {
      const offset = (seed * 3) % Math.max(1, scored.length);
      scored.push(...scored.splice(0, offset));
    }

    // SLOT 1: Perfetto per stasera (watchlist)
    const best = scored[0];
    if (best) {
      const { reason, reasonEmoji } = buildWatchlistReason(best.item, 'tonight', ctx, taste);
      result.push({ item: best.item, score: best.score, slot: 'tonight', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(best.item.id);
    }

    // SLOT 2: Il più acclamato (watchlist)
    const acclaimed = available.filter(i => !usedIds.has(i.id))
      .sort((a, b) => b.vote_average - a.vote_average)[0];
    if (acclaimed && acclaimed.id !== best?.item.id) {
      const { reason, reasonEmoji } = buildWatchlistReason(acclaimed, 'acclaimed', ctx, taste);
      result.push({ item: acclaimed, score: acclaimed.vote_average, slot: 'acclaimed', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(acclaimed.id);
    }

    // SLOT 3: Aspetti da più tempo (watchlist)
    const oldest = available.filter(i => !usedIds.has(i.id))
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime())[0];
    if (oldest) {
      const { reason, reasonEmoji } = buildWatchlistReason(oldest, 'waiting', ctx, taste);
      result.push({ item: oldest, score: 0, slot: 'waiting', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(oldest.id);
    }

    // SLOT 4: Il più chiacchierato (TMDB trending)
    const trending = trendingItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (trending) {
      result.push({
        item: toWatchlistLike(trending),
        score: trending.vote_count ?? 0,
        slot: 'trending',
        reason: 'Sta facendo parlare di sé questa settimana',
        reasonEmoji: '🔥',
        fromWatchlist: false,
      });
      usedIds.add(trending.id);
    }

    // SLOT 5: Consiglio cinefilo (cult/underrated)
    const cinephile = cinephileItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (cinephile) {
      result.push({
        item: toWatchlistLike(cinephile),
        score: cinephile.vote_average,
        slot: 'cinephile',
        reason: `${cinephile.vote_average.toFixed(1)}/10 · Un gioiello poco conosciuto`,
        reasonEmoji: '🎞️',
        fromWatchlist: false,
      });
      usedIds.add(cinephile.id);
    }

    // SLOT 6: Il mio consiglio (personalizzato da gusti, fuori watchlist)
    const personal = personalItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (personal) {
      result.push({
        item: toWatchlistLike(personal),
        score: personal.vote_average,
        slot: 'personal',
        reason: taste.hasData
          ? 'Scelto per te in base ai tuoi gusti'
          : `${personal.vote_average.toFixed(1)}/10 · Vale la pena`,
        reasonEmoji: '💡',
        fromWatchlist: false,
      });
    }

    return result;
  }, [watchlist, watchedIds, taste, ctx, seed, trendingItems, cinephileItems, personalItems]);

  return { picks, ctx, taste, hasPicks: picks.length > 0, loading };
}
