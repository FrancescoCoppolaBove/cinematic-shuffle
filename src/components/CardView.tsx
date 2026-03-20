/**
 * CardView — fullscreen overlay stile Letterboxd.
 * Poster grande, swipe orizzontale tra film, CTA funzionanti in basso.
 * Rate apre solo le stelle (no dialog completa).
 */
import { useState, useRef } from 'react';
import { X, Eye, Heart, Star, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';

export interface CardItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

interface CardViewProps {
  items: CardItem[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenFull?: (id: number, mediaType: 'movie' | 'tv') => void;
  onClose: () => void;
  initialIndex?: number;
}

type BottomMode = 'cta' | 'rate';

export function CardView({
  items, watchedIds, watchlistIds, likedIds,
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenFull, onClose, initialIndex = 0,
}: CardViewProps) {
  const [index, setIndex] = useState(Math.min(initialIndex, items.length - 1));
  const [imgErr, setImgErr] = useState(false);
  const [bottomMode, setBottomMode] = useState<BottomMode>('cta');
  const [loadingAction, setLoadingAction] = useState<'watch' | 'like' | 'watchlist' | null>(null);

  // Swipe state
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
    setBottomMode('cta');
  }

  // ── Touch swipe ─────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (isAnimating || bottomMode === 'rate') return;
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

  // ── Actions ─────────────────────────────────────────────────────
  async function getDetail(): Promise<TMDBMovieDetail | null> {
    try { return await getMovieDetail(item.id, item.media_type); }
    catch { return null; }
  }

  async function handleWatchToggle() {
    if (loadingAction) return;
    setLoadingAction('watch');
    try {
      if (isWatched) {
        await onUnmarkWatched(item.id);
      } else {
        const d = await getDetail();
        if (d) await onMarkWatched(d, personalRating);
      }
    } finally { setLoadingAction(null); }
  }

  async function handleLikeToggle() {
    if (loadingAction || !onToggleLiked) return;
    setLoadingAction('watch');
    try { await onToggleLiked(item.id); }
    finally { setLoadingAction(null); }
  }

  async function handleWatchlistToggle() {
    if (loadingAction) return;
    setLoadingAction('watch');
    try {
      if (isOnWatchlist) {
        await onRemoveFromWatchlist(item.id);
      } else {
        const d = await getDetail();
        if (d) await onAddToWatchlist(d);
      }
    } finally { setLoadingAction(null); }
  }

  async function handleRateChange(newRating: number | null) {
    // Se non è ancora visto e l'utente vota, segnalo automaticamente come visto
    if (newRating !== null && !isWatched) {
      const d = await getDetail();
      if (d) await onMarkWatched(d, newRating);
    } else {
      await onUpdateRating(item.id, newRating);
    }
  }

  const isDragged = swipeLocked.current === 'h' && dragX !== 0;
  const transition = isDragged ? 'none' : 'transform 260ms cubic-bezier(0.25,0.46,0.45,0.94)';

  return (
    <div
      className="fixed inset-0 z-[85] bg-film-black flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Header ── */}
      <div
        className="relative flex items-center px-5 pb-2 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {/* Counter left */}
        <span className="text-film-subtle text-xs font-mono w-12">
          {index + 1}/{items.length}
        </span>

        {/* Title center */}
        <div className="flex-1 text-center px-2 min-w-0">
          <p className="text-film-text font-semibold text-base truncate">{title}</p>
          <p className="text-film-muted text-sm">{formatYear(getReleaseDate(item))}</p>
        </div>

        {/* Close right — 48×48 tap target */}
        <button
          onClick={onClose}
          className="w-12 h-8 flex items-center justify-center active:opacity-50 transition-opacity"
          style={{ touchAction: 'manipulation' }}
        >
          <X size={22} className="text-film-text" />
        </button>
      </div>

      {/* ── Poster area ── */}
      <div
        className="flex-1 min-h-0 px-4 py-2 relative"
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

        {/* TMDB rating badge */}
        {item.vote_average > 0 && (
          <div className="absolute top-4 left-7 bg-film-black/70 backdrop-blur-sm px-2.5 py-1 rounded-xl pointer-events-none">
            <span className="text-film-accent font-mono font-bold text-sm">★ {formatRating(item.vote_average)}</span>
          </div>
        )}

        {/* Nav arrows */}
        {canPrev && (
          <button onClick={() => goTo(index - 1)}
            className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft size={20} className="text-white" />
          </button>
        )}
        {canNext && (
          <button onClick={() => goTo(index + 1)}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
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

      {/* ── Bottom bar ── */}
      <div className="shrink-0 px-5 pb-2 pt-3 border-t border-film-border/50 bg-film-black">
        {bottomMode === 'cta' ? (
          /* Normal CTA mode */
          <>
            <div className="grid grid-cols-4 gap-3">
              <CtaBtn
                label={isWatched ? 'Watched' : 'Watch'}
                icon={<Eye size={22} strokeWidth={isWatched ? 2.5 : 1.5} />}
                active={isWatched}
                color="text-green-400"
                loading={!!loadingAction}
                onClick={handleWatchToggle}
              />
              <CtaBtn
                label="Like"
                icon={<Heart size={22} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 2 : 1.5} />}
                active={isLiked}
                color="text-pink-400"
                loading={!!loadingAction}
                onClick={handleLikeToggle}
              />
              <CtaBtn
                label={personalRating ? `${personalRating}★` : 'Rate'}
                icon={<Star size={22} fill={personalRating ? 'currentColor' : 'none'} strokeWidth={personalRating ? 2 : 1.5} />}
                active={!!personalRating}
                color="text-film-accent"
                onClick={() => setBottomMode('rate')}
              />
              <CtaBtn
                label={isOnWatchlist ? 'Saved' : 'Watchlist'}
                icon={isOnWatchlist
                  ? <BookmarkCheck size={22} strokeWidth={2} />
                  : <Bookmark size={22} strokeWidth={1.5} />
                }
                active={isOnWatchlist}
                color="text-purple-400"
                loading={!!loadingAction}
                onClick={handleWatchlistToggle}
              />
            </div>
            {onOpenFull && (
              <button
                onClick={() => { onOpenFull?.(item.id, item.media_type); onClose(); }}
                className="w-full mt-2 py-1.5 text-film-subtle text-xs text-center active:opacity-60">
                Scheda completa →
              </button>
            )}
          </>
        ) : (
          /* Rate mode — solo stelle */
          <div className="py-2">
            <p className="text-film-subtle text-xs text-center uppercase tracking-widest mb-4">
              {personalRating ? `${personalRating} / 5` : 'Tocca o scorri per votare'}
            </p>
            <InlineStarRating
              value={personalRating}
              onChange={handleRateChange}
            />
            <button
              onClick={() => setBottomMode('cta')}
              className="w-full mt-5 py-3 bg-film-surface border border-film-border rounded-2xl text-film-text text-sm font-medium active:scale-[0.98] transition-transform"
            >
              {personalRating ? 'Fatto' : 'Salta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline star rating (swipe/touch, no modal) ───────────────────

function InlineStarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (r: number | null) => void;
}) {
  const [live, setLive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const STAR_COUNT = 5;
  const displayed = live ?? value ?? 0;

  function ratingFromX(clientX: number): number {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const starW = rect.width / STAR_COUNT;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    const starIdx = Math.floor(x / starW);
    const offset = x - starIdx * starW;
    const half = offset < starW / 2;
    return Math.max(0.5, Math.min(5, half ? starIdx + 0.5 : starIdx + 1));
  }

  function onTouchStart(e: React.TouchEvent) {
    dragging.current = true;
    setLive(ratingFromX(e.touches[0].clientX));
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (dragging.current) setLive(ratingFromX(e.touches[0].clientX));
  }
  function onTouchEnd() {
    dragging.current = false;
    if (live !== null) onChange(live === value ? null : live);
    setLive(null);
  }
  function onMouseMove(e: React.MouseEvent) { setLive(ratingFromX(e.clientX)); }
  function onMouseLeave() { setLive(null); }
  function onClick(e: React.MouseEvent) {
    const r = ratingFromX(e.clientX);
    onChange(r === value ? null : r);
  }

  return (
    <div
      ref={ref}
      className="flex w-full cursor-pointer touch-none select-none"
      style={{ gap: 8 }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const full = displayed >= star;
        const half = !full && displayed >= star - 0.5;
        return (
          <svg
            key={star}
            viewBox="0 0 24 24"
            className="flex-1"
            style={{ height: 48 }}
          >
            {half && (
              <defs>
                <linearGradient id={`hg${star}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="#E8C547" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              stroke={full || half ? '#E8C547' : '#3A3A52'}
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill={full ? '#E8C547' : half ? `url(#hg${star})` : 'none'}
            />
          </svg>
        );
      })}
    </div>
  );
}

function CtaBtn({
  label, icon, active, color, loading, onClick,
}: {
  label: string; icon: React.ReactNode;
  active: boolean; color: string;
  loading?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-center gap-1.5 py-2 active:scale-90 transition-transform disabled:opacity-50"
      style={{ touchAction: 'manipulation' }}
    >
      <span className={cn('transition-colors', active ? color : 'text-white/40')}>{icon}</span>
      <span className={cn('text-xs font-medium leading-none', active ? 'text-white/90' : 'text-white/40')}>
        {label}
      </span>
    </button>
  );
}
