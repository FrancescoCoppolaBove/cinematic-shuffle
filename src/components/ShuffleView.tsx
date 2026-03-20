import { useState } from 'react';
import { Shuffle, SlidersHorizontal, X, Film, Tv } from 'lucide-react';
import type { MovieFilters, MediaType, TMDBMovieDetail } from '../types';
import { useShuffle } from '../hooks/useShuffle';
import { ShuffleCard } from './ShuffleCard';
import { FilterPanel } from './FilterPanel';
import { cn } from '../utils';
import type { WatchedMovie } from '../types';
import type { RatingResult } from './RatingModal';
import { useUserTaste } from '../hooks/useUserTaste';

interface ShuffleViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  watchedMovies: WatchedMovie[];
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  likedIds?: Set<number>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onOpenMovieGlobal?: (id: number, mediaType: 'movie' | 'tv', playlist?: import('../hooks/useNavigationStack').PlaylistItem[], index?: number) => void;
}

const DEFAULT_FILTERS: MovieFilters = { watchedStatus: 'all', mediaType: 'movie' };

const MEDIA_TABS: { value: MediaType; label: string; icon: typeof Film }[] = [
  { value: 'movie', label: 'Film', icon: Film },
  { value: 'tv', label: 'Serie TV', icon: Tv },
  { value: 'both', label: 'Entrambi', icon: Shuffle },
];

export function ShuffleView({
  watchedIds, watchlistIds, watchedMovies,
  onMarkWatched, onUnmarkWatched,
  onAddToWatchlist, onRemoveFromWatchlist,
  likedIds, getPersonalRating,
  onIncrementRewatch,
  onOpenMovieGlobal,
}: ShuffleViewProps) {
  const [filters, setFilters] = useState<MovieFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const { movie, loading, error, hasSearched, shuffle } = useShuffle();
  const { profile, applyTasteToFilters } = useUserTaste(watchedMovies);

  const activeFilterCount = [
    filters.year, filters.decade,
    (filters.genreIds?.length || 0) > 0,
    filters.watchedStatus !== 'all',
    (filters.actorIds?.length || 0) > 0,
    filters.directorName,
    filters.minImdbRating,
    (filters.withProviders?.length || 0) > 0,
    filters.withAwards,
  ].filter(Boolean).length;

  function handleMediaType(mt: MediaType) {
    setFilters(f => ({ ...f, mediaType: mt, genreIds: [], year: undefined, decade: undefined }));
  }

  function handleShuffle() {
    // Applica i gusti dell'utente ai filtri (se ci sono abbastanza dati)
    const enrichedFilters = applyTasteToFilters(filters);
    shuffle(enrichedFilters, watchedIds);
  }

  return (
    <div className="space-y-4">
      {/* Media type selector */}
      <div className="flex gap-2 bg-film-surface border border-film-border rounded-2xl p-1.5">
        {MEDIA_TABS.map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => handleMediaType(value)}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
              filters.mediaType === value
                ? value === 'tv' ? 'bg-purple-500 text-white shadow-sm' : 'bg-film-accent text-film-black shadow-sm'
                : 'text-film-muted hover:text-film-text')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Taste indicator */}
      {profile.hasEnoughData && (
        <div className="flex items-center gap-2 px-3 py-2 bg-film-surface/50 rounded-xl border border-film-accent/20">
          <span className="text-film-accent text-xs">✦</span>
          <p className="text-film-subtle text-xs">
            Shuffle calibrato sui tuoi gusti · {watchedMovies.length} film analizzati
          </p>
        </div>
      )}

      {/* Shuffle + filters row */}
      <div className="flex gap-3">
        <button onClick={handleShuffle} disabled={loading}
          className={cn(
            'flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-display text-xl tracking-widest transition-all',
            filters.mediaType === 'tv' ? 'bg-purple-500 text-white' : 'bg-film-accent text-film-black',
            'active:scale-95 disabled:opacity-60',
            loading ? 'animate-pulse-gold' : ''
          )}>
          <Shuffle size={22} className={loading ? 'animate-spin-slow' : ''} />
          {loading ? 'CERCANDO...' : hasSearched ? 'ALTRO' : 'SHUFFLE'}
        </button>

        <button onClick={() => setShowFilters(!showFilters)}
          className={cn('flex items-center gap-2 px-4 py-4 rounded-2xl border transition-all active:scale-95',
            showFilters || activeFilterCount > 0
              ? 'bg-film-accent/10 border-film-accent text-film-accent'
              : 'bg-film-surface border-film-border text-film-muted')}>
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
          <p className="font-medium mb-1">Nessun risultato</p>
          <p className="text-film-red/70 text-xs">{error}</p>
        </div>
      )}

      {movie && !loading && (
        <ShuffleCard
          movie={movie}
          isWatched={watchedIds.has(movie.id)}
          isOnWatchlist={watchlistIds.has(movie.id)}
          onShuffle={handleShuffle}
          onMarkWatched={async (result: RatingResult) => {
            if (result.watched) await onMarkWatched(movie, result.rating);
            else await onUnmarkWatched(movie.id);
          }}
          onUnmarkWatched={() => onUnmarkWatched(movie.id)}
          onAddToWatchlist={() => onAddToWatchlist(movie)}
          onRemoveFromWatchlist={() => onRemoveFromWatchlist(movie.id)}
          isLiked={likedIds?.has(movie.id) ?? false}
          personalRating={getPersonalRating(movie.id)}
          onOpenDetail={() => onOpenMovieGlobal?.(movie.id, movie.media_type)}
          onIncrementRewatch={onIncrementRewatch}
          rewatchCount={watchedMovies.find(m => m.id === movie.id)?.rewatchCount ?? 0}
          loading={loading}
        />
      )}

      {!hasSearched && !loading && (
        <div className="text-center py-16 space-y-3 animate-fade-in text-film-muted">
          <div className="text-5xl opacity-30 select-none">
            {filters.mediaType === 'tv' ? '📺' : '🎬'}
          </div>
          <p className="text-base">Premi Shuffle per scoprire{' '}
            {filters.mediaType === 'tv' ? 'una serie TV' : filters.mediaType === 'both' ? 'qualcosa' : 'un film'}
          </p>
          <p className="text-sm text-film-subtle">Usa i filtri per personalizzare</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 border-2 border-film-border rounded-full" />
            <div className={cn('w-16 h-16 border-2 border-t-transparent rounded-full animate-spin absolute inset-0',
              filters.mediaType === 'tv' ? 'border-purple-500' : 'border-film-accent')} />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
              {filters.mediaType === 'tv' ? '📺' : '🎬'}
            </div>
          </div>
          <p className="text-film-muted text-sm">Cercando nella libreria...</p>
        </div>
      )}
    </div>
  );
}
