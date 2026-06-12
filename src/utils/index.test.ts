import { describe, it, expect } from 'vitest';
import { mkey, formatRuntime, formatYear } from './index';

describe('mkey — chiave composita film/serie', () => {
  it('prefissa i film con "movie:"', () => {
    expect(mkey(550, 'movie')).toBe('movie:550');
  });
  it('prefissa le serie con "tv:"', () => {
    expect(mkey(1396, 'tv')).toBe('tv:1396');
  });
  it('default a movie quando il tipo manca o non è "tv"', () => {
    expect(mkey(550)).toBe('movie:550');
    expect(mkey(550, undefined)).toBe('movie:550');
    expect(mkey(550, 'xyz')).toBe('movie:550');
  });
  it('un film e una serie con lo STESSO id non collidono', () => {
    expect(mkey(1396, 'movie')).not.toBe(mkey(1396, 'tv'));
  });
});

describe('formatRuntime', () => {
  it('gestisce ore e minuti', () => {
    expect(formatRuntime(148)).toBe('2h 28min');
    expect(formatRuntime(60)).toBe('1h');
    expect(formatRuntime(45)).toBe('45min');
  });
  it('null/0 → N/A', () => {
    expect(formatRuntime(null)).toBe('N/A');
    expect(formatRuntime(0)).toBe('N/A');
  });
});

describe('formatYear', () => {
  it('estrae l\'anno', () => {
    expect(formatYear('2008-07-18')).toBe('2008');
  });
  it('stringa vuota → N/A', () => {
    expect(formatYear('')).toBe('N/A');
  });
});
