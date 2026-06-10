/**
 * DiaryView — diario di visione: i film visti raggruppati per mese in base
 * alla data di visione (modificabile), dal più recente. Tocca un film per
 * aprirlo, o cambia la data con il selettore nativo.
 */
import { useMemo } from 'react';
import { Calendar, Star, Heart } from 'lucide-react';
import type { WatchedMovie } from '../types';
import { getImageUrl } from '../services/tmdb';
import { formatYear, cn } from '../utils';

interface Props {
  watchedMovies: WatchedMovie[];
  onOpenMovie: (id: number, mt: 'movie' | 'tv') => void;
  onUpdateWatchedDate: (id: number, date: string) => Promise<void>;
}

// Data effettiva di visione: watchedDate se presente, altrimenti il giorno di addedAt.
function effectiveDate(m: WatchedMovie): string {
  if (m.watchedDate) return m.watchedDate;
  const t = Date.parse(m.addedAt);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

export function DiaryView({ watchedMovies, onOpenMovie, onUpdateWatchedDate }: Props) {
  const groups = useMemo(() => {
    const withDate = watchedMovies
      .map(m => ({ m, date: effectiveDate(m) }))
      .filter(x => x.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    const byMonth = new Map<string, { m: WatchedMovie; date: string }[]>();
    for (const x of withDate) {
      const key = x.date.slice(0, 7); // YYYY-MM
      const arr = byMonth.get(key) ?? [];
      arr.push(x);
      byMonth.set(key, arr);
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [watchedMovies]);

  if (groups.length === 0) {
    return <p className="text-film-muted text-sm text-center py-10">No films in your diary yet. Mark a film as watched to start.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {groups.map(([key, items]) => {
        const monthLabel = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <Calendar size={13} className="text-film-accent" />
              <h3 className="text-film-text text-sm font-semibold capitalize">{monthLabel}</h3>
              <span className="text-film-subtle text-xs">· {items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(({ m, date }) => (
                <div key={m.id} className="flex items-center gap-3 bg-film-surface border border-film-border rounded-xl p-2">
                  <button onClick={() => onOpenMovie(m.id, m.media_type)} className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-film-card border border-film-border active:opacity-70">
                    {m.poster_path
                      ? <img src={getImageUrl(m.poster_path, 'w92') || ''} alt={m.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm">🎬</div>}
                  </button>
                  <button onClick={() => onOpenMovie(m.id, m.media_type)} className="flex-1 min-w-0 text-left active:opacity-70">
                    <p className="text-film-text text-sm font-medium truncate">{m.title}</p>
                    <p className="text-film-subtle text-xs">{formatYear(m.release_date)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.personal_rating !== null && (
                        <span className="flex items-center gap-0.5 text-film-accent text-xs">
                          <Star size={10} fill="currentColor" />{m.personal_rating}
                        </span>
                      )}
                      {m.liked && <Heart size={11} className="text-pink-400" fill="currentColor" />}
                      {m.rewatchCount > 0 && <span className="text-film-subtle text-[10px]">↻{m.rewatchCount}</span>}
                    </div>
                  </button>
                  {/* Selettore data nativo */}
                  <label className={cn('shrink-0 flex flex-col items-end gap-0.5 cursor-pointer')}>
                    <span className="text-film-subtle text-[10px] uppercase tracking-wider">watched on</span>
                    <input
                      type="date"
                      value={date}
                      max={today}
                      onChange={e => { if (e.target.value) onUpdateWatchedDate(m.id, e.target.value); }}
                      className="bg-film-card border border-film-border rounded-lg px-2 py-1 text-film-text text-xs"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
