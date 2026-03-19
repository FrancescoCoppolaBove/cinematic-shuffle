/**
 * ShuffleCard — la card compatta mostrata nella sezione Shuffle.
 * Design pulito, tutto il titolo visibile, CTA grandi per mobile.
 * Cliccando "Dettagli" apre il MovieDetailScreen fullscreen.
 */
import { useState } from 'react';
import { Play, Eye, Bookmark, BookmarkCheck, Shuffle, ChevronRight, Star, Clock, Tv, Film } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate, getBestTrailer } from '../services/tmdb';
import { formatYear, formatRating, formatRuntime, cn } from '../utils';

interface ShuffleCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  onShuffle: () => void;
  onMarkWatched: () => void;
  onUnmarkWatched: () => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onOpenDetail: () => void;
  loading?: boolean;
}

export function ShuffleCard({
  movie, isWatched, isOnWatchlist,
  onShuffle, onMarkWatched, onUnmarkWatched,
  onAddToWatchlist, onRemoveFromWatchlist,
  onOpenDetail, loading,
}: ShuffleCardProps) {
  const [posterErr, setPosterErr] = useState(false);
  const title = getTitle(movie);
  const releaseDate = getReleaseDate(movie);
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const poster = !posterErr ? getImageUrl(movie.poster_path, 'w500') : null;
  const isTV = movie.media_type === 'tv';
  const trailerUrl = getBestTrailer(movie);
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const rating = movie.vote_average;
  const ratingColor = rating >= 7.5 ? 'text-green-400' : rating >= 6 ? 'text-film-accent' : 'text-film-muted';
  const runtime = isTV
    ? (movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]}min/ep` : null)
    : movie.runtime;

  return (
    <div className="rounded-2xl overflow-hidden border border-film-border bg-film-deep animate-scale-in">
      {/* Backdrop hero */}
      {backdrop ? (
        <div className="relative w-full aspect-video">
          <img src={backdrop} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-film-black/20 to-film-deep" />
          {/* Media badge */}
          <div className="absolute top-3 left-3">
            <span className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm border',
              isTV ? 'bg-purple-900/80 border-purple-500/50 text-purple-200' : 'bg-film-black/70 border-white/10 text-white/70'
            )}>
              {isTV ? <Tv size={10} /> : <Film size={10} />}
              {isTV ? 'Serie TV' : 'Film'}
            </span>
          </div>
          {/* Trailer button */}
          {trailerUrl && (
            <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                <Play size={22} className="text-white ml-1" fill="white" />
              </div>
            </a>
          )}
        </div>
      ) : null}

      <div className="p-4 space-y-4">
        {/* Title row with poster */}
        <div className="flex gap-3">
          {/* Poster mini */}
          <div className="shrink-0 w-16 aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card">
            {poster
              ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setPosterErr(true)} />
              : <div className="w-full h-full flex items-center justify-center text-xl">{isTV ? '📺' : '🎬'}</div>
            }
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            {/* Full title — no truncation */}
            <h2 className="font-display text-xl leading-tight tracking-wide text-film-text break-words">
              {title}
            </h2>
            {movie.tagline && (
              <p className="text-film-accent text-xs italic mt-0.5 leading-snug">"{movie.tagline}"</p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
              <div className="flex items-center gap-1">
                <Star size={11} className={ratingColor} fill="currentColor" />
                <span className={cn('font-mono font-bold text-sm', ratingColor)}>{formatRating(rating)}</span>
              </div>
              <span className="text-film-border">·</span>
              <span className="text-film-muted text-xs">{formatYear(releaseDate)}</span>
              {runtime && (
                <>
                  <span className="text-film-border">·</span>
                  <div className="flex items-center gap-1 text-film-muted">
                    <Clock size={10} />
                    <span className="text-xs">{typeof runtime === 'number' ? formatRuntime(runtime) : runtime}</span>
                  </div>
                </>
              )}
            </div>
            {/* Generi */}
            <div className="flex flex-wrap gap-1 mt-2">
              {movie.genres?.slice(0, 3).map(g => (
                <span key={g.id} className="px-2 py-0.5 rounded-md bg-film-card border border-film-border text-film-muted text-xs">
                  {g.name}
                </span>
              ))}
            </div>
            {director && (
              <p className="text-film-subtle text-xs mt-1.5">
                Regia <span className="text-film-muted font-medium">{director.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── CTA row — grandi per mobile ── */}
        <div className="grid grid-cols-3 gap-2">
          {/* Altro shuffle */}
          <button
            onClick={onShuffle}
            disabled={loading}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-film-accent text-film-black font-semibold active:scale-95 transition-all disabled:opacity-50"
          >
            <Shuffle size={18} className={loading ? 'animate-spin-slow' : ''} />
            <span className="text-xs font-bold">{loading ? '...' : 'Altro'}</span>
          </button>

          {/* Già visto */}
          <button
            onClick={isWatched ? onUnmarkWatched : onMarkWatched}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
              isWatched
                ? 'border-green-600/50 bg-green-950/30 text-green-400'
                : 'border-film-border bg-film-surface text-film-muted'
            )}
          >
            <Eye size={18} />
            <span>{isWatched ? 'Visto ✓' : 'Già visto'}</span>
          </button>

          {/* Watchlist */}
          {!isWatched ? (
            <button
              onClick={isOnWatchlist ? onRemoveFromWatchlist : onAddToWatchlist}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
                isOnWatchlist
                  ? 'border-purple-500/40 bg-purple-900/20 text-purple-300'
                  : 'border-film-border bg-film-surface text-film-muted'
              )}
            >
              {isOnWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              <span>{isOnWatchlist ? 'Salvato' : 'Watchlist'}</span>
            </button>
          ) : (
            /* Se già visto al posto di watchlist metti "Dettagli" */
            <button
              onClick={onOpenDetail}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border border-film-border bg-film-surface text-film-muted active:scale-95 transition-all text-xs font-medium"
            >
              <ChevronRight size={18} />
              <span>Dettagli</span>
            </button>
          )}
        </div>

        {/* Link dettagli completo */}
        <button
          onClick={onOpenDetail}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-film-surface border border-film-border text-film-muted active:opacity-70 transition-opacity"
        >
          <span className="text-sm">Scheda completa</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
