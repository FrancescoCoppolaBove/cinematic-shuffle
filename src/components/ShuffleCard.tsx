/**
 * ShuffleCard — card nella sezione Shuffle.
 * Contiene tutte le informazioni utili inline (no click extra per i dettagli).
 * "Già visto" apre la RatingModal per votare subito.
 */
import { useState } from 'react';
import { Play, Eye, EyeOff, Bookmark, BookmarkCheck, Shuffle, ChevronRight, Star, Clock, Tv, Film, MapPin } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate, getBestTrailer, getWatchProviders, getProviderLogoUrl } from '../services/tmdb';
import { formatYear, formatRating, formatRuntime, cn } from '../utils';
import { RatingModal } from './RatingModal';

interface ShuffleCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  onShuffle: () => void;
  onMarkWatched: (rating: number | null, liked: boolean) => void;
  onUnmarkWatched: () => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onOpenDetail: () => void;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  rewatchCount?: number;
  loading?: boolean;
}

export function ShuffleCard({
  movie, isWatched, isOnWatchlist,
  onShuffle, onMarkWatched, onUnmarkWatched,
  onAddToWatchlist, onRemoveFromWatchlist,
  onOpenDetail, onIncrementRewatch, rewatchCount = 0, loading,
}: ShuffleCardProps) {
  const [posterErr, setPosterErr] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const title = getTitle(movie);
  const releaseDate = getReleaseDate(movie);
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
  const streamingProviders = [
    ...(providers?.flatrate ?? []),
    ...(providers?.free ?? []),
  ].filter((p, i, arr) => arr.findIndex(x => x.provider_id === p.provider_id) === i).slice(0, 4);

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-film-border bg-film-deep animate-scale-in">
        {/* Backdrop */}
        {backdrop && (
          <div className="relative w-full aspect-video">
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-film-black/10 to-film-deep" />
            {/* Badge */}
            <div className="absolute top-3 left-3">
              <span className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm border',
                isTV ? 'bg-purple-900/80 border-purple-500/50 text-purple-200' : 'bg-film-black/70 border-white/10 text-white/70'
              )}>
                {isTV ? <Tv size={10} /> : <Film size={10} />}
                {isTV ? 'Serie TV' : 'Film'}
              </span>
            </div>
            {/* Trailer */}
            {trailerUrl && (
              <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                  <Play size={22} className="text-white ml-1" fill="white" />
                </div>
              </a>
            )}
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Poster + title + meta */}
          {/* Title — full width, no squeezing */}
          <div>
            <h2 className="font-display text-2xl leading-tight tracking-wide text-film-text break-words mb-1">
              {title}
            </h2>
            {movie.tagline && (
              <p className="text-film-accent text-xs italic leading-snug mb-2">"{movie.tagline}"</p>
            )}
          </div>

          {/* Poster + meta row */}
          <div className="flex gap-3">
            <div className="shrink-0 w-[72px] aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card">
              {poster
                ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setPosterErr(true)} />
                : <div className="w-full h-full flex items-center justify-center text-2xl">{isTV ? '📺' : '🎬'}</div>
              }
            </div>

            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="flex items-center gap-1">
                  <Star size={11} className={ratingColor} fill="currentColor" />
                  <span className={cn('font-mono font-bold text-sm', ratingColor)}>{formatRating(rating)}</span>
                  <span className="text-film-subtle text-xs">/10</span>
                </div>
                <span className="text-film-border text-xs">·</span>
                <span className="text-film-muted text-xs">{formatYear(releaseDate)}</span>
                {runtime && (
                  <>
                    <span className="text-film-border text-xs">·</span>
                    <div className="flex items-center gap-1 text-film-muted">
                      <Clock size={10} />
                      <span className="text-xs">{typeof runtime === 'number' ? formatRuntime(runtime) : runtime}</span>
                    </div>
                  </>
                )}
                {isTV && movie.number_of_seasons && (
                  <>
                    <span className="text-film-border text-xs">·</span>
                    <span className="text-film-muted text-xs">{movie.number_of_seasons} stag.</span>
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

              {/* Regia */}
              {director && (
                <p className="text-film-subtle text-xs mt-1.5">
                  Regia <span className="text-film-muted font-medium">{director.name}</span>
                </p>
              )}
              {creator && (
                <p className="text-film-subtle text-xs mt-1.5">
                  Creato da <span className="text-film-muted font-medium">{creator.name}</span>
                </p>
              )}
            </div>
          </div>

          {/* Trama (prime 3 righe) */}
          {movie.overview && (
            <p className="text-film-text/70 text-sm leading-relaxed line-clamp-3">
              {movie.overview}
            </p>
          )}

          {/* Streaming providers (se disponibili) */}
          {streamingProviders.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin size={11} className="text-film-subtle shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {streamingProviders.map(p => (
                  <div key={p.provider_id} className="flex items-center gap-1 bg-film-card border border-film-border rounded-lg px-2 py-1">
                    <img
                      src={getProviderLogoUrl(p.logo_path)}
                      alt={p.provider_name}
                      className="w-4 h-4 rounded-sm"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-film-text text-xs">{p.provider_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA row ── */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Altro shuffle */}
            <button
              onClick={onShuffle}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-film-accent text-film-black font-semibold active:scale-95 transition-all disabled:opacity-50"
            >
              <Shuffle size={20} className={loading ? 'animate-spin-slow' : ''} />
              <span className="text-xs font-bold">{loading ? '...' : 'Altro'}</span>
            </button>

            {/* Già visto — apre RatingModal */}
            <button
              onClick={isWatched ? onUnmarkWatched : () => setShowRatingModal(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
                isWatched
                  ? 'border-green-600/50 bg-green-950/30 text-green-400'
                  : 'border-film-border bg-film-surface text-film-muted'
              )}
            >
              {isWatched ? <EyeOff size={20} /> : <Eye size={20} />}
              <span>{isWatched ? 'Visto ✓' : 'Già visto'}</span>
            </button>

            {/* Watchlist */}
            <button
              onClick={isOnWatchlist ? onRemoveFromWatchlist : onAddToWatchlist}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border transition-all active:scale-95 text-xs font-medium',
                isOnWatchlist
                  ? 'border-purple-500/40 bg-purple-900/20 text-purple-300'
                  : 'border-film-border bg-film-surface text-film-muted'
              )}
            >
              {isOnWatchlist ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              <span>{isOnWatchlist ? 'Salvato' : 'Watchlist'}</span>
            </button>
          </div>

          {/* Rewatch counter — solo se visto */}
          {isWatched && onIncrementRewatch && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-film-surface rounded-xl border border-film-border">
              <div>
                <p className="text-film-muted text-xs font-medium">Rewatch</p>
                <p className="text-film-subtle text-xs">
                  {rewatchCount === 0 ? 'Prima visione' : `Rivisto ${rewatchCount}×`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => onIncrementRewatch(movie.id, -1)} disabled={rewatchCount === 0}
                  className="w-8 h-8 rounded-full bg-film-card border border-film-border flex items-center justify-center text-film-text active:scale-90 transition-transform disabled:opacity-30">
                  −
                </button>
                <span className="text-film-accent font-mono font-bold w-5 text-center">{rewatchCount}</span>
                <button onClick={() => onIncrementRewatch(movie.id, 1)}
                  className="w-8 h-8 rounded-full bg-film-accent text-film-black flex items-center justify-center font-bold active:scale-90 transition-transform">
                  +
                </button>
              </div>
            </div>
          )}

          {/* Scheda completa */}
          <button
            onClick={onOpenDetail}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-film-surface border border-film-border text-film-muted active:opacity-70 transition-opacity"
          >
            <span className="text-sm">Scheda completa</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showRatingModal && (
        <RatingModal
          movie={movie}
          onConfirm={(rating, liked) => {
            setShowRatingModal(false);
            onMarkWatched(rating, liked);
          }}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </>
  );
}
