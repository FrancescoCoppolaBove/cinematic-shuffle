import { useState } from 'react';
import { Eye, Trash2, Search } from 'lucide-react';
import type { WatchedMovie, TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail } from '../services/tmdb';
import { formatYear, formatRating, formatDate } from '../utils';
import { MovieCard } from './MovieCard';
import { StarRating } from './StarRating';

interface WatchedViewProps {
  watchedMovies: WatchedMovie[];
  watchedIds: Set<number>;
  loading: boolean;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (movieId: number, rating: number | null) => Promise<void>;
}

export function WatchedView({
  watchedMovies, watchedIds, loading, onMarkWatched, onUnmarkWatched, onUpdateRating
}: WatchedViewProps) {
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovieDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = watchedMovies.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSelect(movie: WatchedMovie) {
    setLoadingId(movie.id);
    try {
      const detail = await getMovieDetail(movie.id);
      setSelectedMovie(detail);
    } catch { /* silente */ }
    finally { setLoadingId(null); }
  }

  const getPersonalRating = (id: number) =>
    watchedMovies.find(m => m.id === id)?.personal_rating ?? null;

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedMovie(null)}
          className="flex items-center gap-2 text-film-muted hover:text-film-text text-sm transition-colors"
        >
          ← Torna alla lista
        </button>
        <MovieCard
          movie={selectedMovie}
          isWatched={watchedIds.has(selectedMovie.id)}
          personalRating={getPersonalRating(selectedMovie.id)}
          onMarkWatched={rating => onMarkWatched(selectedMovie, rating)}
          onUnmarkWatched={() => { onUnmarkWatched(selectedMovie.id); setSelectedMovie(null); }}
          onUpdateRating={rating => onUpdateRating(selectedMovie.id, rating)}
          onShuffle={() => setSelectedMovie(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
        <div className="text-center py-16 text-film-muted">
          <Eye size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Nessun film nella lista dei visti</p>
          <p className="text-xs mt-1 text-film-subtle">Usa lo Shuffle o la Ricerca per aggiungere film</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 bg-film-surface border border-film-border rounded-xl px-3 py-2.5 focus-within:border-film-accent transition-colors">
            <Search size={14} className="text-film-muted" />
            <input
              type="text"
              placeholder="Filtra per titolo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-film-text placeholder:text-film-subtle focus:outline-none flex-1"
            />
          </div>

          <div className="space-y-2">
            {filtered.map(movie => (
              <div
                key={movie.id}
                className="flex items-center gap-4 bg-film-surface border border-film-border rounded-xl p-3 hover:border-film-accent/50 transition-all group"
              >
                <button onClick={() => handleSelect(movie)} className="shrink-0">
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-film-card border border-film-border">
                    {movie.poster_path ? (
                      <img src={getImageUrl(movie.poster_path, 'w92') || ''} alt={movie.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-film-subtle text-xs">🎬</div>
                    )}
                  </div>
                </button>

                <button onClick={() => handleSelect(movie)} className="flex-1 text-left min-w-0">
                  <p className="text-film-text text-sm font-medium truncate group-hover:text-film-accent transition-colors">
                    {loadingId === movie.id ? <span className="text-film-muted">Caricamento...</span> : movie.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-film-muted text-xs">{formatYear(movie.release_date)}</span>
                    {movie.vote_average > 0 && (
                      <span className="text-film-accent text-xs">★ {formatRating(movie.vote_average)}</span>
                    )}
                  </div>
                  {/* Rating personale inline */}
                  <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                    <StarRating
                      value={movie.personal_rating}
                      onChange={rating => onUpdateRating(movie.id, rating)}
                      size="sm"
                    />
                  </div>
                  <span className="text-film-subtle text-xs hidden sm:block mt-0.5">
                    {formatDate(movie.addedAt)}
                  </span>
                </button>

                <button
                  onClick={() => onUnmarkWatched(movie.id)}
                  className="p-2 text-film-subtle hover:text-film-red transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Rimuovi dai visti"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {filtered.length === 0 && search && (
              <div className="text-center py-8 text-film-muted text-sm">
                Nessun film trovato per "{search}"
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
