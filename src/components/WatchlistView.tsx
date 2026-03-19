import { useState, useCallback } from 'react';
import { Bookmark, Eye, Trash2, Search } from 'lucide-react';
import type { WatchlistItem, TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { MovieCard } from './MovieCard';

interface WatchlistViewProps {
  watchlist: WatchlistItem[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
}

export function WatchlistView({
  watchlist, watchedIds, watchlistIds, getPersonalRating,
  onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
}: WatchlistViewProps) {
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovieDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = watchlist.filter(m => getTitle(m).toLowerCase().includes(search.toLowerCase()));

  const handleSelect = useCallback(async (item: WatchlistItem) => {
    setLoadingId(item.id);
    try {
      const detail = await getMovieDetail(item.id, item.media_type);
      setSelectedMovie(detail);
    } finally {
      setLoadingId(null);
    }
  }, []);

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedMovie(null)}
          className="flex items-center gap-2 text-film-muted hover:text-film-text text-sm transition-colors">
          ← Torna alla watchlist
        </button>
        <MovieCard
          movie={selectedMovie}
          isWatched={watchedIds.has(selectedMovie.id)}
          isOnWatchlist={watchlistIds.has(selectedMovie.id)}
          personalRating={getPersonalRating(selectedMovie.id)}
          onMarkWatched={r => { onMarkWatched(selectedMovie, r); setSelectedMovie(null); }}
          onUnmarkWatched={() => onUnmarkWatched(selectedMovie.id)}
          onUpdateRating={r => onUpdateRating(selectedMovie.id, r)}
          onAddToWatchlist={() => onAddToWatchlist(selectedMovie)}
          onRemoveFromWatchlist={() => { onRemoveFromWatchlist(selectedMovie.id); setSelectedMovie(null); }}
          onShuffle={() => setSelectedMovie(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bookmark size={16} className="text-purple-400" />
        <span className="text-film-text font-medium">Watchlist</span>
        <span className="bg-film-card border border-film-border text-film-muted text-xs px-2 py-0.5 rounded-full">
          {watchlist.length}
        </span>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center py-20 text-film-muted space-y-3">
          <Bookmark size={44} className="mx-auto opacity-20" />
          <div>
            <p className="text-sm">La tua watchlist è vuota</p>
            <p className="text-xs mt-1 text-film-subtle">
              Aggiungi film e serie TV con il pulsante "Watchlist" durante lo Shuffle o la Ricerca
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="flex items-center gap-3 bg-film-surface border border-film-border rounded-xl px-3 py-2.5 focus-within:border-film-accent transition-colors">
            <Search size={14} className="text-film-muted" />
            <input type="text" placeholder="Filtra..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-film-text placeholder:text-film-subtle focus:outline-none flex-1" />
          </div>

          {/* Poster grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {filtered.map(item => (
              <WatchlistCard
                key={item.id}
                item={item}
                isLoading={loadingId === item.id}
                onSelect={() => handleSelect(item)}
                onRemove={() => onRemoveFromWatchlist(item.id)}
              />
            ))}
          </div>

          {filtered.length === 0 && search && (
            <p className="text-center text-film-muted text-sm py-8">Nessun risultato per "{search}"</p>
          )}
        </>
      )}
    </div>
  );
}

function WatchlistCard({
  item, isLoading, onSelect, onRemove,
}: {
  item: WatchlistItem;
  isLoading: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w342') : null;
  const title = getTitle(item);

  return (
    <div className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border hover:border-purple-500/50 transition-all bg-film-card">
      {/* Poster */}
      <button onClick={onSelect} className="w-full h-full">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-3xl text-film-subtle">
              {item.media_type === 'tv' ? '📺' : '🎬'}
            </div>
        }
      </button>

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-film-black/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Remove button - top right */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 bg-film-black/70 backdrop-blur-sm text-film-subtle hover:text-film-red p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        title="Rimuovi dalla watchlist"
      >
        <Trash2 size={11} />
      </button>

      {/* Bottom overlay with title + info */}
      <button onClick={onSelect}
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black via-film-black/70 to-transparent px-2 pt-6 pb-2 text-left w-full">
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-film-subtle text-xs">{formatYear(getReleaseDate(item))}</span>
          {item.vote_average > 0 && (
            <span className="text-film-accent text-xs">★ {formatRating(item.vote_average)}</span>
          )}
        </div>
      </button>

      {/* Mark as watched button */}
      <button
        onClick={e => { e.stopPropagation(); onSelect(); }}
        className={cn(
          'absolute bottom-0 inset-x-0 bg-film-accent/90 text-film-black text-xs font-semibold py-1.5 flex items-center justify-center gap-1',
          'translate-y-full group-hover:translate-y-0 transition-transform duration-200'
        )}
      >
        <Eye size={11} /> Apri scheda
      </button>
    </div>
  );
}
