import { useState, useCallback } from 'react';
import { Eye, Search } from 'lucide-react';
import type { WatchedMovie, TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating } from '../utils';
import { MovieCard } from './MovieCard';

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
  const [search, setSearch] = useState('');

  const filtered = watchedMovies.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback(async (movie: WatchedMovie) => {
    setLoadingId(movie.id);
    try {
      const detail = await getMovieDetail(movie.id, movie.media_type);
      setSelectedMovie(detail);
    } catch { /* silente */ }
    finally { setLoadingId(null); }
  }, []);

  const handleOpenRelated = useCallback(async (id: number, mediaType: 'movie' | 'tv') => {
    const detail = await getMovieDetail(id, mediaType);
    setSelectedMovie(detail);
  }, []);

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedMovie(null)}
          className="flex items-center gap-2 text-film-muted hover:text-film-text text-sm transition-colors">
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
        {loading && (
          <div className="w-4 h-4 border border-film-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {watchedMovies.length === 0 ? (
        <div className="text-center py-20 text-film-muted space-y-3">
          <Eye size={44} className="mx-auto opacity-20" />
          <div>
            <p className="text-sm">Nessun film o serie nella lista</p>
            <p className="text-xs mt-1 text-film-subtle">Segna qualcosa come visto dallo Shuffle o dalla Ricerca</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="flex items-center gap-3 bg-film-surface border border-film-border rounded-xl px-3 py-2.5 focus-within:border-film-accent transition-colors">
            <Search size={14} className="text-film-muted shrink-0" />
            <input
              type="text"
              placeholder="Filtra per titolo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-film-text placeholder:text-film-subtle focus:outline-none flex-1"
            />
          </div>

          {/* Poster grid — 3 columns like Watchlist */}
          <div className="grid grid-cols-3 gap-2.5">
            {filtered.map(movie => (
              <WatchedPosterCard
                key={movie.id}
                movie={movie}
                isLoading={loadingId === movie.id}
                onSelect={() => handleSelect(movie)}
              />
            ))}
          </div>

          {filtered.length === 0 && search && (
            <p className="text-center text-film-muted text-sm py-8">
              Nessun risultato per "{search}"
            </p>
          )}
        </>
      )}
    </div>
  );
}

function WatchedPosterCard({
  movie, isLoading, onSelect,
}: {
  movie: WatchedMovie;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(movie.poster_path, 'w342') : null;
  const title = getTitle(movie);

  return (
    <button
      onClick={onSelect}
      className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border hover:border-film-accent/60 transition-all active:scale-[0.97] bg-film-card"
    >
      {/* Poster */}
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover"
            onError={() => setImgErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
            {movie.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-film-black/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Bottom overlay with rating */}
      {movie.personal_rating !== null && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-film-black to-transparent px-2 pt-4 pb-1.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = (movie.personal_rating ?? 0) >= i + 1;
              const half = !filled && (movie.personal_rating ?? 0) >= i + 0.5;
              return (
                <svg key={i} width="10" height="10" viewBox="0 0 24 24">
                  <polygon
                    points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                    stroke="#E8C547" strokeWidth="2" strokeLinejoin="round"
                    fill={filled ? '#E8C547' : half ? 'url(#h)' : 'none'}
                  />
                </svg>
              );
            })}
          </div>
        </div>
      )}

      {/* Hover title */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black via-film-black/60 to-transparent px-2 pt-6 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-film-subtle text-xs">{formatYear(getReleaseDate(movie))}</span>
          {movie.vote_average > 0 && (
            <span className="text-film-accent text-xs">★ {formatRating(movie.vote_average)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
