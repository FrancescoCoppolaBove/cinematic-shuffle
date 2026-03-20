/**
 * useTonightPick — "Stasera cosa guardo?"
 *
 * SLOT (in ordine di priorità):
 *   Dalla watchlist:
 *     1. "Perfetto per stasera"      — score composito (gusti + contesto)
 *     2. "Disponibile adesso"        — dalla watchlist, sulle tue piattaforme
 *     3. "Il più acclamato"          — massimo voto TMDB in watchlist
 *     4. "Aspetti da più tempo"      — il più vecchio non visto
 *
 *   Dalla libreria vista:
 *     5. "Rivedilo stasera"          — amato ma non rivisto di recente
 *
 *   Da TMDB (scoperta):
 *     6. "Il più chiacchierato"      — trending settimana
 *     7. "Breve e perfetto"          — ≤ 95 min, alta qualità
 *     8. "Stagione giusta"           — tematicamente legato al mese
 *     9. "Consiglio cinefilo"        — cult/underrated
 *    10. "Il mio consiglio"          — calibrato sui gusti, fuori watchlist
 */

import { useState, useEffect, useMemo } from 'react';
import type { WatchedMovie, WatchlistItem } from '../types';
import type { TMDBMovieBasic } from '../types';
import {
  getTrendingThisWeek,
  getCinephilePick,
  getPersonalizedPick,
  getShortQualityPick,
  getSeasonalPick,
  getSeasonalKeyword,
  getWatchlistProviders,
  getTitle,
  getReleaseDate,
} from '../services/tmdb';

export interface TonightPick {
  item: WatchlistItem | TMDBMovieBasic;
  score: number;
  slot: 'tonight' | 'streaming' | 'acclaimed' | 'waiting' | 'rewatch' |
        'trending' | 'short' | 'seasonal' | 'cinephile' | 'personal';
  reason: string;
  reasonEmoji: string;
  fromWatchlist: boolean;
  providerName?: string;   // per slot streaming
  providerLogo?: string;
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

  const genreRaw: Record<number, { sum: number; count: number }> = {};
  for (const m of watched) {
    const score = m.liked ? 5 : (m.personal_rating ?? m.vote_average / 2);
    for (const gid of (m.genre_ids ?? [])) {
      if (!genreRaw[gid]) genreRaw[gid] = { sum: 0, count: 0 };
      genreRaw[gid].sum += score;
      genreRaw[gid].count += 1;
    }
  }
  const entries = Object.entries(genreRaw).map(([id, { sum, count }]) => [Number(id), sum / count] as [number, number]);
  const maxW = Math.max(...entries.map(([, w]) => w), 1);
  const genreWeights: Record<number, number> = {};
  for (const [id, w] of entries) genreWeights[id] = w / maxW;
  const topGenreIds = [...entries].sort(([, a], [, b]) => b - a).slice(0, 3).map(([id]) => id);

  const recent = [...watched].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()).slice(0, 5);
  const recentGenreIds = [...new Set(recent.flatMap(m => m.genre_ids ?? []))];
  const runtimes = goodMovies.filter(m => m.runtime && m.runtime > 0).map(m => m.runtime!);
  const preferredRuntime = runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;
  const avgPersonalRating = rated.length > 0 ? rated.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / rated.length : 3;
  const qualityThreshold = avgPersonalRating >= 4 ? 6.5 : avgPersonalRating >= 3 ? 5.5 : 4.5;

  return { genreWeights, recentGenreIds, preferredRuntime, avgPersonalRating, qualityThreshold, topGenreIds, hasData: watched.length >= 3 };
}

function scoreItem(item: WatchlistItem, taste: TasteProfile, ctx: TimeContext, watchedIds: Set<number>): number {
  if (watchedIds.has(item.id)) return -1;
  let score = 0;
  const genreIds = item.genre_ids ?? [];
  if (genreIds.length > 0 && taste.hasData) {
    score += (genreIds.reduce((s, g) => s + (taste.genreWeights[g] ?? 0), 0) / genreIds.length) * 35;
  }
  score += (item.vote_average / 10) * 25;
  const rt = item.runtime ?? 90;
  const maxRt = ctx.suggestedMaxRuntime;
  score += rt <= maxRt ? (rt / maxRt) * 20 : Math.max(0, 20 - ((rt - maxRt) / 10) * 5);
  const days = (Date.now() - new Date(item.addedAt).getTime()) / 86400000;
  score += days > 30 ? 10 : days > 14 ? 6 : days > 7 ? 3 : 0;
  if (taste.recentGenreIds.length > 0) {
    score += (genreIds.filter(g => taste.recentGenreIds.includes(g)).length / Math.max(1, genreIds.length)) * 10;
  }
  const HORROR = [27, 53, 9648], COMEDY = [35, 10751, 16], DRAMA = [18, 36, 10752], ACTION = [28, 12];
  if (ctx.isLateNight && genreIds.some(g => HORROR.includes(g))) score += 8;
  if (ctx.isAfternoon && genreIds.some(g => COMEDY.includes(g))) score += 6;
  if (ctx.isWeekend && genreIds.some(g => DRAMA.includes(g))) score += 5;
  if (!ctx.isWeekend && ctx.isEvening && genreIds.some(g => ACTION.includes(g))) score += 4;
  return score;
}

function buildWatchlistReason(item: WatchlistItem, slot: TonightPick['slot'], ctx: TimeContext, taste: TasteProfile) {
  const rt = item.runtime;
  const days = Math.floor((Date.now() - new Date(item.addedAt).getTime()) / 86400000);
  const gids = item.genre_ids ?? [];
  const HORROR = [27, 53, 9648], COMEDY = [35, 10751, 16], ACTION = [28, 12], DRAMA = [18, 36];

  if (slot === 'acclaimed') return { reason: `Il più acclamato della tua lista · ${item.vote_average.toFixed(1)}/10`, reasonEmoji: '⭐' };
  if (slot === 'waiting') return days >= 30
    ? { reason: `In watchlist da ${days} giorni — è ora`, reasonEmoji: '⏳' }
    : { reason: `Salvato ${days > 7 ? `${Math.floor(days / 7)} sett.` : `${days} gg`} fa`, reasonEmoji: '📌' };

  const candidates: { reason: string; emoji: string }[] = [];
  if (ctx.isWeekend && rt && rt > 120) candidates.push({ reason: `Weekend ideale per ${rt} min`, emoji: '🎬' });
  if (!ctx.isWeekend && rt && rt <= 100) candidates.push({ reason: `${rt} min, perfetto per questa sera`, emoji: '🌙' });
  if (ctx.isLateNight && gids.some(g => HORROR.includes(g))) candidates.push({ reason: 'Perfetto per la notte — se ti fidi', emoji: '👻' });
  if (ctx.isAfternoon && gids.some(g => COMEDY.includes(g))) candidates.push({ reason: 'Leggero per il pomeriggio', emoji: '☀️' });
  if (gids.some(g => ACTION.includes(g)) && ctx.isEvening) candidates.push({ reason: 'Adrenalina per la serata', emoji: '⚡' });
  if (gids.some(g => DRAMA.includes(g)) && taste.hasData && taste.avgPersonalRating >= 4) candidates.push({ reason: 'In linea con i film che hai amato', emoji: '❤️' });
  if (item.vote_average >= 8) candidates.push({ reason: `Eccellente: ${item.vote_average.toFixed(1)}/10`, emoji: '🏆' });
  if (taste.hasData && gids.filter(g => taste.genreWeights[g] > 0.7).length > 0) candidates.push({ reason: 'Genere che apprezzi particolarmente', emoji: '🎯' });
  if (days > 14) candidates.push({ reason: `In lista da ${days} giorni`, emoji: '📅' });
  const c = candidates[0] ?? { reason: 'Scelto per te questa sera', emoji: '✨' };
  return { reason: c.reason, reasonEmoji: c.emoji };
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

// Mappa provider_id → {name, logo}
const PROVIDER_INFO: Record<number, { name: string; logo: string }> = {
  8:    { name: 'Netflix',       logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  119:  { name: 'Amazon Prime',  logo: '/dQeAar5H991VYporEjUspolDarG.jpg' },
  337:  { name: 'Disney+',       logo: '/7rwgEs15tFwyR9NPQ5vpzxTj19d.jpg' },
  1899: { name: 'Max',           logo: '/Ajqyt5aNxNx8rDHQEhTHcPnNpjw.jpg' },
  35:   { name: 'Apple TV+',     logo: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  531:  { name: 'Paramount+',    logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  39:   { name: 'NOW',           logo: '/ixVmHmFEKhxCG07LMnLBMZMFGlO.jpg' },
  222:  { name: 'Timvision',     logo: '/bZGFHCAPgdD44ByaHFLAlqJGvSl.jpg' },
};

export function useTonightPick(
  watchlist: WatchlistItem[],
  watchedMovies: WatchedMovie[],
  watchedIds: Set<number>,
  favoriteProviderIds: number[] = [],
  seed: number = 0
) {
  const ctx = useMemo(() => getTimeContext(), []);
  const taste = useMemo(() => buildTasteProfile(watchedMovies), [watchedMovies]);

  const [trendingItems, setTrendingItems] = useState<TMDBMovieBasic[]>([]);
  const [shortItems, setShortItems] = useState<TMDBMovieBasic[]>([]);
  const [seasonalItems, setSeasonalItems] = useState<TMDBMovieBasic[]>([]);
  const [cinephileItems, setCinephileItems] = useState<TMDBMovieBasic[]>([]);
  const [personalItems, setPersonalItems] = useState<TMDBMovieBasic[]>([]);
  const [providerMap, setProviderMap] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);

  const allKnownIds = useMemo(() => {
    const ids = new Set(watchedIds);
    watchlist.forEach(i => ids.add(i.id));
    return ids;
  }, [watchedIds, watchlist]);

  useEffect(() => {
    setLoading(true);
    const excludeIds = [...allKnownIds];
    const watchlistItems = watchlist
      .filter(i => !watchedIds.has(i.id))
      .map(i => ({ id: i.id, mediaType: i.media_type }));

    Promise.all([
      getTrendingThisWeek('movie'),
      getShortQualityPick(taste.topGenreIds, excludeIds),
      getSeasonalPick(excludeIds),
      getCinephilePick('movie'),
      getPersonalizedPick(taste.topGenreIds, 'movie', taste.qualityThreshold, excludeIds),
      favoriteProviderIds.length > 0 ? getWatchlistProviders(watchlistItems) : Promise.resolve({} as Record<number, number[]>),
    ]).then(([trending, short, seasonal, cinephile, personal, providers]) => {
      setTrendingItems(trending);
      setShortItems(short);
      setSeasonalItems(seasonal);
      setCinephileItems(cinephile);
      setPersonalItems(personal);
      setProviderMap(providers);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [seed, taste.topGenreIds, taste.qualityThreshold]);

  const picks = useMemo<TonightPick[]>(() => {
    const available = watchlist.filter(i => !watchedIds.has(i.id));
    const result: TonightPick[] = [];
    const usedIds = new Set<number>();

    const scored = available.map(item => ({ item, score: scoreItem(item, taste, ctx, watchedIds) }))
      .sort((a, b) => b.score - a.score);

    if (seed > 0) {
      const offset = (seed * 3) % Math.max(1, scored.length);
      scored.push(...scored.splice(0, offset));
    }

    // SLOT 1: Perfetto per stasera
    const best = scored[0];
    if (best) {
      const { reason, reasonEmoji } = buildWatchlistReason(best.item, 'tonight', ctx, taste);
      result.push({ item: best.item, score: best.score, slot: 'tonight', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(best.item.id);
    }

    // SLOT 2: Disponibile adesso (sulle tue piattaforme) — solo se l'utente ha impostato provider
    if (favoriteProviderIds.length > 0 && Object.keys(providerMap).length > 0) {
      const streaming = available
        .filter(i => !usedIds.has(i.id))
        .map(i => {
          const ids = providerMap[i.id] ?? [];
          const matchedId = ids.find(pid => favoriteProviderIds.includes(pid));
          return { item: i, matchedId };
        })
        .filter(x => x.matchedId !== undefined)
        .sort((a, b) => b.item.vote_average - a.item.vote_average)[0];

      if (streaming) {
        const pInfo = PROVIDER_INFO[streaming.matchedId!];
        result.push({
          item: streaming.item,
          score: streaming.item.vote_average,
          slot: 'streaming',
          reason: `Disponibile su ${pInfo?.name ?? 'una tua piattaforma'} — nessun costo extra`,
          reasonEmoji: '📺',
          fromWatchlist: true,
          providerName: pInfo?.name,
          providerLogo: pInfo?.logo ? `https://image.tmdb.org/t/p/w92${pInfo.logo}` : undefined,
        });
        usedIds.add(streaming.item.id);
      }
    }

    // SLOT 3: Il più acclamato
    const acclaimed = available.filter(i => !usedIds.has(i.id)).sort((a, b) => b.vote_average - a.vote_average)[0];
    if (acclaimed) {
      const { reason, reasonEmoji } = buildWatchlistReason(acclaimed, 'acclaimed', ctx, taste);
      result.push({ item: acclaimed, score: acclaimed.vote_average, slot: 'acclaimed', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(acclaimed.id);
    }

    // SLOT 4: Aspetti da più tempo
    const oldest = available.filter(i => !usedIds.has(i.id)).sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime())[0];
    if (oldest) {
      const { reason, reasonEmoji } = buildWatchlistReason(oldest, 'waiting', ctx, taste);
      result.push({ item: oldest, score: 0, slot: 'waiting', reason, reasonEmoji, fromWatchlist: true });
      usedIds.add(oldest.id);
    }

    // SLOT 5: Rivedilo stasera (dalla libreria visti, amato ma non rivisto di recente)
    const rewatch = [...watchedMovies]
      .filter(m => (m.liked || (m.personal_rating !== null && m.personal_rating >= 4)) && !usedIds.has(m.id))
      .sort((a, b) => {
        // Prioritizza: alto voto personale, poco rivisto, non visto di recente
        const scoreA = (a.personal_rating ?? 3) * 2 - (a.rewatchCount * 0.5);
        const scoreB = (b.personal_rating ?? 3) * 2 - (b.rewatchCount * 0.5);
        return scoreB - scoreA;
      })[0];

    if (rewatch) {
      const rt = rewatch.runtime;
      const reasonText = rewatch.personal_rating === 5
        ? 'Lo hai adorato — perché non rivederlo?'
        : rt && rt <= ctx.suggestedMaxRuntime
          ? `${rt} min e lo hai amato — perfetto da rivedere`
          : 'Vale la pena rivederlo';
      result.push({
        item: {
          id: rewatch.id, title: rewatch.title, original_title: rewatch.original_title,
          poster_path: rewatch.poster_path, release_date: rewatch.release_date,
          vote_average: rewatch.vote_average, genre_ids: rewatch.genre_ids ?? [],
          runtime: rewatch.runtime ?? null, addedAt: rewatch.addedAt, media_type: rewatch.media_type,
        } as WatchlistItem,
        score: rewatch.personal_rating ?? rewatch.vote_average,
        slot: 'rewatch',
        reason: reasonText,
        reasonEmoji: '🔁',
        fromWatchlist: false,
      });
      usedIds.add(rewatch.id);
    }

    // SLOT 6: Il più chiacchierato
    const trending = trendingItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (trending) {
      result.push({ item: toWatchlistLike(trending), score: 0, slot: 'trending', reason: 'Sta facendo parlare di sé questa settimana', reasonEmoji: '🔥', fromWatchlist: false });
      usedIds.add(trending.id);
    }

    // SLOT 7: Breve e perfetto
    const short = shortItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (short) {
      result.push({ item: toWatchlistLike(short), score: short.vote_average, slot: 'short', reason: 'Alta qualità in meno di 95 minuti', reasonEmoji: '⏱️', fromWatchlist: false });
      usedIds.add(short.id);
    }

    // SLOT 8: Stagione giusta
    const seasonal = seasonalItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (seasonal) {
      const sk = getSeasonalKeyword();
      result.push({ item: toWatchlistLike(seasonal), score: seasonal.vote_average, slot: 'seasonal', reason: sk?.label ?? 'Perfetto per questo periodo', reasonEmoji: sk?.emoji ?? '🗓️', fromWatchlist: false });
      usedIds.add(seasonal.id);
    }

    // SLOT 9: Consiglio cinefilo
    const cinephile = cinephileItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (cinephile) {
      result.push({ item: toWatchlistLike(cinephile), score: cinephile.vote_average, slot: 'cinephile', reason: `${cinephile.vote_average.toFixed(1)}/10 · Un gioiello poco conosciuto`, reasonEmoji: '🎞️', fromWatchlist: false });
      usedIds.add(cinephile.id);
    }

    // SLOT 10: Il mio consiglio
    const personal = personalItems.filter(m => !usedIds.has(m.id) && !watchedIds.has(m.id))[0];
    if (personal) {
      result.push({ item: toWatchlistLike(personal), score: personal.vote_average, slot: 'personal', reason: taste.hasData ? 'Scelto per te in base ai tuoi gusti' : `${personal.vote_average.toFixed(1)}/10 · Vale la pena`, reasonEmoji: '💡', fromWatchlist: false });
    }

    return result;
  }, [watchlist, watchedIds, watchedMovies, taste, ctx, seed, favoriteProviderIds, providerMap, trendingItems, shortItems, seasonalItems, cinephileItems, personalItems]);

  return { picks, ctx, taste, hasPicks: picks.length > 0, loading };
}
