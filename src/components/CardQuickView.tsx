import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Heart, Star, BookmarkPlus, BookmarkMinus } from 'lucide-react';
import type { TMDBMovieBasic, TMDBMovieDetail } from '../types';
import { getMovieDetail, getImageUrl, getEnglishTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';

interface Props {
  movie: TMDBMovieBasic;
  mediaType: 'movie' | 'tv';
  isWatched: boolean;
  isLiked: boolean;
  isOnWatchlist: boolean;
  personalRating: number | null;
  onClose: () => void;
  onOpenFull: () => void;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
}

export function CardQuickView({
  movie, mediaType, isWatched, isLiked, isOnWatchlist, personalRating,
  onClose, onOpenFull,
  onMarkWatched, onUnmarkWatched, onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
}: Props) {
  const [detail, setDetail] = useState<TMDBMovieDetail | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch full detail so we can pass it to mark-watched / watchlist actions
  useEffect(() => {
    getMovieDetail(movie.id, mediaType).then(setDetail).catch(() => {});
  }, [movie.id, mediaType]);

  const poster = movie.poster_path ? getImageUrl(movie.poster_path, 'w500') : null;
  const title = getEnglishTitle(movie);
  const year = formatYear(getReleaseDate(movie));

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const handleWatch = () => run(async () => {
    if (!detail) return;
    if (isWatched) await onUnmarkWatched?.(movie.id);
    else await onMarkWatched?.(detail, null);
  });

  const handleLike = () => run(async () => {
    await onToggleLiked?.(movie.id);
  });

  const handleWatchlist = () => run(async () => {
    if (!detail) return;
    if (isOnWatchlist) await onRemoveFromWatchlist?.(movie.id);
    else await onAddToWatchlist?.(detail);
  });

  return createPortal(
    // Full-screen overlay via Portal — renders directly on body, bypasses all containers
    <div
      className="fixed left-0 right-0 z-[9999] flex flex-col"
      style={{ top: 0, height: 'var(--app-height, 100dvh)', background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Blurred poster background */}
      {poster && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
          />
        </div>
      )}

      {/* Top: title + year + X */}
      <div
        className="relative shrink-0 flex items-start justify-between px-5 pt-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div className="flex-1 text-center pr-8">
          <h2 className="text-film-text font-bold text-lg leading-tight">{title}</h2>
          {year && <p className="text-film-subtle text-sm mt-0.5">{year}</p>}
        </div>
        <button
          onClick={onClose}
          className="absolute right-5 top-4 w-9 h-9 flex items-center justify-center rounded-full bg-film-surface/80 active:opacity-60"
        >
          <X size={18} className="text-film-text" />
        </button>
      </div>

      {/* Center: poster — tappable to open full detail */}
      <button
        onClick={onOpenFull}
        className="relative flex-1 flex items-center justify-center px-8 py-4 min-h-0"
      >
        {poster ? (
          <img
            src={poster}
            alt={title}
            className={cn(
              'h-full max-h-full w-auto object-contain rounded-2xl shadow-2xl',
              isWatched && 'opacity-50 grayscale'
            )}
            style={{ maxWidth: '80vw' }}
          />
        ) : (
          <div className="w-full aspect-[2/3] rounded-2xl bg-film-surface border border-film-border flex items-center justify-center text-5xl">
            {mediaType === 'tv' ? '📺' : '🎬'}
          </div>
        )}
      </button>

      {/* Bottom: 4 CTA buttons */}
      <div
        className="relative shrink-0 flex items-center justify-around px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {/* Watch */}
        <button
          onClick={handleWatch}
          className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity"
        >
          <div className={cn(
            'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors',
            isWatched
              ? 'border-film-accent bg-film-accent/20'
              : 'border-film-border bg-film-surface/60'
          )}>
            {isWatched
              ? <EyeOff size={22} className="text-film-accent" />
              : <Eye size={22} className="text-film-muted" />}
          </div>
          <span className={cn('text-xs font-medium', isWatched ? 'text-film-accent' : 'text-film-muted')}>
            Watch
          </span>
        </button>

        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity"
        >
          <div className={cn(
            'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors',
            isLiked
              ? 'border-red-500 bg-red-500/20'
              : 'border-film-border bg-film-surface/60'
          )}>
            <Heart size={22} className={cn(isLiked ? 'text-red-500 fill-red-500' : 'text-film-muted')} />
          </div>
          <span className={cn('text-xs font-medium', isLiked ? 'text-red-400' : 'text-film-muted')}>
            Like
          </span>
        </button>

        {/* Rate — opens full detail */}
        <button
          onClick={onOpenFull}
          className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity"
        >
          <div className={cn(
            'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors',
            personalRating
              ? 'border-yellow-400 bg-yellow-400/20'
              : 'border-film-border bg-film-surface/60'
          )}>
            <Star size={22} className={cn(personalRating ? 'text-yellow-400 fill-yellow-400' : 'text-film-muted')} />
          </div>
          <span className={cn('text-xs font-medium', personalRating ? 'text-yellow-400' : 'text-film-muted')}>
            Rate
          </span>
        </button>

        {/* Watchlist */}
        <button
          onClick={handleWatchlist}
          className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity"
        >
          <div className={cn(
            'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors',
            isOnWatchlist
              ? 'border-film-accent bg-film-accent/20'
              : 'border-film-border bg-film-surface/60'
          )}>
            {isOnWatchlist
              ? <BookmarkMinus size={22} className="text-film-accent" />
              : <BookmarkPlus size={22} className="text-film-muted" />}
          </div>
          <span className={cn('text-xs font-medium', isOnWatchlist ? 'text-film-accent' : 'text-film-muted')}>
            Watchlist
          </span>
        </button>
      </div>
    </div>
  , document.body);
}
