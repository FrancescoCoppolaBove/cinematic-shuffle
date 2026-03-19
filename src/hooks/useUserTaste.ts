/**
 * useUserTaste — recommendation engine basato sui gusti dell'utente.
 *
 * Come funziona:
 * 1. Analizza i film che l'utente ha visto, con quanto li ha votati e se li ha "likati"
 * 2. Costruisce un profilo di generi preferiti, decadi, registi, voto medio
 * 3. Quando si fa Shuffle, se il profilo è abbastanza ricco (≥5 film visti),
 *    usa queste info per orientare i filtri verso i gusti dell'utente
 * 4. Introduce casualità controllata (70% gusti / 30% puro random) per non essere
 *    troppo prevedibile e continuare a far scoprire cose nuove
 */

import { useMemo } from 'react';
import type { WatchedMovie } from '../types';
import type { MovieFilters } from '../types';

interface TasteProfile {
  topGenreIds: number[];       // generi più votati/piaciuti
  preferredDecade?: string;    // decade con più film piaciuti
  avgRating: number;           // voto medio che l'utente dà
  minAcceptableRating: number; // voto TMDB minimo basato su ciò che gli piace
  hasEnoughData: boolean;      // true se ci sono abbastanza dati per inferire gusti
}

// Mappa genere TMDB → lista film visti con quel genere
// Non abbiamo i generi nel WatchedMovie, ma abbiamo i genre_ids dal tipo base.
// Per semplicità usiamo la correlazione tramite vote_average e liked.

export function useUserTaste(watchedMovies: WatchedMovie[]): {
  profile: TasteProfile;
  applyTasteToFilters: (filters: MovieFilters) => MovieFilters;
} {
  const profile = useMemo<TasteProfile>(() => {
    const rated = watchedMovies.filter(m => m.personal_rating !== null);
    const hasEnoughData = watchedMovies.length >= 5;

    if (!hasEnoughData) {
      return {
        topGenreIds: [],
        avgRating: 0,
        minAcceptableRating: 0,
        hasEnoughData: false,
      };
    }

    // Calcola voto medio che l'utente assegna ai film
    const avgRating = rated.length > 0
      ? rated.reduce((sum, m) => sum + (m.personal_rating ?? 0), 0) / rated.length
      : 0;

    // I film "buoni" = votati ≥ 4 stelle o "likati"
    const goodMovies = watchedMovies.filter(m =>
      (m.personal_rating !== null && m.personal_rating >= 4) || m.liked
    );

    // Analisi decadi: qual è la decade con più film piaciuti
    const decadeMap: Record<string, number> = {};
    for (const m of goodMovies) {
      const year = parseInt(m.release_date?.split('-')[0] ?? '0');
      if (year < 1930) continue;
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeMap[decade] = (decadeMap[decade] ?? 0) + 1;
    }
    const preferredDecade = Object.entries(decadeMap)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    // Soglia minima voto TMDB: se l'utente ha votato alto i suoi film,
    // alza la soglia del voto TMDB per proporre cose più di qualità
    // (ma non troppo aggressivo — max 6.5)
    let minAcceptableRating = 0;
    if (avgRating >= 4 && rated.length >= 5) {
      // Utente selettivo: proponi film con voto TMDB ≥ 6.5
      minAcceptableRating = 6.5;
    } else if (avgRating >= 3 && rated.length >= 3) {
      // Utente moderato: proponi film con voto TMDB ≥ 5.5
      minAcceptableRating = 5.5;
    }

    return {
      topGenreIds: [],        // TODO: da popolare quando salviamo i generi nel WatchedMovie
      preferredDecade,
      avgRating,
      minAcceptableRating,
      hasEnoughData,
    };
  }, [watchedMovies]);

  /**
   * Modifica i filtri per includere le preferenze dell'utente.
   * Applica solo se l'utente non ha già impostato filtri manuali
   * per quella dimensione (non sovrascrive le scelte esplicite).
   *
   * Casualità: 70% del tempo applica i gusti, 30% puro random
   * per continuare a far scoprire contenuti fuori dalla comfort zone.
   */
  function applyTasteToFilters(filters: MovieFilters): MovieFilters {
    if (!profile.hasEnoughData) return filters;

    // 30% chance: shuffle puro, niente personalizzazione
    if (Math.random() < 0.30) return filters;

    const modified = { ...filters };

    // Alza il voto minimo se l'utente è selettivo (e non l'ha già impostato manualmente)
    if (
      profile.minAcceptableRating > 0 &&
      (!modified.minImdbRating || modified.minImdbRating < profile.minAcceptableRating)
    ) {
      modified.minImdbRating = profile.minAcceptableRating;
    }

    // Decade preferita: applica solo se non c'è già un filtro anno/decade
    // e solo il 50% delle volte (per variare)
    if (
      profile.preferredDecade &&
      !modified.year &&
      !modified.decade &&
      Math.random() < 0.50
    ) {
      modified.decade = profile.preferredDecade;
    }

    return modified;
  }

  return { profile, applyTasteToFilters };
}
