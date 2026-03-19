import { useState, useCallback } from 'react';
import type { TMDBMovieDetail, MovieFilters } from '../types';
import { getRandomMovie } from '../services/tmdb';

interface ShuffleState {
  movie: TMDBMovieDetail | null;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
}

export function useShuffle() {
  const [state, setState] = useState<ShuffleState>({
    movie: null,
    loading: false,
    error: null,
    hasSearched: false,
  });

  const shuffle = useCallback(async (filters: MovieFilters, watchedIds: Set<number>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const movie = await getRandomMovie(filters, watchedIds);
      if (!movie) {
        setState({
          movie: null,
          loading: false,
          error: 'Nessun film trovato con i filtri selezionati. Prova ad allargare la ricerca.',
          hasSearched: true,
        });
      } else {
        setState({ movie, loading: false, error: null, hasSearched: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setState({ movie: null, loading: false, error: message, hasSearched: true });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ movie: null, loading: false, error: null, hasSearched: false });
  }, []);

  return { ...state, shuffle, reset };
}
