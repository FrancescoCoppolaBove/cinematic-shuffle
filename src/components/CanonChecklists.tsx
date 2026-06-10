/**
 * CanonChecklists — sezione "Awards & Canon" nel profilo.
 * Accordion (risolve i dati solo quando aperto) con una card per lista che
 * mostra l'avanzamento; tap → schermata con la griglia completa dei film.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, ChevronLeft, ChevronDown } from 'lucide-react';
import { CANON_LISTS, type CanonList } from '../data/canonLists';
import { useCanonList } from '../hooks/useCanonList';
import { getImageUrl } from '../services/tmdb';
import { InnerMovieDetail } from './InnerMovieDetail';
import type { TMDBMovieDetail } from '../types';
import { cn } from '../utils';

// Callback necessari per aprire il dettaglio del film dentro la lista.
export interface CanonMovieActions {
  watchlistIds: Set<number>;
  likedIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
}

interface Props extends CanonMovieActions {
  watchedIds: Set<number>;
}

export function CanonChecklists({ watchedIds, ...actions }: Props) {
  const [open, setOpen] = useState(false);
  const [openList, setOpenList] = useState<CanonList | null>(null);

  return (
    <div className="bg-film-surface border border-film-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 active:opacity-60">
        <div className="flex items-center gap-2">
          <Award size={15} className="text-film-accent" />
          <span className="text-film-text text-sm font-medium">Awards & Canon</span>
        </div>
        <ChevronDown size={16} className={cn('text-film-subtle transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {CANON_LISTS.map(list => (
            <CanonCard key={list.id} list={list} watchedIds={watchedIds} onClick={() => setOpenList(list)} />
          ))}
        </div>
      )}

      {openList && (
        <CanonListScreen
          list={openList}
          watchedIds={watchedIds}
          actions={actions}
          onBack={() => setOpenList(null)}
        />
      )}
    </div>
  );
}

function CanonCard({ list, watchedIds, onClick }: {
  list: CanonList; watchedIds: Set<number>; onClick: () => void;
}) {
  const { watchedCount, total, loading, progress } = useCanonList(list, watchedIds);
  const pct = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
  return (
    <button onClick={onClick} className="w-full bg-film-card border border-film-border rounded-xl p-3 text-left active:opacity-70">
      <div className="flex items-center gap-2">
        <span className="text-lg">{list.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-film-text text-sm font-medium truncate">{list.name}</p>
          <p className="text-film-subtle text-[11px] truncate">{list.subtitle}</p>
        </div>
        <span className="text-film-accent text-sm font-display shrink-0">
          {loading && total === 0 ? `${Math.round(progress * 100)}%` : `${watchedCount}/${total || list.films.length}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-film-border overflow-hidden mt-2">
        <div className="h-full bg-film-accent rounded-full transition-all" style={{ width: `${loading && total === 0 ? progress * 100 : pct}%` }} />
      </div>
    </button>
  );
}

function CanonListScreen({ list, watchedIds, actions, onBack }: {
  list: CanonList; watchedIds: Set<number>; actions: CanonMovieActions; onBack: () => void;
}) {
  const { entries, watchedCount, total, loading, progress } = useCanonList(list, watchedIds);
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const [innerMovie, setInnerMovie] = useState<number | null>(null);
  const pct = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

  const visible = entries.filter(e => e.resolved && (!onlyUnseen || !watchedIds.has(e.resolved!.id)));

  return createPortal((
    <div className="fixed inset-0 z-[110] bg-film-black flex flex-col" style={{ isolation: 'isolate' }}>
      {/* Header */}
      <div className="shrink-0 bg-film-black border-b border-film-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-semibold truncate">{list.emoji} {list.name}</p>
            <p className="text-film-subtle text-xs">{list.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 'var(--nav-h, 60px)' }}>
        {/* Progress hero */}
        <div className="bg-gradient-to-r from-film-accent/15 to-transparent border border-film-accent/30 rounded-2xl p-4 flex items-center gap-4">
          <p className="font-display text-3xl text-film-accent leading-none shrink-0">
            {watchedCount}<span className="text-film-subtle text-lg">/{total || list.films.length}</span>
          </p>
          <div className="flex-1 min-w-0">
            <p className="text-film-text text-sm font-medium">{pct}% complete</p>
            <div className="h-1.5 rounded-full bg-film-card overflow-hidden mt-2">
              <div className="h-full bg-film-accent rounded-full" style={{ width: `${pct}%` }} />
            </div>
            {loading && <p className="text-film-subtle text-[11px] mt-1">Loading list… {Math.round(progress * 100)}%</p>}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setOnlyUnseen(v => !v)}
          className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
            onlyUnseen ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface text-film-muted border-film-border')}
        >
          {onlyUnseen ? '✓ ' : ''}To watch only
        </button>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-2">
          {visible.map(e => {
            const r = e.resolved!;
            const isWatched = watchedIds.has(r.id);
            const poster = getImageUrl(r.poster_path, 'w342');
            return (
              <button key={e.key} onClick={() => setInnerMovie(r.id)}
                className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform text-left">
                {poster
                  ? <img src={poster} alt={r.title} className={cn('w-full h-full object-cover', isWatched && 'opacity-40 grayscale')} />
                  : <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>}
                {isWatched && (
                  <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-4 h-4 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">✓</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/95 to-transparent px-1.5 pt-5 pb-1.5 pointer-events-none">
                  <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{e.title}</p>
                  <p className="text-white/50 text-[10px]">{e.year}</p>
                </div>
              </button>
            );
          })}
        </div>
        {!loading && visible.length === 0 && (
          <p className="text-film-muted text-sm text-center py-8">
            {onlyUnseen ? "You've seen them all! 🎉" : 'No films available'}
          </p>
        )}
      </div>

      {/* Dettaglio film SOPRA la lista — il back torna alla lista */}
      {innerMovie !== null && (
        <InnerMovieDetail
          id={innerMovie}
          mediaType="movie"
          watchedIds={watchedIds}
          watchlistIds={actions.watchlistIds}
          likedIds={actions.likedIds}
          getPersonalRating={actions.getPersonalRating}
          onMarkWatched={actions.onMarkWatched}
          onUnmarkWatched={actions.onUnmarkWatched}
          onUpdateRating={actions.onUpdateRating}
          onToggleLiked={actions.onToggleLiked}
          onAddToWatchlist={actions.onAddToWatchlist}
          onRemoveFromWatchlist={actions.onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  ), document.body);
}
