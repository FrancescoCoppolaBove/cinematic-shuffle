/**
 * RatingModal — fullscreen stile Letterboxd.
 * Usata sia per aggiungere che per modificare lo stato di un film.
 * Pre-popola watched/liked/rating con i valori attuali.
 * "Done" comunica tutto: { watched, rating, liked }
 */
import { useState } from 'react';
import { X, Eye, Heart, Bookmark, BookmarkCheck } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';
import { StarRating } from './StarRating';

export interface RatingResult {
  watched: boolean;
  rating: number | null;
  liked: boolean;
}

interface RatingModalProps {
  movie: TMDBMovieDetail;
  // Valori iniziali (pre-popola lo stato corrente del film)
  initialWatched?: boolean;
  initialRating?: number | null;
  initialLiked?: boolean;
  initialWatchlist?: boolean;
  showWatchlistBtn?: boolean;
  onConfirm: (result: RatingResult) => void;
  onToggleWatchlist?: () => void;
  onCancel: () => void;
}

export function RatingModal({
  movie,
  initialWatched = false,
  initialRating = null,
  initialLiked = false,
  initialWatchlist = false,
  showWatchlistBtn = true,
  onConfirm,
  onToggleWatchlist,
  onCancel,
}: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [liked, setLiked] = useState(initialLiked);
  const [watched, setWatched] = useState(initialWatched);
  const [watchlist, setWatchlist] = useState(initialWatchlist);

  const poster = getImageUrl(movie.poster_path, 'w342');
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const title = getTitle(movie);

  function handleWatchedToggle() {
    const next = !watched;
    setWatched(next);
    // Se rimuove "visto", azzera anche liked e rating
    if (!next) { setLiked(false); setRating(null); }
  }

  function handleLikedToggle() {
    const next = !liked;
    setLiked(next);
    // Liked implica watched
    if (next) setWatched(true);
  }

  function handleWatchlistToggle() {
    setWatchlist(prev => !prev);
    onToggleWatchlist?.();
  }

  function handleDone() {
    onConfirm({ watched, rating, liked });
  }

  return (
    <div className="fixed inset-0 z-[110]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Blurred backdrop */}
      <div className="absolute inset-0">
        {backdrop
          ? <img src={backdrop} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-film-deep" />
        }
        <div className="absolute inset-0 bg-film-black/75 backdrop-blur-xl" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-white font-semibold text-base">{title}</p>
            <p className="text-white/50 text-sm">{formatYear(getReleaseDate(movie))}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center active:opacity-60">
            <X size={20} className="text-white/70" />
          </button>
        </div>

        {/* Poster */}
        <div className="flex-1 flex items-center justify-center px-6 py-4 min-h-0">
          <div className="relative w-full max-w-[280px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            {poster
              ? <img src={poster} alt={title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-film-surface flex items-center justify-center text-5xl">🎬</div>
            }
          </div>
        </div>

        {/* Bottom panel */}
        <div className="bg-film-deep/90 backdrop-blur-sm rounded-t-3xl border-t border-white/10 px-5 pt-5 pb-3">
          {/* CTA row: Watched / Liked / Watchlist */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <CtaButton
              label={watched ? 'Watched' : 'Watch'}
              icon={<Eye size={26} strokeWidth={watched ? 2.5 : 1.5} />}
              active={watched}
              activeColor="text-green-400"
              onClick={handleWatchedToggle}
            />
            <CtaButton
              label="Liked"
              icon={<Heart size={26} fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 2 : 1.5} />}
              active={liked}
              activeColor="text-pink-400"
              onClick={handleLikedToggle}
            />
            {showWatchlistBtn ? (
              <CtaButton
                label={watchlist ? 'Saved' : 'Watchlist'}
                icon={watchlist
                  ? <BookmarkCheck size={26} strokeWidth={2} />
                  : <Bookmark size={26} strokeWidth={1.5} />
                }
                active={watchlist}
                activeColor="text-purple-400"
                onClick={handleWatchlistToggle}
              />
            ) : <div />}
          </div>

          {/* Stars — solo attive se watched */}
          <div className="mb-2 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {!watched ? 'Segna come visto per votare' : rating ? `${rating} / 5` : 'Rate'}
            </p>
            <div className={cn('flex justify-center', !watched && 'opacity-30 pointer-events-none')}>
              <StarRating value={rating} onChange={setRating} size="xl" />
            </div>
          </div>

          {/* Done */}
          <button
            onClick={handleDone}
            className="w-full py-4 mt-5 bg-white text-film-black font-bold text-base rounded-2xl active:scale-[0.98] transition-transform"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CtaButton({
  label, icon, active, activeColor, onClick,
}: {
  label: string; icon: React.ReactNode;
  active: boolean; activeColor: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 py-3 active:scale-95 transition-transform">
      <span className={cn('transition-colors', active ? activeColor : 'text-white/40')}>{icon}</span>
      <span className={cn('text-xs font-medium', active ? 'text-white' : 'text-white/40')}>{label}</span>
    </button>
  );
}
