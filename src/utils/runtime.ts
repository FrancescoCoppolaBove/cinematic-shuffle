import type { TMDBMovieDetail } from '../types';

/**
 * Minuti "guardati" da attribuire a un titolo nella libreria.
 * - Film: la durata del film.
 * - Serie TV: durata episodio × numero di episodi (stima dell'intera serie),
 *   così le ore guardate non contano una serie da 60 episodi come ~45 minuti.
 *   Se TMDB non espone la durata per-episodio, si usa una stima di 40 min/ep
 *   (meglio di 0h per show lunghi). Fallback finale: durata di un episodio.
 */
export function titleRuntimeMinutes(movie: TMDBMovieDetail): number | null {
  if (movie.media_type === 'tv') {
    const eps = movie.number_of_episodes ?? 0;
    const perEp = movie.episode_run_time?.[0] ?? 0;
    if (eps > 0) return (perEp > 0 ? perEp : 40) * eps;
    return perEp > 0 ? perEp : null;
  }
  return movie.runtime ?? null;
}
