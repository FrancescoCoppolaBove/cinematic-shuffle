/**
 * RatingModal — fullscreen stile Letterboxd.
 * Backdrop sfocato, poster grande, CTA Watched/Liked/Watchlist in alto,
 * stelle XXL con swipe orizzontale al centro, Done in basso.
 */
import { useState } from 'react';
import { X, Eye, Heart, Bookmark } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';
import { StarRating } from './StarRating';

interface RatingModalProps {
  movie: TMDBMovieDetail;
  initialWatched?: boolean;
  initialLiked?: boolean;
  initialWatchlist?: boolean;
  onConfirm: (rating: number | null, liked: boolean) => void;
  onCancel: () => void;
}

export function RatingModal({
  movie,
  initialWatched = true,
  initialLiked = false,
  initialWatchlist = false,
  onConfirm,
  onCancel,
}: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [liked, setLiked] = useState(initialLiked);
  const [watched, setWatched] = useState(initialWatched);

  const poster = getImageUrl(movie.poster_path, 'w342');
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const title = getTitle(movie);

  return (
    <div className="fixed inset-0 z-[90]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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

        {/* Poster — takes remaining space */}
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
              onClick={() => setWatched(!watched)}
            />
            <CtaButton
              label="Liked"
              icon={<Heart size={26} fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 2 : 1.5} />}
              active={liked}
              activeColor="text-pink-400"
              onClick={() => { const newLiked = !liked; setLiked(newLiked); if (newLiked) setWatched(true); }}
            />
            <CtaButton
              label="Watchlist"
              icon={<Bookmark size={26} strokeWidth={1.5} />}
              active={initialWatchlist}
              activeColor="text-purple-400"
              onClick={() => {/* handled externally */}}
            />
          </div>

          {/* Stars — XXL, swipe to rate */}
          <div className="mb-2 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {rating ? `${rating} / 5` : 'Rate'}
            </p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={setRating} size="xl" />
            </div>
          </div>

          {/* Done */}
          <button
            onClick={() => onConfirm(rating, liked)}
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
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 active:scale-95 transition-transform"
    >
      <span className={cn('transition-colors', active ? activeColor : 'text-white/40')}>
        {icon}
      </span>
      <span className={cn('text-xs font-medium', active ? 'text-white' : 'text-white/40')}>
        {label}
      </span>
    </button>
  );
}
