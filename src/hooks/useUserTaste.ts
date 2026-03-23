/**
 * useUserTaste — motore di raccomandazione adattivo.
 *
 * ARCHITETTURA A TRE LIVELLI:
 *
 * 1. PROFILO UTENTE (buildProfile)
 *    Analizza watchedMovies e costruisce un modello statistico:
 *    - Pesi per genere: media pesata voto×liked su ogni genre_id
 *    - Pesi per decade: distribuzione dei film liked
 *    - Runtime preferita: distribuzione dei film liked
 *    - Lingue originali preferite
 *    - Soglia qualità TMDB calibrata sul voto medio personale
 *    - Punteggio "esplorazione": quante categorie ha mai visto
 *
 * 2. STRATEGIA DI QUERY (getQueryStrategy)
 *    Sceglie come costruire la query TMDB in base ai dati disponibili.
 *    Più dati = più personalizzazione. Meno dati = più casualità.
 *    Strategie: RANDOM | GENRE_SINGLE | GENRE_MULTI | EXPLORE
 *    con probabilità graduate che si calibrano con l'uso.
 *
 * 3. SCORING POST-FETCH (scoreCandidates)
 *    Dopo che TMDB restituisce 20 candidati, li scorea con:
 *    - Affinità genere (peso 40%)
 *    - Qualità relativa (voto TMDB vs soglia utente, peso 20%)
 *    - Affinità decade (peso 15%)
 *    - Affinità runtime (peso 15%)
 *    - Novità (non in history recente, peso 10%)
 *    Seleziona tra i top-3 con leggera casualità (non sempre il primo).
 */

import { useMemo } from 'react';
import type { WatchedMovie } from '../types';
import type { MovieFilters } from '../types';
import type { TMDBMovieBasic } from '../types';

// ── Profilo utente ─────────────────────────────────────────────────

export interface UserProfile {
  // Pesi genere: genreId → score 0–1 (1 = massima affinità)
  genreWeights: Record<number, number>;
  // Top generi ordinati per peso
  topGenreIds: number[];
  // Generi che l'utente NON ha mai visto (per esplorazione)
  unseenGenreIds: number[];
  // Pesi decade: "1990s" → score 0–1
  decadeWeights: Record<string, number>;
  // Runtime: range preferito [min, max] in minuti
  preferredRuntimeRange: [number, number] | null;
  // Lingue originali (ISO 639-1) ordinate per frequenza nei film liked
  topLanguages: string[];
  // Soglia voto TMDB calibrata sul comportamento utente
  qualityThreshold: number;
  // Quanti film visti: determina quanto pesare la personalizzazione
  watchedCount: number;
  // Confidenza del profilo: 0 (nessun dato) → 1 (profilo completo)
  confidence: number;
  // Fase utente
  phase: 'cold' | 'warming' | 'calibrated' | 'expert';
}

// Tutti i genre_ids TMDB principali per film e TV
const ALL_GENRE_IDS = [28,12,16,35,80,99,18,10751,14,36,27,10402,9648,10749,878,10770,53,10752,37,10759,10762,10763,10764,10765,10766,10767,10768];

export function buildProfile(watchedMovies: WatchedMovie[]): UserProfile {
  const count = watchedMovies.length;

  // Determina la fase dell'utente
  const phase = count === 0 ? 'cold'
    : count < 5 ? 'warming'
    : count < 20 ? 'calibrated'
    : 'expert';

  const confidence = Math.min(1, count / 30);

  if (count === 0) {
    return {
      genreWeights: {}, topGenreIds: [], unseenGenreIds: ALL_GENRE_IDS,
      decadeWeights: {}, preferredRuntimeRange: null, topLanguages: [],
      qualityThreshold: 6.0, watchedCount: 0, confidence: 0, phase: 'cold',
    };
  }

  // ── Calcola peso per ogni genere ──────────────────────────────
  // Formula: media di (rating_score × liked_multiplier) per ogni film con quel genere
  // rating_score: personal_rating normalizzato 0–1, fallback a voto TMDB/10
  // liked_multiplier: 1.5 se liked, 1.0 altrimenti, 0.3 se votato basso (< 2.5)
  const genreRaw: Record<number, { sum: number; count: number }> = {};

  for (const m of watchedMovies) {
    if (!m.genre_ids?.length) continue;
    const personalScore = m.personal_rating !== null
      ? m.personal_rating / 5        // 0–1
      : m.vote_average / 10;         // fallback TMDB
    const likedMult = m.liked ? 1.5
      : (m.personal_rating !== null && m.personal_rating < 2.5) ? 0.3
      : 1.0;
    const score = Math.min(1, personalScore * likedMult);

    for (const gid of m.genre_ids) {
      if (!genreRaw[gid]) genreRaw[gid] = { sum: 0, count: 0 };
      genreRaw[gid].sum += score;
      genreRaw[gid].count += 1;
    }
  }

  // Normalizza a 0–1
  const genreAvg: Record<number, number> = {};
  for (const [id, { sum, count }] of Object.entries(genreRaw)) {
    genreAvg[Number(id)] = sum / count;
  }
  const maxG = Math.max(...Object.values(genreAvg), 0.01);
  const genreWeights: Record<number, number> = {};
  for (const [id, v] of Object.entries(genreAvg)) {
    genreWeights[Number(id)] = v / maxG;
  }

  const topGenreIds = Object.entries(genreWeights)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => Number(id));

  const seenGenreIds = new Set(Object.keys(genreRaw).map(Number));
  const unseenGenreIds = ALL_GENRE_IDS.filter(id => !seenGenreIds.has(id));

  // ── Calcola peso per decade ──────────────────────────────────
  const decadeRaw: Record<string, number> = {};
  const goodMovies = watchedMovies.filter(m =>
    m.liked || (m.personal_rating !== null && m.personal_rating >= 3.5));
  for (const m of goodMovies) {
    const year = parseInt(m.release_date?.slice(0, 4) ?? '0');
    if (year < 1920) continue;
    const decade = `${Math.floor(year / 10) * 10}s`;
    decadeRaw[decade] = (decadeRaw[decade] ?? 0) + 1;
  }
  const maxD = Math.max(...Object.values(decadeRaw), 1);
  const decadeWeights: Record<string, number> = {};
  for (const [d, v] of Object.entries(decadeRaw)) {
    decadeWeights[d] = v / maxD;
  }

  // ── Runtime preferita ─────────────────────────────────────────
  const runtimes = goodMovies
    .filter(m => m.runtime && m.runtime > 40 && m.runtime < 300)
    .map(m => m.runtime!);
  let preferredRuntimeRange: [number, number] | null = null;
  if (runtimes.length >= 3) {
    const sorted = [...runtimes].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    preferredRuntimeRange = [Math.max(40, p25 - 15), Math.min(240, p75 + 15)];
  }

  // ── Lingue originali ─────────────────────────────────────────
  // (salvate in future — per ora non abbiamo original_language in WatchedMovie)
  const topLanguages: string[] = ['en']; // default inglese

  // ── Soglia qualità TMDB ──────────────────────────────────────
  const rated = watchedMovies.filter(m => m.personal_rating !== null);
  const avgPersonal = rated.length > 0
    ? rated.reduce((s, m) => s + m.personal_rating!, 0) / rated.length : 3;
  // Calibra: utente esigente (vota alto) → soglia più alta
  const qualityThreshold = avgPersonal >= 4.5 ? 7.5
    : avgPersonal >= 4.0 ? 7.0
    : avgPersonal >= 3.5 ? 6.5
    : avgPersonal >= 3.0 ? 6.0
    : 5.5;

  return {
    genreWeights, topGenreIds, unseenGenreIds,
    decadeWeights, preferredRuntimeRange, topLanguages,
    qualityThreshold, watchedCount: count, confidence, phase,
  };
}

// ── Strategia di query ─────────────────────────────────────────────

export type QueryStrategy = 'random' | 'genre_single' | 'genre_multi' | 'explore';

export interface QueryStrategyResult {
  strategy: QueryStrategy;
  filters: MovieFilters;
  label: string; // per debug
}

/**
 * Sceglie una strategia in base alla confidenza del profilo.
 * Le probabilità si spostano gradualmente verso la personalizzazione.
 *
 * cold (0-4 film):    80% random, 15% genre_single, 5% explore
 * warming (5-19):     30% random, 40% genre_single, 20% genre_multi, 10% explore
 * calibrated (20-29): 15% random, 35% genre_single, 35% genre_multi, 15% explore
 * expert (30+):       10% random, 25% genre_single, 45% genre_multi, 20% explore
 */
export function getQueryStrategy(
  profile: UserProfile,
  baseFilters: MovieFilters,
  exploreMode: boolean = false
): QueryStrategyResult {
  const { phase, topGenreIds, unseenGenreIds } = profile;
  const r = Math.random();

  // Probabilità per fase
  const probs: Record<UserProfile['phase'], [number, number, number, number]> = {
    cold:       [0.80, 0.95, 1.00, 1.00],
    warming:    [0.30, 0.70, 0.90, 1.00],
    calibrated: [0.15, 0.50, 0.85, 1.00],
    expert:     [0.10, 0.35, 0.80, 1.00],
  };
  const [pRandom, pSingle, pMulti] = probs[phase];

  let strategy: QueryStrategy;
  if (exploreMode || r >= pMulti) strategy = 'explore';
  else if (r >= pSingle) strategy = 'genre_multi';
  else if (r >= pRandom) strategy = 'genre_single';
  else strategy = 'random';

  const filters = { ...baseFilters };

  // La qualità viene gestita da scoreCandidates, NON dal filtro API.
  // Aggiungere minImdbRating qui restringe troppo il catalogo per utenti esperti.

  switch (strategy) {
    case 'genre_single': {
      // Top genere con un po' di variabilità (scegli tra i top 3)
      const topN = topGenreIds.slice(0, 3);
      const picked = topN[Math.floor(Math.random() * Math.min(topN.length, 3))];
      if (picked && !filters.genreIds?.length) {
        filters.genreIds = [picked];
      }
      return { strategy, filters, label: `Top genre: ${picked}` };
    }

    case 'genre_multi': {
      // Combina 2 generi affini (evita combinazioni improbabili)
      const topN = topGenreIds.slice(0, 5);
      if (topN.length >= 2 && !filters.genreIds?.length) {
        // Prendi due generi casuali dai top 5, ma non dalla stessa fascia (varietà)
        const i1 = Math.floor(Math.random() * Math.min(3, topN.length));
        let i2 = Math.floor(Math.random() * Math.min(5, topN.length));
        if (i2 === i1) i2 = (i2 + 1) % topN.length;
        filters.genreIds = [topN[i1], topN[i2]];
      }
      return { strategy, filters, label: `Multi genre: ${filters.genreIds?.join(',')}` };
    }

    case 'explore': {
      // Suggerisci un genere che l'utente non ha mai visto
      // o un genere "secondario" (pesi bassi) per espandere i gusti
      const lowWeightGenres = topGenreIds
        .filter(id => (profile.genreWeights[id] ?? 0) < 0.4)
        .slice(0, 5);
      const candidates = [...unseenGenreIds.slice(0, 10), ...lowWeightGenres];
      if (candidates.length > 0 && !filters.genreIds?.length) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        filters.genreIds = [picked];
      }
      return { strategy, filters, label: `Explore genre: ${filters.genreIds?.[0]}` };
    }

    default:
      return { strategy: 'random', filters, label: 'Random' };
  }
}

// ── Scoring post-fetch ─────────────────────────────────────────────

/**
 * Dato un array di candidati TMDB, assegna uno score a ciascuno
 * in base al profilo utente e sceglie uno tra i migliori.
 */
export function scoreCandidates(
  candidates: TMDBMovieBasic[],
  profile: UserProfile,
  recentHistoryIds: Set<number>
): TMDBMovieBasic | null {
  if (candidates.length === 0) return null;

  // Se profilo non ancora calibrato, scegli casualmente
  if (profile.confidence < 0.15) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const scored = candidates.map(m => {
    let score = 0;

    // 1. Affinità genere (40%)
    const gids = m.genre_ids ?? [];
    if (gids.length > 0 && Object.keys(profile.genreWeights).length > 0) {
      const genreScore = gids.reduce((s, g) => s + (profile.genreWeights[g] ?? 0), 0) / gids.length;
      score += genreScore * 40;
    } else {
      score += 20; // neutro se nessun dato genere
    }

    // 2. Qualità relativa (20%)
    // Film sopra la soglia dell'utente ottengono bonus proporzionale
    const voteNorm = Math.max(0, (m.vote_average - profile.qualityThreshold) / (10 - profile.qualityThreshold));
    score += voteNorm * 20;

    // 3. Affinità decade (15%)
    const year = parseInt(m.release_date?.slice(0, 4) ?? '0');
    if (year > 1920) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      score += (profile.decadeWeights[decade] ?? 0) * 15;
    }

    // 4. Affinità runtime (15%)
    if (profile.preferredRuntimeRange && m.vote_count > 0) {
      // TMDB non restituisce runtime nei risultati discover — skip
      // Ma possiamo usare il voto_count come proxy di film "mainstream" vs "di nicchia"
      // Alto vote_count = film molto visto = probabilmente nella fascia dell'utente
      const isPopular = m.vote_count > 500;
      score += isPopular ? 8 : 5;
    } else {
      score += 7;
    }

    // 5. Novità — penalizza film già visti di recente (10%)
    if (!recentHistoryIds.has(m.id)) score += 10;

    return { m, score };
  }).sort((a, b) => b.score - a.score);

  // Scegli tra i top-3 con distribuzione pesata (non sempre il primo)
  // Questo evita che l'utente veda sempre lo stesso film "perfetto"
  const topK = Math.min(3, scored.length);
  const weights = [0.60, 0.30, 0.10].slice(0, topK);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < topK; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i].m;
  }
  return scored[0].m;
}

// ── Hook principale ─────────────────────────────────────────────────

export function useUserTaste(watchedMovies: WatchedMovie[]): {
  profile: UserProfile;
  getStrategyAndFilters: (baseFilters: MovieFilters, exploreMode?: boolean) => QueryStrategyResult;
  scoreCandidates: (candidates: TMDBMovieBasic[], recentIds: Set<number>) => TMDBMovieBasic | null;
  applyTasteToFilters: (filters: MovieFilters) => MovieFilters; // backward compat
} {
  const profile = useMemo(() => buildProfile(watchedMovies), [watchedMovies]);

  function getStrategyAndFilters(baseFilters: MovieFilters, exploreMode = false) {
    return getQueryStrategy(profile, baseFilters, exploreMode);
  }

  function scoreC(candidates: TMDBMovieBasic[], recentIds: Set<number>) {
    return scoreCandidates(candidates, profile, recentIds);
  }

  // Backward compat per usages esistenti (TonightView, ecc.)
  function applyTasteToFilters(filters: MovieFilters): MovieFilters {
    const { filters: enriched } = getQueryStrategy(profile, filters);
    return enriched;
  }

  return { profile, getStrategyAndFilters, scoreCandidates: scoreC, applyTasteToFilters };
}
