/**
 * useTonightPick — "Stasera cosa guardo?"
 *
 * Algoritmo di scoring multi-dimensionale applicato alla watchlist.
 * Restituisce 3 pick con motivazioni diverse, non ripetibili nella stessa sessione.
 *
 * ═══ SEGNALI USATI ═══
 *
 * Dal profilo utente (watchedMovies):
 *   - Generi preferiti: genre_ids dei film liked o votati ≥ 4★
 *   - Decennio preferito: da film liked/votati bene
 *   - Soglia qualità personale: voto medio che l'utente assegna
 *   - Mood recente: generi degli ultimi 5 film visti (trend a breve termine)
 *
 * Dal contesto temporale:
 *   - Ora del giorno: tarda notte → horror/thriller; pomeriggio → commedia/animazione
 *   - Giorno settimana: weekend → film lunghi/impegnativi; infrasettimanale → < 110 min
 *
 * Dal film in watchlist:
 *   - Voto TMDB: qualità oggettiva
 *   - Età in watchlist: film salvati da >30gg ricevono un bonus "priorità"
 *   - Durata: confrontata con il contesto temporale
 *   - Genere match: quanto il film si allinea ai gusti profilati
 *   - Affinità voto TMDB / aspettativa utente
 *
 * ═══ TRE SLOT CON RUOLI DIVERSI ═══
 *
 *   SLOT 1 "Perfetto per stasera" — massimo score composito considerando TUTTO
 *   SLOT 2 "Il più acclamato"     — massimo voto TMDB, ignora contesto temporale
 *   SLOT 3 "Aspetti da più tempo" — il più vecchio in watchlist non già nei pick 1/2
 *
 * ═══ MOTIVAZIONI TESTUALI ═══
 *   Ogni pick genera un testo spiegando perché è stato scelto.
 */

import { useMemo } from 'react';
import type { WatchedMovie, WatchlistItem } from '../types';

export interface TonightPick {
  item: WatchlistItem;
  score: number;
  slot: 'tonight' | 'acclaimed' | 'waiting';
  reason: string;        // spiegazione in italiano
  reasonEmoji: string;
}

interface TimeContext {
  hour: number;
  isWeekend: boolean;
  isLateNight: boolean;   // 22:00+
  isAfternoon: boolean;   // 14:00–18:00
  isEvening: boolean;     // 18:00–22:00
  suggestedMaxRuntime: number; // minuti
}

function getTimeContext(): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=domenica, 6=sabato
  const isWeekend = day === 0 || day === 5 || day === 6;
  return {
    hour,
    isWeekend,
    isLateNight: hour >= 22 || hour < 2,
    isAfternoon: hour >= 14 && hour < 18,
    isEvening: hour >= 18 && hour < 22,
    suggestedMaxRuntime: isWeekend ? 180 : (hour >= 22 ? 100 : 130),
  };
}

// ── Calcola il profilo gusti dell'utente ──────────────────────────

interface TasteProfile {
  genreWeights: Record<number, number>; // genreId → peso (0–1)
  recentGenreIds: number[];             // generi ultimi 5 film visti
  preferredRuntime: number | null;      // durata media dei film liked
  avgPersonalRating: number;            // voto medio che l'utente dà
  qualityThreshold: number;             // voto TMDB minimo basato su gusti
  hasData: boolean;
}

function buildTasteProfile(watched: WatchedMovie[]): TasteProfile {
  if (watched.length === 0) {
    return { genreWeights: {}, recentGenreIds: [], preferredRuntime: null, avgPersonalRating: 3, qualityThreshold: 5, hasData: false };
  }

  // Film "buoni" per l'utente = liked oppure voto personale ≥ 4
  const goodMovies = watched.filter(m => m.liked || (m.personal_rating !== null && m.personal_rating >= 4));
  const rated = watched.filter(m => m.personal_rating !== null);

  // Genre weights: ogni genere riceve punti dalla qualità del film
  const genreRaw: Record<number, { sum: number; count: number }> = {};
  for (const m of watched) {
    const score = m.liked ? 5 : (m.personal_rating ?? m.vote_average / 2);
    for (const gid of (m.genre_ids ?? [])) {
      if (!genreRaw[gid]) genreRaw[gid] = { sum: 0, count: 0 };
      genreRaw[gid].sum += score;
      genreRaw[gid].count += 1;
    }
  }
  // Normalizza a 0–1 rispetto al max
  const entries = Object.entries(genreRaw).map(([id, { sum, count }]) => [Number(id), sum / count] as [number, number]);
  const maxW = Math.max(...entries.map(([, w]) => w), 1);
  const genreWeights: Record<number, number> = {};
  for (const [id, w] of entries) genreWeights[id] = w / maxW;

  // Generi recenti (ultimi 5 film visti, ordine temporale)
  const recent = [...watched].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()).slice(0, 5);
  const recentGenreIds = [...new Set(recent.flatMap(m => m.genre_ids ?? []))];

  // Runtime preferito: media dei film liked con runtime disponibile
  const runtimes = goodMovies.filter(m => m.runtime && m.runtime > 0).map(m => m.runtime!);
  const preferredRuntime = runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;

  // Voto medio personale
  const avgPersonalRating = rated.length > 0
    ? rated.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / rated.length
    : 3;

  // Soglia qualità TMDB
  const qualityThreshold = avgPersonalRating >= 4 ? 6.5 : avgPersonalRating >= 3 ? 5.5 : 4.5;

  return { genreWeights, recentGenreIds, preferredRuntime, avgPersonalRating, qualityThreshold, hasData: watched.length >= 3 };
}

// ── Scoring di un singolo film in watchlist ───────────────────────

function scoreItem(
  item: WatchlistItem,
  taste: TasteProfile,
  ctx: TimeContext,
  watchedIds: Set<number>
): number {
  if (watchedIds.has(item.id)) return -1; // già visto, escludi

  let score = 0;

  // 1. Genere match con gusti profilati (peso 35%)
  const genreIds = item.genre_ids ?? [];
  if (genreIds.length > 0 && taste.hasData) {
    const genreScore = genreIds.reduce((s, gid) => s + (taste.genreWeights[gid] ?? 0), 0) / genreIds.length;
    score += genreScore * 35;
  }

  // 2. Voto TMDB (peso 25%) — normalizzato 0–10
  score += (item.vote_average / 10) * 25;

  // 3. Affinità temporale — durata vs contesto (peso 20%)
  const runtime = item.runtime ?? 90; // default 90 min se non disponibile
  const maxRt = ctx.suggestedMaxRuntime;
  if (runtime <= maxRt) {
    // Film nella finestra temporale: più si avvicina al max, meglio
    score += (runtime / maxRt) * 20;
  } else {
    // Film troppo lungo per il contesto: penalità proporzionale
    score += Math.max(0, 20 - ((runtime - maxRt) / 10) * 5);
  }

  // 4. Anzianità in watchlist — bonus per film salvati da >2 settimane (peso 10%)
  const daysInWatchlist = (Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysInWatchlist > 30) score += 10;
  else if (daysInWatchlist > 14) score += 6;
  else if (daysInWatchlist > 7) score += 3;

  // 5. Allineamento generi recenti (mood a breve termine) (peso 10%)
  if (taste.recentGenreIds.length > 0) {
    const recentMatch = genreIds.filter(g => taste.recentGenreIds.includes(g)).length;
    score += (recentMatch / Math.max(1, genreIds.length)) * 10;
  }

  // 6. Bonus context-aware per ora/giorno (bonus flat)
  const HORROR_THRILLER = [27, 53, 9648]; // horror, thriller, mystery
  const COMEDY_FAMILY   = [35, 10751, 16]; // commedia, family, animazione
  const DRAMA_SERIOUS   = [18, 36, 10752]; // drama, history, war
  const isHorrorThriller = genreIds.some(g => HORROR_THRILLER.includes(g));
  const isLightWatch     = genreIds.some(g => COMEDY_FAMILY.includes(g));
  const isDramaSerious   = genreIds.some(g => DRAMA_SERIOUS.includes(g));

  if (ctx.isLateNight && isHorrorThriller) score += 8;
  if (ctx.isAfternoon && isLightWatch) score += 6;
  if (ctx.isWeekend && isDramaSerious) score += 5;
  if (!ctx.isWeekend && ctx.isEvening && isLightWatch) score += 4;

  return score;
}

// ── Genera il testo motivazionale ─────────────────────────────────

function buildReason(
  item: WatchlistItem,
  slot: TonightPick['slot'],
  ctx: TimeContext,
  taste: TasteProfile
): { reason: string; reasonEmoji: string } {
  const runtime = item.runtime;
  const daysWaiting = Math.floor((Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24));
  const genreIds = item.genre_ids ?? [];

  const HORROR_THRILLER = [27, 53, 9648];
  const COMEDY_FAMILY   = [35, 10751, 16];
  const ACTION_ADV      = [28, 12];
  const DRAMA           = [18, 36];
  const isHorror = genreIds.some(g => HORROR_THRILLER.includes(g));
  const isComedy = genreIds.some(g => COMEDY_FAMILY.includes(g));
  const isAction = genreIds.some(g => ACTION_ADV.includes(g));
  const isDrama  = genreIds.some(g => DRAMA.includes(g));

  if (slot === 'acclaimed') {
    return {
      reason: `Il più acclamato della tua lista con ${item.vote_average.toFixed(1)}/10 su TMDB`,
      reasonEmoji: '⭐',
    };
  }

  if (slot === 'waiting') {
    if (daysWaiting >= 30) {
      return {
        reason: `In lista da ${daysWaiting} giorni — è ora di vederlo`,
        reasonEmoji: '⏳',
      };
    }
    return {
      reason: `Salvato ${daysWaiting > 7 ? `${Math.floor(daysWaiting/7)} settimane` : `${daysWaiting} giorni`} fa`,
      reasonEmoji: '📌',
    };
  }

  // Slot "tonight" — motivo contestuale
  const reasons: { reason: string; emoji: string }[] = [];

  if (ctx.isWeekend && runtime && runtime > 120) {
    reasons.push({ reason: `Weekend perfetto per ${runtime} minuti di cinema`, emoji: '🎬' });
  }
  if (!ctx.isWeekend && runtime && runtime <= 100) {
    reasons.push({ reason: `${runtime} min, ideale per una serata infrasettimanale`, emoji: '🌙' });
  }
  if (ctx.isLateNight && isHorror) {
    reasons.push({ reason: 'Perfetto per la notte — se ti fidi', emoji: '👻' });
  }
  if (ctx.isAfternoon && isComedy) {
    reasons.push({ reason: 'Qualcosa di leggero per il pomeriggio', emoji: '☀️' });
  }
  if (isAction && ctx.isEvening) {
    reasons.push({ reason: 'Adrenalina per la serata', emoji: '⚡' });
  }
  if (isDrama && taste.hasData && taste.avgPersonalRating >= 4) {
    reasons.push({ reason: 'In linea con i film che hai amato di più', emoji: '❤️' });
  }
  if (item.vote_average >= 8) {
    reasons.push({ reason: `Straordinario: ${item.vote_average.toFixed(1)}/10 su TMDB`, emoji: '🏆' });
  }
  if (taste.hasData) {
    const genreMatch = (item.genre_ids ?? []).filter(g => taste.genreWeights[g] > 0.7).length;
    if (genreMatch > 0) {
      reasons.push({ reason: 'Genere che adori in base alla tua storia', emoji: '🎯' });
    }
  }
  if (daysWaiting > 14) {
    reasons.push({ reason: `In lista da ${daysWaiting} giorni`, emoji: '📅' });
  }

  const chosen = reasons[0] ?? { reason: 'Scelto per te questa sera', emoji: '✨' };
  return { reason: chosen.reason, reasonEmoji: chosen.emoji };
}

// ── Hook principale ───────────────────────────────────────────────

export function useTonightPick(
  watchlist: WatchlistItem[],
  watchedMovies: WatchedMovie[],
  watchedIds: Set<number>,
  seed: number = 0
): {
  picks: TonightPick[];
  ctx: TimeContext;
  taste: TasteProfile;
  hasPicks: boolean;
} {
  const ctx = useMemo(() => getTimeContext(), []);
  const taste = useMemo(() => buildTasteProfile(watchedMovies), [watchedMovies]);

  const picks = useMemo<TonightPick[]>(() => {
    // Filtra film già visti dalla watchlist
    const available = watchlist.filter(item => !watchedIds.has(item.id));
    if (available.length === 0) return [];

    // Calcola score per ogni film
    const scored = available.map(item => ({
      item,
      score: scoreItem(item, taste, ctx, watchedIds),
    })).sort((a, b) => b.score - a.score);

    const result: TonightPick[] = [];
    const usedIds = new Set<number>();

    // Rotation: quando seed > 0, ruota la lista per mostrare pick diversi
    if (seed > 0) {
      const offset = (seed * 3) % Math.max(1, scored.length);
      scored.push(...scored.splice(0, offset));
    }

    // SLOT 1: "Perfetto per stasera" — massimo score composito
    const best = scored[0];
    if (best) {
      const { reason, reasonEmoji } = buildReason(best.item, 'tonight', ctx, taste);
      result.push({ item: best.item, score: best.score, slot: 'tonight', reason, reasonEmoji });
      usedIds.add(best.item.id);
    }

    // SLOT 2: "Il più acclamato" — massimo voto TMDB tra i non già scelti
    const acclaimed = available
      .filter(i => !usedIds.has(i.id))
      .sort((a, b) => b.vote_average - a.vote_average)[0];
    if (acclaimed) {
      const { reason, reasonEmoji } = buildReason(acclaimed, 'acclaimed', ctx, taste);
      result.push({ item: acclaimed, score: acclaimed.vote_average, slot: 'acclaimed', reason, reasonEmoji });
      usedIds.add(acclaimed.id);
    }

    // SLOT 3: "Aspetti da più tempo" — il più vecchio in watchlist
    const oldest = available
      .filter(i => !usedIds.has(i.id))
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime())[0];
    if (oldest) {
      const { reason, reasonEmoji } = buildReason(oldest, 'waiting', ctx, taste);
      result.push({ item: oldest, score: 0, slot: 'waiting', reason, reasonEmoji });
      usedIds.add(oldest.id);
    }

    return result;
  }, [watchlist, watchedIds, taste, ctx, seed]);

  return { picks, ctx, taste, hasPicks: picks.length > 0 };
}
