import { useState } from 'react';
import { Eye, EyeOff, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getMovieDetail, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { StarRating } from './StarRating';
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
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenFull?: (id: number, mediaType: 'movie' | 'tv') => void;
  initialIndex?: number;
}

export function CardView({
  items, watchedIds, watchlistIds, getPersonalRating,
  onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onOpenFull, initialIndex = 0,
}: CardViewProps) {
  const [index, setIndex] = useState(initialIndex);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<TMDBMovieDetail | null>(null);
  const [imgErr, setImgErr] = useState(false);

  const item = items[index];
  if (!item) return null;

  const isWatched = watchedIds.has(item.id);
  const isOnWatchlist = watchlistIds.has(item.id);
  const personalRating = getPersonalRating(item.id);
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w500') : null;
  const title = getTitle(item);

  function prev() {
    if (index > 0) { setIndex(index - 1); setImgErr(false); setCurrentDetail(null); }
  }
  function next() {
    if (index < items.length - 1) { setIndex(index + 1); setImgErr(false); setCurrentDetail(null); }
  }

  async function getDetail(): Promise<TMDBMovieDetail | null> {
    if (currentDetail) return currentDetail;
    setLoadingDetail(true);
    try {
      const d = await getMovieDetail(item.id, item.media_type);
      setCurrentDetail(d);
      return d;
    } catch { return null; }
    finally { setLoadingDetail(false); }
  }

  async function handleMarkWatched() {
    setShowRatingModal(true);
    await getDetail();
  }

  async function handleUnmarkWatched() {
    onUnmarkWatched(item.id);
  }

  async function handleAddWatchlist() {
    const d = await getDetail();
    if (d) onAddToWatchlist(d);
  }

  async function handleRemoveWatchlist() {
    onRemoveFromWatchlist(item.id);
  }

  async function handleRatingConfirm(rating: number | null) {
    setShowRatingModal(false);
    const d = await getDetail();
    if (d) onMarkWatched(d, rating);
  }

  return (
    <>
      <div className="flex flex-col" style={{ minHeight: 'calc(100svh - 180px)' }}>
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-film-text font-display text-xl tracking-wide leading-none">{title}</h2>
            <p className="text-film-muted text-xs mt-0.5">{formatYear(getReleaseDate(item))}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-film-subtle text-xs font-mono">{index + 1}/{items.length}</span>
            {onOpenFull && (
              <button
                onClick={() => onOpenFull(item.id, item.media_type)}
                className="text-film-muted hover:text-film-accent text-xs underline transition-colors"
              >
                Scheda completa
              </button>
            )}
          </div>
        </div>

        {/* Poster — large, fill available height */}
        <div className="relative flex-1 rounded-2xl overflow-hidden bg-film-card border border-film-border">
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-film-subtle min-h-[360px]">
              {item.media_type === 'tv' ? '📺' : '🎬'}
            </div>
          )}

          {/* TMDB rating badge */}
          {item.vote_average > 0 && (
            <div className="absolute top-3 left-3 bg-film-black/80 backdrop-blur-sm px-2.5 py-1 rounded-xl">
              <span className="text-film-accent font-mono font-bold text-sm">★ {formatRating(item.vote_average)}</span>
            </div>
          )}

          {/* Nav arrows overlay */}
          {index > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
          )}
          {index < items.length - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-film-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          )}

          {/* Loading overlay */}
          {loadingDetail && (
            <div className="absolute inset-0 bg-film-black/40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {items.length > 1 && items.length <= 20 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setImgErr(false); setCurrentDetail(null); }}
                className={cn(
                  'rounded-full transition-all',
                  i === index ? 'w-4 h-1.5 bg-film-accent' : 'w-1.5 h-1.5 bg-film-border'
                )}
              />
            ))}
          </div>
        )}

        {/* Actions bar */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {/* Già visto / Rimuovi */}
          <ActionButton
            label={isWatched ? 'Rimuovi' : 'Visto'}
            icon={isWatched
              ? <EyeOff size={18} />
              : <Eye size={18} />
            }
            active={isWatched}
            activeClass="text-green-400 border-green-500/40 bg-green-950/30"
            onClick={isWatched ? handleUnmarkWatched : handleMarkWatched}
          />

          {/* Watchlist */}
          <ActionButton
            label={isOnWatchlist ? 'Salvato' : 'Watchlist'}
            icon={isOnWatchlist
              ? <BookmarkCheck size={18} />
              : <Bookmark size={18} />
            }
            active={isOnWatchlist}
            activeClass="text-purple-300 border-purple-500/40 bg-purple-950/30"
            onClick={isOnWatchlist ? handleRemoveWatchlist : handleAddWatchlist}
          />

          {/* Rating */}
          <div className="flex flex-col items-center justify-center bg-film-card border border-film-border rounded-2xl py-2.5 px-2 gap-1">
            <StarRating
              value={personalRating ?? null}
              onChange={r => onUpdateRating(item.id, r)}
              size="sm"
              readonly={false}
            />
            <span className="text-film-subtle text-xs">
              {personalRating ? `${personalRating}/5` : 'Vota'}
            </span>
          </div>
        </div>

        {/* Swipe hint */}
        {items.length > 1 && (
          <p className="text-film-subtle text-xs text-center mt-3">
            ← {index + 1} di {items.length} →
          </p>
        )}
      </div>

      {showRatingModal && currentDetail && (
        <RatingModal
          movie={currentDetail}
          onConfirm={handleRatingConfirm}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </>
  );
}

function ActionButton({
  label, icon, active, activeClass, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border gap-1.5 transition-all active:scale-95',
        active
          ? activeClass
          : 'bg-film-card border-film-border text-film-muted hover:text-film-text'
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
