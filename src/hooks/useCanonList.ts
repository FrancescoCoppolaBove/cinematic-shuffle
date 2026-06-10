/**
 * useCanonList — risolve i film di una lista canonica (titolo+anno) in voci
 * TMDB con cache su localStorage, e calcola quanti ne ha visti l'utente.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { mkey } from '../utils';
import type { CanonList } from '../data/canonLists';
import { searchMovieByTitleYear, type ResolvedFilm } from '../services/tmdb';

const CACHE_PREFIX = 'cinematic_canon_v1_';
const BATCH = 6;

export interface CanonEntry {
  key: string;
  title: string;
  year: number;
  resolved: ResolvedFilm | null;
}

function cacheKey(title: string, year: number) {
  return `${CACHE_PREFIX}${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${year}`;
}
function readCache(title: string, year: number): ResolvedFilm | null | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(title, year));
    if (raw === null) return undefined;          // mai risolto
    return raw === 'null' ? null : (JSON.parse(raw) as ResolvedFilm);
  } catch { return undefined; }
}
function writeCache(title: string, year: number, v: ResolvedFilm | null) {
  try { localStorage.setItem(cacheKey(title, year), v ? JSON.stringify(v) : 'null'); } catch { /* quota */ }
}

export function useCanonList(list: CanonList, watchedIds: Set<string>) {
  const [entries, setEntries] = useState<CanonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const runRef = useRef(0);

  useEffect(() => {
    const run = ++runRef.current;
    const base: CanonEntry[] = list.films.map(f => ({
      key: cacheKey(f.title, f.year), title: f.title, year: f.year,
      resolved: readCache(f.title, f.year) ?? null,
    }));
    const missing = list.films.filter(f => readCache(f.title, f.year) === undefined);
    setEntries(base);
    setProgress(missing.length === 0 ? 1 : (list.films.length - missing.length) / list.films.length);
    if (missing.length === 0) { setLoading(false); return; }

    setLoading(true);
    let cancelled = false;
    (async () => {
      let done = list.films.length - missing.length;
      for (let i = 0; i < missing.length; i += BATCH) {
        if (cancelled || run !== runRef.current) return;
        const batch = missing.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async f => {
          const r = await searchMovieByTitleYear(f.title, f.year);
          writeCache(f.title, f.year, r);
          return [cacheKey(f.title, f.year), r] as const;
        }));
        if (cancelled || run !== runRef.current) return;
        setEntries(prev => prev.map(e => {
          const hit = results.find(([k]) => k === e.key);
          return hit ? { ...e, resolved: hit[1] } : e;
        }));
        done += batch.length;
        setProgress(Math.min(1, done / list.films.length));
      }
      if (!cancelled && run === runRef.current) setLoading(false);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  const { watchedCount, total } = useMemo(() => {
    let w = 0, t = 0;
    for (const e of entries) {
      if (!e.resolved) continue;
      t++;
      if (watchedIds.has(mkey(e.resolved.id, 'movie'))) w++;
    }
    return { watchedCount: w, total: t };
  }, [entries, watchedIds]);

  return { entries, watchedCount, total, loading, progress };
}
