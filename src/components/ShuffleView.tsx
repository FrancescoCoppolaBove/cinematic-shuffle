import { useState } from 'react';
import { Shuffle, SlidersHorizontal, X, Film, Tv, Play, Eye, Bookmark, BookmarkCheck } from 'lucide-react';
import type { MovieFilters, MediaType, TMDBMovieDetail } from '../types';
import { useShuffle } from '../hooks/useShuffle';
import { FilterPanel } from './FilterPanel';
import { RatingModal } from './RatingModal';
import type { RatingResult } from './RatingModal';
import { cn } from '../utils';
import type { WatchedMovie } from '../types';
import { useUserTaste } from '../hooks/useUserTaste';
import { getImageUrl, getTitle, getReleaseDate, getBestTrailer, getWatchProviders, getProviderLogoUrl } from '../services/tmdb';
import { formatYear, formatRating, formatRuntime } from '../utils';
import { Star, Clock, MapPin } from 'lucide-react';

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
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onOpenMovieGlobal?: (id: number, mediaType: 'movie' | 'tv') => void;
}

const DEFAULT_FILTERS: MovieFilters = { watchedStatus: 'all', mediaType: 'movie' };

export function ShuffleView({
  watchedIds, watchlistIds, watchedMovies,
  onMarkWatched, onUnmarkWatched,
  onAddToWatchlist, onRemoveFromWatchlist,
  likedIds, getPersonalRating,
  onToggleLiked, onIncrementRewatch,
  onOpenMovieGlobal,
}: ShuffleViewProps) {
  const [filters, setFilters] = useState<MovieFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const { movie, loading, error, hasSearched, shuffle } = useShuffle();
  const { applyTasteToFilters } = useUserTaste(watchedMovies);

  const isWatched = movie ? watchedIds.has(movie.id) : false;
  const isOnWatchlist = movie ? watchlistIds.has(movie.id) : false;
  const isLiked = movie ? (likedIds?.has(movie.id) ?? false) : false;
  const personalRating = movie ? getPersonalRating(movie.id) : null;
  const rewatchCount = movie ? (watchedMovies.find(m => m.id === movie.id)?.rewatchCount ?? 0) : 0;

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

  function handleShuffle() {
    const enrichedFilters = applyTasteToFilters(filters);
    shuffle(enrichedFilters, watchedIds);
    setShowFilters(false);
  }

  async function handleRatingConfirm(result: RatingResult) {
    setShowRatingModal(false);
    if (!movie) return;
    if (result.watched) {
      await onMarkWatched(movie, result.rating);
      if (onToggleLiked) {
        if (result.liked && !isLiked) await onToggleLiked(movie.id);
        if (!result.liked && isLiked) await onToggleLiked(movie.id);
      }
    } else if (isWatched) {
      await onUnmarkWatched(movie.id);
    }
  }

  // Media type button colors
  const accentColor = filters.mediaType === 'tv' ? 'bg-purple-500' : 'bg-film-accent';
  const textColor = filters.mediaType === 'tv' ? 'text-white' : 'text-film-black';

  return (
    // Full remaining height between header and nav
    <div
      className="flex flex-col bg-film-black"
      style={{
        height: 'calc(100dvh - 57px - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        minHeight: 0,
      }}
    >
      {/* ── Top bar: media type + shuffle + filters ── */}
      <div className="shrink-0 px-4 pt-3 pb-2 space-y-2">
        {/* Row 1: media type tabs (compact) + filter icon */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-film-surface border border-film-border rounded-xl p-1 flex-1">
            {(['movie', 'tv', 'both'] as MediaType[]).map(mt => (
              <button
                key={mt}
                onClick={() => setFilters(f => ({ ...f, mediaType: mt, genreIds: [], year: undefined, decade: undefined }))}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filters.mediaType === mt
                    ? mt === 'tv' ? 'bg-purple-500 text-white' : 'bg-film-accent text-film-black'
                    : 'text-film-muted'
                )}
              >
                {mt === 'movie' && <Film size={12} />}
                {mt === 'tv' && <Tv size={12} />}
                {mt === 'both' && <Shuffle size={12} />}
                {mt === 'movie' ? 'Film' : mt === 'tv' ? 'Serie' : 'Tutti'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all active:scale-95',
              showFilters || activeFilterCount > 0
                ? 'bg-film-accent/10 border-film-accent text-film-accent'
                : 'bg-film-surface border-film-border text-film-muted'
            )}
          >
            {showFilters ? <X size={16} /> : <SlidersHorizontal size={16} />}
            {activeFilterCount > 0 && (
              <span className="bg-film-accent text-film-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: SHUFFLE button */}
        <button
          onClick={handleShuffle}
          disabled={loading}
          className={cn(
            'w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-display text-lg tracking-widest transition-all active:scale-[0.98] disabled:opacity-60',
            accentColor, textColor,
            loading ? 'animate-pulse-gold' : ''
          )}
        >
          <Shuffle size={20} className={loading ? 'animate-spin-slow' : ''} />
          {loading ? 'CERCANDO...' : hasSearched ? 'ALTRO' : 'SHUFFLE'}
        </button>
      </div>

      {/* Filter panel — slides in below top bar */}
      {showFilters && (
        <div className="shrink-0 px-4 pb-2 overflow-y-auto max-h-[40vh] animate-slide-up">
          <FilterPanel filters={filters} onChange={setFilters} />
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Error */}
        {error && (
          <div className="mx-4 mt-2 bg-film-red/10 border border-film-red/30 rounded-2xl px-4 py-3 text-film-red text-sm">
            <p className="font-medium">Nessun risultato</p>
            <p className="text-film-red/70 text-xs mt-0.5">{error}</p>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
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

        {/* Empty state */}
        {!hasSearched && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-film-muted">
            <div className="text-6xl opacity-20 select-none">
              {filters.mediaType === 'tv' ? '📺' : '🎬'}
            </div>
            <p className="text-base">Premi Shuffle per scoprire</p>
            <p className="text-sm text-film-subtle">
              {filters.mediaType === 'tv' ? 'una serie TV' : filters.mediaType === 'both' ? 'qualcosa di nuovo' : 'un film'}
            </p>
          </div>
        )}

        {/* ── Movie card — full info, no scroll needed ── */}
        {movie && !loading && (
          <ShuffleMovieCard
            movie={movie}
            isWatched={isWatched}
            isOnWatchlist={isOnWatchlist}
            rewatchCount={rewatchCount}
            onShuffle={handleShuffle}
            onOpenRating={() => setShowRatingModal(true)}
            onWatchlistToggle={isOnWatchlist
              ? () => onRemoveFromWatchlist(movie.id)
              : () => onAddToWatchlist(movie)
            }
            onOpenDetail={() => onOpenMovieGlobal?.(movie.id, movie.media_type)}
            onIncrementRewatch={onIncrementRewatch ? (delta) => onIncrementRewatch(movie.id, delta) : undefined}
            loading={loading}
          />
        )}
      </div>

      {/* Rating modal */}
      {showRatingModal && movie && (
        <RatingModal
          movie={movie}
          initialWatched={isWatched}
          initialRating={personalRating}
          initialLiked={isLiked}
          initialWatchlist={isOnWatchlist}
          onConfirm={handleRatingConfirm}
          onToggleWatchlist={isOnWatchlist
            ? () => onRemoveFromWatchlist(movie.id)
            : () => onAddToWatchlist(movie)
          }
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}

// ── Inline movie card for shuffle — compact, all info visible ──

interface ShuffleMovieCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  rewatchCount: number;
  onShuffle: () => void;
  onOpenRating: () => void;
  onWatchlistToggle: () => void;
  onOpenDetail: () => void;
  onIncrementRewatch?: (delta: number) => void;
  loading?: boolean;
}

function ShuffleMovieCard({
  movie, isWatched, isOnWatchlist, rewatchCount,
  onShuffle, onOpenRating, onWatchlistToggle, onOpenDetail, onIncrementRewatch,
}: ShuffleMovieCardProps) {
  const [posterErr, setPosterErr] = useState(false);
  const title = getTitle(movie);
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const poster = !posterErr ? getImageUrl(movie.poster_path, 'w342') : null;
  const isTV = movie.media_type === 'tv';
  const trailerUrl = getBestTrailer(movie);
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const creator = isTV ? movie.credits?.crew?.find(c => c.job === 'Creator' || c.job === 'Executive Producer') : null;
  const rating = movie.vote_average;
  const ratingColor = rating >= 7.5 ? 'text-green-400' : rating >= 6 ? 'text-film-accent' : 'text-film-muted';
  const runtime = isTV
    ? (movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]}min/ep` : null)
    : movie.runtime;
  const providers = getWatchProviders(movie);
  const streaming = [...(providers?.flatrate ?? []), ...(providers?.free ?? [])]
    .filter((p, i, a) => a.findIndex(x => x.provider_id === p.provider_id) === i)
    .slice(0, 3);

  return (
    <div className="px-4 pb-4 pt-1 space-y-3 animate-scale-in">
      {/* Backdrop hero */}
      {backdrop && (
        <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img src={backdrop} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-film-black/10 to-film-black/60" />
          {trailerUrl && (
            <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                <Play size={18} className="text-white ml-0.5" fill="white" />
              </div>
            </a>
          )}
        </div>
      )}

      {/* Title — full width */}
      <div>
        <h2 className="font-display text-2xl leading-tight tracking-wide text-film-text break-words">
          {title}
        </h2>
        {movie.tagline && (
          <p className="text-film-accent text-xs italic mt-0.5">"{movie.tagline}"</p>
        )}
      </div>

      {/* Meta + poster row */}
      <div className="flex gap-3">
        {/* Poster small */}
        <div className="shrink-0 w-16 aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card">
          {poster
            ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setPosterErr(true)} />
            : <div className="w-full h-full flex items-center justify-center text-xl">{isTV ? '📺' : '🎬'}</div>
          }
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Rating + year + runtime */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex items-center gap-1">
              <Star size={11} className={ratingColor} fill="currentColor" />
              <span className={cn('font-mono font-bold text-sm', ratingColor)}>{formatRating(rating)}</span>
            </div>
            <span className="text-film-border text-xs">·</span>
            <span className="text-film-muted text-xs">{formatYear(getReleaseDate(movie))}</span>
            {runtime && (
              <>
                <span className="text-film-border text-xs">·</span>
                <div className="flex items-center gap-1 text-film-muted">
                  <Clock size={10} />
                  <span className="text-xs">{typeof runtime === 'number' ? formatRuntime(runtime) : runtime}</span>
                </div>
              </>
            )}
          </div>

          {/* Genres */}
          <div className="flex flex-wrap gap-1">
            {movie.genres?.slice(0, 3).map(g => (
              <span key={g.id} className="px-1.5 py-0.5 rounded-md bg-film-card border border-film-border text-film-muted text-xs">{g.name}</span>
            ))}
          </div>

          {/* Director/creator */}
          {director && (
            <p className="text-film-subtle text-xs">Regia <span className="text-film-muted font-medium">{director.name}</span></p>
          )}
          {creator && (
            <p className="text-film-subtle text-xs">Creato da <span className="text-film-muted font-medium">{creator.name}</span></p>
          )}

          {/* Streaming providers */}
          {streaming.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin size={10} className="text-film-subtle shrink-0" />
              {streaming.map(p => (
                <img key={p.provider_id}
                  src={getProviderLogoUrl(p.logo_path)}
                  alt={p.provider_name}
                  className="w-5 h-5 rounded-md"
                  title={p.provider_name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trama (2 righe) */}
      {movie.overview && (
        <p className="text-film-text/70 text-sm leading-relaxed line-clamp-4">{movie.overview}</p>
      )}

      {/* ── CTA row ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Già visto — apre modal */}
        <button
          onClick={onOpenRating}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
            isWatched ? 'border-green-600/50 bg-green-950/30 text-green-400' : 'border-film-border bg-film-surface text-film-muted'
          )}
        >
          <Eye size={20} />
          <span>{isWatched ? 'Visto ✓' : 'Già visto'}</span>
        </button>

        {/* Watchlist */}
        <button
          onClick={onWatchlistToggle}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
            isOnWatchlist ? 'border-purple-500/40 bg-purple-900/20 text-purple-300' : 'border-film-border bg-film-surface text-film-muted'
          )}
        >
          {isOnWatchlist ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          <span>{isOnWatchlist ? 'Salvato' : 'Watchlist'}</span>
        </button>

        {/* Altro shuffle */}
        <button
          onClick={onShuffle}
          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-film-accent text-film-black font-semibold active:scale-95 transition-all"
        >
          <Shuffle size={20} />
          <span className="text-xs font-bold">Altro</span>
        </button>
      </div>

      {/* Rewatch counter (solo se visto) */}
      {isWatched && onIncrementRewatch && (
        <div className="flex items-center justify-between px-3 py-2 bg-film-surface rounded-xl border border-film-border">
          <div>
            <p className="text-film-muted text-xs font-medium">Rewatch</p>
            <p className="text-film-subtle text-xs">{rewatchCount === 0 ? 'Prima visione' : `Rivisto ${rewatchCount}×`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onIncrementRewatch(-1)} disabled={rewatchCount === 0}
              className="w-7 h-7 rounded-full bg-film-card border border-film-border flex items-center justify-center text-film-text active:scale-90 transition-transform disabled:opacity-30">−</button>
            <span className="text-film-accent font-mono font-bold w-4 text-center">{rewatchCount}</span>
            <button onClick={() => onIncrementRewatch(1)}
              className="w-7 h-7 rounded-full bg-film-accent text-film-black flex items-center justify-center font-bold active:scale-90 transition-transform">+</button>
          </div>
        </div>
      )}

      {/* Link scheda completa — discreto, solo testo */}
      <button onClick={onOpenDetail}
        className="w-full py-1.5 text-film-subtle text-xs text-center active:opacity-60 transition-opacity">
        Cast, saghe e altro → scheda completa
      </button>
    </div>
  );
}
