/**
 * OnboardingTaste — al primo accesso (nessun film visto) chiede all'utente di
 * scegliere alcuni film che ama. Vengono segnati come visti+preferiti così il
 * motore dei gusti parte già "caldo" invece di essere casuale per i primi film.
 */
import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { TMDBMovieBasic, TMDBMovieDetail } from '../types';
import { getTop500, getMovieDetail, getImageUrl, getEnglishTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';

const MIN_PICKS = 3;

interface Props {
  onConfirm: (movies: TMDBMovieDetail[]) => Promise<void>;
  onSkip: () => void;
}

export function OnboardingTaste({ onConfirm, onSkip }: Props) {
  const [pool, setPool] = useState<TMDBMovieBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getTop500(1), getTop500(2), getTop500(3)])
      .then(([a, b, c]) => {
        const merged = [...a.items, ...b.items, ...c.items];
        const seen = new Set<number>();
        const uniq = merged.filter(m => {
          if (!m.poster_path || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setPool(uniq.slice(0, 48));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size < MIN_PICKS || saving) return;
    setSaving(true);
    try {
      const ids = [...selected];
      const details = await Promise.all(
        ids.map(id => getMovieDetail(id, 'movie').catch(() => null))
      );
      await onConfirm(details.filter((m): m is TMDBMovieDetail => m !== null));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-film-black flex flex-col" style={{ isolation: 'isolate' }}>
      {/* Header */}
      <div className="shrink-0 px-5 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-film-accent" />
          <h1 className="font-display text-2xl text-film-text tracking-wide">Which films do you love?</h1>
        </div>
        <p className="text-film-muted text-sm">
          Pick at least {MIN_PICKS}: we will use your taste to recommend better films right away.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {pool.map(m => {
              const isSel = selected.has(m.id);
              const poster = getImageUrl(m.poster_path, 'w342');
              return (
                <button key={m.id} onClick={() => toggle(m.id)}
                  className={cn(
                    'relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all active:scale-[0.97] text-left',
                    isSel ? 'border-film-accent' : 'border-film-border'
                  )}>
                  {poster
                    ? <img src={poster} alt={getEnglishTitle(m)} className={cn('w-full h-full object-cover', isSel && 'brightness-75')} />
                    : <div className="w-full h-full flex items-center justify-center text-2xl bg-film-card">🎬</div>}
                  {isSel && (
                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-film-accent flex items-center justify-center">
                      <Check size={14} className="text-film-black" strokeWidth={3} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-5 pb-1.5 pointer-events-none">
                    <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{getEnglishTitle(m)}</p>
                    <p className="text-white/50 text-[10px]">{formatYear(getReleaseDate(m))}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 pt-3 border-t border-film-border bg-film-black flex items-center gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <button onClick={onSkip} disabled={saving}
          className="px-4 py-3 text-film-subtle text-sm active:opacity-60 disabled:opacity-40">
          Skip
        </button>
        <button onClick={confirm} disabled={selected.size < MIN_PICKS || saving}
          className="flex-1 py-3.5 rounded-2xl bg-film-accent text-film-black font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2">
          {saving
            ? <><div className="w-4 h-4 border-2 border-film-black/40 border-t-transparent rounded-full animate-spin" />Preparing picks...</>
            : selected.size >= MIN_PICKS ? `Confirm (${selected.size})` : `Pick at least ${MIN_PICKS}`}
        </button>
      </div>
    </div>
  );
}
