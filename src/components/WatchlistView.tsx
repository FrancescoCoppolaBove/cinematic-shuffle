import { useState, useCallback } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { GridControls, DEFAULT_GRID_FILTERS } from './GridControls';
import type { GridFilters, ViewMode } from './GridControls';
import { CardView } from './CardView';
import { useMemo } from 'react';
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<GridFilters>(DEFAULT_GRID_FILTERS);
  const [cardIndex, setCardIndex] = useState(0);

  const filtered = useMemo(() => {
    let list = [...watchlist];
    if (filters.search) list = list.filter(m => getTitle(m).toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.mediaType !== 'all') list = list.filter(m => m.media_type === filters.mediaType);
    if (filters.minRating > 0) list = list.filter(m => m.vote_average >= filters.minRating);
    switch (filters.sortBy) {
      case 'title': list.sort((a, b) => getTitle(a).localeCompare(getTitle(b))); break;
      case 'tmdb_rating': list.sort((a, b) => b.vote_average - a.vote_average); break;
      default: break;
    }
    return list;
  }, [watchlist, filters]);



  const handleSelect = useCallback(async (item: WatchlistItem) => {
    if (loadingId) return; // già in caricamento
    setLoadingId(item.id);
    try {
      const detail = await getMovieDetail(item.id, item.media_type);
      setSelectedMovie(detail);
    } catch { /* silente */ }
    finally { setLoadingId(null); }
  }, [loadingId]);

  const handleOpenRelated = useCallback(async (id: number, mediaType: 'movie' | 'tv') => {
    const detail = await getMovieDetail(id, mediaType);
    setSelectedMovie(detail);
  }, []);

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedMovie(null)}
          className="flex items-center gap-2 text-film-muted hover:text-film-text text-sm transition-colors active:opacity-70">
          ← Torna alla watchlist
        </button>
        <MovieCard
          movie={selectedMovie}
          isWatched={watchedIds.has(selectedMovie.id)}
          isOnWatchlist={watchlistIds.has(selectedMovie.id)}
          personalRating={getPersonalRating(selectedMovie.id)}
          showShuffleBtn={false}
          onMarkWatched={r => { onMarkWatched(selectedMovie, r); setSelectedMovie(null); }}
          onUnmarkWatched={() => onUnmarkWatched(selectedMovie.id)}
          onUpdateRating={r => onUpdateRating(selectedMovie.id, r)}
          onAddToWatchlist={() => onAddToWatchlist(selectedMovie)}
          onRemoveFromWatchlist={() => { onRemoveFromWatchlist(selectedMovie.id); setSelectedMovie(null); }}
          onOpenMovie={handleOpenRelated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              Aggiungi film e serie con il pulsante "Watchlist"
            </p>
          </div>
        </div>
      ) : (
        <>
          <GridControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={watchlist.length}
            filteredCount={filtered.length}
          />

          {viewMode === 'card' ? (
            <CardView
              items={filtered}
              watchedIds={watchedIds}
              watchlistIds={watchlistIds}
              getPersonalRating={getPersonalRating}
              onMarkWatched={onMarkWatched}
              onUnmarkWatched={onUnmarkWatched}
              onUpdateRating={onUpdateRating}
              onAddToWatchlist={onAddToWatchlist}
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              onOpenFull={handleOpenRelated}
              initialIndex={cardIndex}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {filtered.map((item, idx) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  isLoading={loadingId === item.id}
                  onSelect={() => { setCardIndex(idx); handleSelect(item); }}
                  onRemove={() => onRemoveFromWatchlist(item.id)}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-film-muted text-sm py-8">Nessun risultato</p>
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
    // L'intero contenitore è cliccabile — un solo tap apre la scheda
    <div
      className={cn(
        'relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card',
        'transition-all active:scale-[0.97]',
        isLoading && 'opacity-70'
      )}
    >
      {/* Tap area — tutto il poster apre la scheda */}
      <button
        onClick={onSelect}
        disabled={isLoading}
        className="absolute inset-0 w-full h-full"
        aria-label={`Apri ${title}`}
      >
        {poster
          ? <img
              src={poster}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
            />
          : <div className="w-full h-full flex items-center justify-center text-3xl text-film-subtle">
              {item.media_type === 'tv' ? '📺' : '🎬'}
            </div>
        }
      </button>

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-film-black/60 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Cestino — sempre visibile, piccolo, angolo top-right */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 bg-film-black/75 backdrop-blur-sm text-film-subtle active:text-film-red p-1.5 rounded-lg z-10"
        aria-label="Rimuovi dalla watchlist"
      >
        <Trash2 size={12} />
      </button>

      {/* Gradient + titolo in basso — sempre visibile */}
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black via-film-black/60 to-transparent px-2 pt-8 pb-2 pointer-events-none"
      >
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-film-subtle text-xs">{formatYear(getReleaseDate(item))}</span>
          {item.vote_average > 0 && (
            <span className="text-film-accent text-xs">★ {formatRating(item.vote_average)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
