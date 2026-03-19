import { useState, useCallback } from 'react';
import type { TMDBMovieDetail, MovieFilters } from '../types';
import { getRandomContent } from '../services/tmdb';

interface ShuffleState {
  movie: TMDBMovieDetail | null;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
}

export function useShuffle() {
  const [state, setState] = useState<ShuffleState>({ movie: null, loading: false, error: null, hasSearched: false });

  const shuffle = useCallback(async (filters: MovieFilters, watchedIds: Set<number>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // If "both", randomly pick movie or tv
      const effectiveFilters = filters.mediaType === 'both'
        ? { ...filters, mediaType: Math.random() < 0.5 ? 'movie' as const : 'tv' as const }
        : filters;

      const movie = await getRandomContent(effectiveFilters, watchedIds);
      if (!movie) {
        setState({ movie: null, loading: false, error: 'Nessun risultato con i filtri selezionati. Prova ad allargare la ricerca.', hasSearched: true });
      } else {
        setState({ movie, loading: false, error: null, hasSearched: true });
      }
    } catch (err) {
      setState({ movie: null, loading: false, error: err instanceof Error ? err.message : 'Errore sconosciuto', hasSearched: true });
    }
  }, []);

  return { ...state, shuffle };
}
