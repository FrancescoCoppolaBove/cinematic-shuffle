import { useState, useCallback, useMemo } from 'react';
import { Eye } from 'lucide-react';
import type { WatchedMovie, TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating } from '../utils';
import { MovieCard } from './MovieCard';
import { GridControls, DEFAULT_GRID_FILTERS } from './GridControls';
import type { GridFilters, ViewMode } from './GridControls';
import { CardView } from './CardView';

interface WatchedViewProps {
  watchedMovies: WatchedMovie[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  loading: boolean;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
}

export function WatchedView({
  watchedMovies, watchedIds, watchlistIds, loading, getPersonalRating,
  onMarkWatched, onUnmarkWatched, onUpdateRating, onAddToWatchlist, onRemoveFromWatchlist,
}: WatchedViewProps) {
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovieDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<GridFilters>(DEFAULT_GRID_FILTERS);
  const [cardIndex, setCardIndex] = useState(0);

  const filtered = useMemo(() => {
    let list = [...watchedMovies];
    if (filters.search) list = list.filter(m => m.title.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.mediaType !== 'all') list = list.filter(m => m.media_type === filters.mediaType);
    if (filters.minRating > 0) list = list.filter(m => m.vote_average >= filters.minRating);
    if (filters.onlyRated) list = list.filter(m => m.personal_rating !== null);
    switch (filters.sortBy) {
      case 'title': list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'tmdb_rating': list.sort((a, b) => b.vote_average - a.vote_average); break;
      case 'rating': list.sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0)); break;
      default: break; // date — already sorted by addedAt from Firestore
    }
    return list;
  }, [watchedMovies, filters]);

  const handleSelect = useCallback(async (movie: WatchedMovie) => {
    setLoadingId(movie.id);
    try { setSelectedMovie(await getMovieDetail(movie.id, movie.media_type)); }
    catch { /* silente */ }
    finally { setLoadingId(null); }
  }, []);

  const handleSelectByIndex = useCallback((idx: number) => {
    setCardIndex(idx);
    setViewMode('card');
  }, []);

  const handleOpenRelated = useCallback(async (id: number, mt: 'movie' | 'tv') => {
    setSelectedMovie(await getMovieDetail(id, mt));
  }, []);

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedMovie(null)}
          className="flex items-center gap-2 text-film-muted text-sm transition-colors active:opacity-70">
          ← Torna alla lista
        </button>
        <MovieCard
          movie={selectedMovie}
          isWatched={watchedIds.has(selectedMovie.id)}
          isOnWatchlist={watchlistIds.has(selectedMovie.id)}
          personalRating={getPersonalRating(selectedMovie.id)}
          showShuffleBtn={false}
          onMarkWatched={r => onMarkWatched(selectedMovie, r)}
          onUnmarkWatched={() => { onUnmarkWatched(selectedMovie.id); setSelectedMovie(null); }}
          onUpdateRating={r => onUpdateRating(selectedMovie.id, r)}
          onAddToWatchlist={() => onAddToWatchlist(selectedMovie)}
          onRemoveFromWatchlist={() => onRemoveFromWatchlist(selectedMovie.id)}
          onOpenMovie={handleOpenRelated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-film-accent" />
          <span className="text-film-text font-medium">Film visti</span>
          <span className="bg-film-card border border-film-border text-film-muted text-xs px-2 py-0.5 rounded-full">
            {watchedMovies.length}
          </span>
        </div>
        {loading && <div className="w-4 h-4 border border-film-accent border-t-transparent rounded-full animate-spin" />}
      </div>

      {watchedMovies.length === 0 ? (
        <div className="text-center py-20 text-film-muted space-y-3">
          <Eye size={44} className="mx-auto opacity-20" />
          <p className="text-sm">Nessun film o serie nella lista</p>
        </div>
      ) : (
        <>
          <GridControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filters={filters}
            onFiltersChange={setFilters}
            showRatingFilter={true}
            totalCount={watchedMovies.length}
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
              onOpenFull={(id, mt) => handleSelect({ id, title: '', poster_path: null, release_date: '', vote_average: 0, personal_rating: null, addedAt: '', media_type: mt })}
              initialIndex={cardIndex}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {filtered.map((movie, idx) => (
                <WatchedPosterCard
                  key={movie.id}
                  movie={movie}
                  isLoading={loadingId === movie.id}
                  onSelect={() => handleSelect(movie)}
                  onCardView={() => handleSelectByIndex(idx)}
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

function WatchedPosterCard({ movie, isLoading, onSelect }: {
  movie: WatchedMovie; isLoading: boolean;
  onSelect: () => void; onCardView: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(movie.poster_path, 'w342') : null;
  const title = getTitle(movie);

  return (
    <button
      onClick={onSelect}
      className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border active:scale-[0.97] transition-all bg-film-card"
    >
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
            {movie.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }

      {isLoading && (
        <div className="absolute inset-0 bg-film-black/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {movie.personal_rating !== null && (
        <div className="absolute top-1.5 left-1.5 bg-film-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded-lg">
          <span className="text-film-accent text-xs font-bold">{movie.personal_rating}★</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black via-film-black/60 to-transparent px-2 pt-6 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-film-subtle text-xs">{formatYear(getReleaseDate(movie))}</span>
          {movie.vote_average > 0 && <span className="text-film-accent text-xs">★ {formatRating(movie.vote_average)}</span>}
        </div>
      </div>
    </button>
  );
}
