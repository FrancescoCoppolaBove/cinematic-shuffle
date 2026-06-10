/**
 * useWatchedCredits — recupera e aggrega registi e attori dai film visti.
 *
 * I crediti NON sono salvati in WatchedMovie, quindi vengono scaricati da TMDB
 * (endpoint /credits, leggero) una sola volta per titolo e messi in cache su
 * localStorage. Le chiamate mancanti vengono fatte a piccoli lotti per non
 * sovraccaricare l'API. L'aggregazione produce le classifiche di registi/attori.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WatchedMovie } from '../types';
import { getCredits, type TitleCredits, type CreditPerson } from '../services/tmdb';

const CACHE_PREFIX = 'cinematic_credits_v1_';
const BATCH_SIZE = 8;

export interface RankedPerson extends CreditPerson { count: number }

function readCache(mt: string, id: number): TitleCredits | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${mt}_${id}`);
    return raw ? (JSON.parse(raw) as TitleCredits) : null;
  } catch { return null; }
}
function writeCache(mt: string, id: number, c: TitleCredits) {
  try { localStorage.setItem(`${CACHE_PREFIX}${mt}_${id}`, JSON.stringify(c)); } catch { /* quota */ }
}

export function useWatchedCredits(watchedMovies: WatchedMovie[]) {
  // Mappa id→crediti tenuta in memoria (seed dalla cache localStorage).
  const [creditsMap, setCreditsMap] = useState<Map<number, TitleCredits>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const runIdRef = useRef(0);

  // Chiave stabile basata sugli id visti (per non rieseguire inutilmente).
  const idsKey = useMemo(
    () => watchedMovies.map(m => `${m.media_type}:${m.id}`).sort().join(','),
    [watchedMovies]
  );

  useEffect(() => {
    const runId = ++runIdRef.current;
    const next = new Map<number, TitleCredits>();
    const missing: WatchedMovie[] = [];

    // Prima passa: prendi tutto ciò che è già in cache.
    for (const m of watchedMovies) {
      const cached = readCache(m.media_type, m.id);
      if (cached) next.set(m.id, cached);
      else missing.push(m);
    }
    setCreditsMap(new Map(next));

    if (missing.length === 0) { setLoading(false); setProgress(1); return; }

    setLoading(true);
    setProgress(next.size / watchedMovies.length);

    let cancelled = false;
    (async () => {
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        if (cancelled || runId !== runIdRef.current) return;
        const batch = missing.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async m => {
            try {
              const c = await getCredits(m.id, m.media_type);
              writeCache(m.media_type, m.id, c);
              return [m.id, c] as const;
            } catch { return [m.id, null] as const; }
          })
        );
        if (cancelled || runId !== runIdRef.current) return;
        for (const [id, c] of results) if (c) next.set(id, c);
        setCreditsMap(new Map(next));
        setProgress(Math.min(1, (next.size) / watchedMovies.length));
      }
      if (!cancelled && runId === runIdRef.current) { setLoading(false); setProgress(1); }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Aggregazione classifiche.
  const { topDirectors, topActors } = useMemo(() => {
    const dir = new Map<number, RankedPerson>();
    const act = new Map<number, RankedPerson>();
    const bump = (map: Map<number, RankedPerson>, p: CreditPerson) => {
      const cur = map.get(p.id);
      if (cur) cur.count += 1;
      else map.set(p.id, { ...p, count: 1 });
    };
    for (const c of creditsMap.values()) {
      // Difensivo: voci di cache localStorage vecchie/corrotte potrebbero
      // non avere gli array — non devono far crashare le classifiche.
      for (const d of c.directors ?? []) bump(dir, d);
      for (const a of c.cast ?? []) bump(act, a);
    }
    const sort = (m: Map<number, RankedPerson>) =>
      [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { topDirectors: sort(dir), topActors: sort(act) };
  }, [creditsMap]);

  return { topDirectors, topActors, loading, progress };
}
