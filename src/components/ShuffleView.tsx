import { useState } from 'react';
import { Shuffle, SlidersHorizontal, X } from 'lucide-react';
import type { MovieFilters, TMDBMovieDetail } from '../types';
import { useShuffle } from '../hooks/useShuffle';
import { MovieCard } from './MovieCard';
import { FilterPanel } from './FilterPanel';
import { cn } from '../utils';

interface ShuffleViewProps {
  watchedIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (movieId: number, rating: number | null) => Promise<void>;
}

const DEFAULT_FILTERS: MovieFilters = { watchedStatus: 'all' };

export function ShuffleView({
  watchedIds, getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating
}: ShuffleViewProps) {
  const [filters, setFilters] = useState<MovieFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const { movie, loading, error, hasSearched, shuffle } = useShuffle();

  const activeFilterCount = [
    filters.year,
    filters.decade,
    (filters.genreIds?.length || 0) > 0,
    filters.watchedStatus !== 'all',
    (filters.actorIds?.length || 0) > 0,
    filters.directorName,
    filters.minImdbRating,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          onClick={() => shuffle(filters, watchedIds)}
          disabled={loading}
          className={cn(
            'flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-display text-xl tracking-widest transition-all',
            'bg-film-accent text-film-black hover:bg-film-accent-dim active:scale-95',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            loading ? 'animate-pulse-gold' : 'hover:scale-[1.01]'
          )}
        >
          <Shuffle size={22} className={loading ? 'animate-spin-slow' : ''} />
          {loading ? 'CERCANDO...' : hasSearched ? 'ALTRO FILM' : 'SHUFFLE'}
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-4 rounded-2xl border transition-all active:scale-95',
            showFilters
              ? 'bg-film-accent/10 border-film-accent text-film-accent'
              : 'bg-film-surface border-film-border text-film-muted hover:text-film-text hover:border-film-accent/50'
          )}
        >
          {showFilters ? <X size={18} /> : <SlidersHorizontal size={18} />}
          {activeFilterCount > 0 && (
            <span className="bg-film-accent text-film-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="animate-slide-up">
          <FilterPanel filters={filters} onChange={setFilters} />
        </div>
      )}

      {error && (
        <div className="bg-film-red/10 border border-film-red/30 rounded-2xl px-5 py-4 text-film-red text-sm">
          <p className="font-medium mb-1">Nessun film trovato</p>
          <p className="text-film-red/70 text-xs">{error}</p>
        </div>
      )}

      {movie && !loading && (
        <MovieCard
          movie={movie}
          isWatched={watchedIds.has(movie.id)}
          personalRating={getPersonalRating(movie.id)}
          onMarkWatched={rating => onMarkWatched(movie, rating)}
          onUnmarkWatched={() => onUnmarkWatched(movie.id)}
          onUpdateRating={rating => onUpdateRating(movie.id, rating)}
          onShuffle={() => shuffle(filters, watchedIds)}
          loading={loading}
        />
      )}

      {!hasSearched && !loading && (
        <div className="text-center py-20 space-y-4 animate-fade-in">
          <div className="text-6xl opacity-40 select-none">🎬</div>
          <div>
            <p className="text-film-muted text-base">Premi Shuffle per scoprire il tuo prossimo film</p>
            <p className="text-film-subtle text-sm mt-1">Usa i filtri per personalizzare la ricerca</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-film-border rounded-full" />
            <div className="w-16 h-16 border-2 border-film-accent border-t-transparent rounded-full animate-spin absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
          </div>
          <p className="text-film-muted text-sm">Consultando l'archivio cinematografico...</p>
        </div>
      )}
    </div>
  );
}
