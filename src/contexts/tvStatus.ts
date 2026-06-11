/**
 * TVStatusContext — espone lo stato/azioni delle serie TV (following/completed)
 * a QUALSIASI schermata di dettaglio, indipendentemente da come è stata aperta
 * (flusso principale, ricerca, persona, genere, browse…). Evita di dover passare
 * a mano gli handler attraverso ogni livello di prop-drilling: il pulsante
 * Follow e il completamento serie funzionano ovunque.
 */
import { createContext, useContext } from 'react';
import type { TMDBMovieDetail } from '../types';

export interface TVStatusApi {
  tvStatus: Map<number, 'following' | 'completed'>;
  setFollowing: (seriesId: number, movie?: TMDBMovieDetail) => Promise<void>;
  setCompleted: (
    movie: TMDBMovieDetail,
    seasons: { season_number: number; episode_count: number }[],
  ) => Promise<void>;
  unsetTVStatus: (seriesId: number) => Promise<void>;
}

export const TVStatusContext = createContext<TVStatusApi | null>(null);

export function useTVStatus(): TVStatusApi | null {
  return useContext(TVStatusContext);
}
