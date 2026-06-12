import { describe, it, expect } from 'vitest';
import { titleRuntimeMinutes } from './runtime';
import type { TMDBMovieDetail } from '../types';

const tv = (p: Partial<TMDBMovieDetail>) => ({ media_type: 'tv', ...p }) as TMDBMovieDetail;
const movie = (p: Partial<TMDBMovieDetail>) => ({ media_type: 'movie', ...p }) as TMDBMovieDetail;

describe('titleRuntimeMinutes', () => {
  it('film: usa la durata del film', () => {
    expect(titleRuntimeMinutes(movie({ runtime: 148 }))).toBe(148);
  });
  it('film senza runtime → null', () => {
    expect(titleRuntimeMinutes(movie({ runtime: null }))).toBeNull();
  });

  it('serie: durata episodio × numero episodi (intera serie)', () => {
    // Breaking Bad: 62 ep × 47 min ≈ 49h, NON 47 min
    expect(titleRuntimeMinutes(tv({ episode_run_time: [47], number_of_episodes: 62 }))).toBe(2914);
  });
  it('serie senza episode_run_time: fallback 40 min/ep', () => {
    expect(titleRuntimeMinutes(tv({ episode_run_time: [], number_of_episodes: 50 }))).toBe(2000);
  });
  it('serie senza numero episodi ma con durata ep: usa un episodio', () => {
    expect(titleRuntimeMinutes(tv({ episode_run_time: [42], number_of_episodes: 0 }))).toBe(42);
  });
  it('serie senza alcun dato → null', () => {
    expect(titleRuntimeMinutes(tv({}))).toBeNull();
  });
});
