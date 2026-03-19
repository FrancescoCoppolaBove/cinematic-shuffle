/**
 * CardView — fullscreen overlay stile Letterboxd.
 * Poster grande che riempie lo schermo, CTA in basso fisso,
 * swipe orizzontale per navigare tra i film della lista.
 * Le CTA (Watch/Like/Rate/Watchlist) funzionano direttamente senza caricare detail.
 */
import { useState, useRef } from 'react';
import { X, Eye, Heart, Star, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';

export interface CardItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
  personal_rating?: number | null;
}

interface CardViewProps {
  items: CardItem[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenFull?: (id: number, mediaType: 'movie' | 'tv') => void;
  onClose?: () => void;
  initialIndex?: number;
}

export function CardView({
  items, watchedIds, watchlistIds, likedIds,
  getPersonalRating, onMarkWatched, onUnmarkWatched,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenFull, onClose, initialIndex = 0,
}: CardViewProps) {
  const [index, setIndex] = useState(initialIndex);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  // Swipe animation state
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeLocked = useRef<'h' | 'v' | null>(null);
  const activeDragX = useRef(0);

  const item = items[index];
  if (!item) return null;

  const isWatched = watchedIds.has(item.id);
  const isOnWatchlist = watchlistIds.has(item.id);
  const isLiked = likedIds?.has(item.id) ?? false;
  const personalRating = getPersonalRating(item.id);
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w500') : null;
  const title = getTitle(item);
  const canPrev = index > 0;
  const canNext = index < items.length - 1;

  function goTo(i: number) {
    setIndex(i);
    setImgErr(false);
  }

  // Touch swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeLocked.current = null;
    activeDragX.current = 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!swipeLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (swipeLocked.current === 'h') {
      e.preventDefault();
      let resist = dx;
      if ((dx > 0 && !canPrev) || (dx < 0 && !canNext)) {
        resist = Math.sign(dx) * Math.sqrt(Math.abs(dx)) * 7;
      }
      activeDragX.current = resist;
      setDragX(resist);
    }
  }

  function handleTouchEnd() {
    if (swipeLocked.current !== 'h') {
      touchStartX.current = null;
      swipeLocked.current = null;
      setDragX(0);
      return;
    }
    const dx = activeDragX.current;
    const threshold = 70;
    if (dx < -threshold && canNext) {
      setIsAnimating(true);
      setDragX(-window.innerWidth);
      setTimeout(() => { goTo(index + 1); setDragX(0); setIsAnimating(false); }, 260);
    } else if (dx > threshold && canPrev) {
      setIsAnimating(true);
      setDragX(window.innerWidth);
      setTimeout(() => { goTo(index - 1); setDragX(0); setIsAnimating(false); }, 260);
    } else {
      setDragX(0);
    }
    touchStartX.current = null;
    swipeLocked.current = null;
    activeDragX.current = 0;
  }

  // Load full detail only when needed (for watch/watchlist)
  async function getDetail(): Promise<TMDBMovieDetail | null> {
    try { return await getMovieDetail(item.id, item.media_type); }
    catch { return null; }
  }

  async function handleMarkWatched(rating: number | null, liked: boolean) {
    const d = await getDetail();
    if (d) {
      await onMarkWatched(d, rating);
      if (liked && onToggleLiked) await onToggleLiked(item.id);
    }
    setShowRatingModal(false);
  }

  async function handleWatchlistToggle() {
    if (isOnWatchlist) {
      onRemoveFromWatchlist(item.id);
    } else {
      const d = await getDetail();
      if (d) onAddToWatchlist(d);
    }
  }

  async function handleLikedToggle() {
    if (onToggleLiked) onToggleLiked(item.id);
  }

  const isDragged = swipeLocked.current === 'h' && dragX !== 0;
  const transition = isDragged ? 'none' : 'transform 260ms cubic-bezier(0.25,0.46,0.45,0.94)';

  return (
    <div
      className="fixed inset-0 z-[85] bg-film-black flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="text-center flex-1">
          <p className="text-film-text font-semibold text-base truncate">{title}</p>
          <p className="text-film-muted text-sm">{formatYear(getReleaseDate(item))}</p>
        </div>
        <button
          onClick={onClose}
          className="absolute right-5 w-8 h-8 flex items-center justify-center active:opacity-60"
        >
          <X size={22} className="text-film-text" />
        </button>
      </div>

      {/* Poster area — fills available height */}
      <div
        className="flex-1 min-h-0 px-5 py-2 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full h-full"
          style={{ transform: dragX ? `translateX(${dragX}px)` : 'none', transition }}
        >
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="w-full h-full object-contain rounded-2xl"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-full h-full bg-film-surface rounded-2xl flex items-center justify-center text-6xl">
              {item.media_type === 'tv' ? '📺' : '🎬'}
            </div>
          )}
        </div>

        {/* TMDB rating */}
        {item.vote_average > 0 && (
          <div className="absolute top-5 left-8 bg-film-black/70 backdrop-blur-sm px-2.5 py-1 rounded-xl">
            <span className="text-film-accent font-mono font-bold text-sm">★ {formatRating(item.vote_average)}</span>
          </div>
        )}

        {/* Nav arrows */}
        {canPrev && (
          <button onClick={() => goTo(index - 1)}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft size={20} className="text-white" />
          </button>
        )}
        {canNext && (
          <button onClick={() => goTo(index + 1)}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <ChevronRight size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Dots */}
      {items.length > 1 && items.length <= 24 && (
        <div className="flex justify-center gap-1.5 py-2 shrink-0">
          {items.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-200"
              style={{ width: i === index ? 16 : 6, height: 4, background: i === index ? '#E8C547' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
      )}

      {/* Bottom CTA bar — sempre visibile */}
      <div className="shrink-0 px-5 pb-3 pt-2 border-t border-film-border bg-film-black">
        <div className="grid grid-cols-4 gap-2">
          {/* Watch */}
          <BottomCta
            label={isWatched ? 'Watched' : 'Watch'}
            icon={<Eye size={24} strokeWidth={isWatched ? 2.5 : 1.5} />}
            active={isWatched}
            activeColor="text-green-400"
            onClick={() => isWatched ? onUnmarkWatched(item.id) : setShowRatingModal(true)}
          />

          {/* Like */}
          <BottomCta
            label="Like"
            icon={<Heart size={24} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 2 : 1.5} />}
            active={isLiked}
            activeColor="text-pink-400"
            onClick={handleLikedToggle}
          />

          {/* Rate */}
          <BottomCta
            label={personalRating ? `${personalRating}★` : 'Rate'}
            icon={<Star size={24} fill={personalRating ? 'currentColor' : 'none'} strokeWidth={personalRating ? 2 : 1.5} />}
            active={!!personalRating}
            activeColor="text-film-accent"
            onClick={() => setShowRatingModal(true)}
          />

          {/* Watchlist */}
          <BottomCta
            label={isOnWatchlist ? 'Saved' : 'Watchlist'}
            icon={isOnWatchlist
              ? <BookmarkCheck size={24} strokeWidth={2} />
              : <Bookmark size={24} strokeWidth={1.5} />
            }
            active={isOnWatchlist}
            activeColor="text-purple-400"
            onClick={handleWatchlistToggle}
          />
        </div>

        {/* Open full detail */}
        {onOpenFull && (
          <button
            onClick={() => onOpenFull(item.id, item.media_type)}
            className="w-full mt-2 py-2 text-film-subtle text-xs text-center active:opacity-60 transition-opacity"
          >
            Scheda completa →
          </button>
        )}
      </div>

      {/* Rating modal */}
      {showRatingModal && (
        <RatingModal
          movie={{ id: item.id, title, poster_path: item.poster_path, media_type: item.media_type } as TMDBMovieDetail}
          initialWatched={isWatched}
          initialLiked={isLiked}
          onConfirm={handleMarkWatched}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}

function BottomCta({ label, icon, active, activeColor, onClick }: {
  label: string; icon: React.ReactNode;
  active: boolean; activeColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-2 active:scale-90 transition-transform"
    >
      <span className={cn('transition-colors', active ? activeColor : 'text-white/40')}>{icon}</span>
      <span className={cn('text-xs font-medium', active ? 'text-white/90' : 'text-white/40')}>{label}</span>
    </button>
  );
}
