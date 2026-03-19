import { useState } from 'react';
import { Star, Clock, Calendar, Eye, EyeOff, ChevronDown, ChevronUp, Shuffle } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl } from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';
import { StarRating } from './StarRating';

interface MovieCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  personalRating?: number | null;
  onMarkWatched: (rating: number | null) => void;
  onUnmarkWatched: () => void;
  onUpdateRating?: (rating: number | null) => void;
  onShuffle: () => void;
  loading?: boolean;
}

export function MovieCard({
  movie, isWatched, personalRating, onMarkWatched, onUnmarkWatched, onUpdateRating, onShuffle, loading
}: MovieCardProps) {
  const [showFullCast, setShowFullCast] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const poster = !posterError ? getImageUrl(movie.poster_path, 'w500') : null;
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const director = movie.credits?.crew?.find(c => c.job === 'Director');
  const cast = movie.credits?.cast?.slice(0, showFullCast ? 20 : 8) || [];
  const rating = movie.vote_average;
  const ratingColor = rating >= 7.5 ? 'text-green-400' : rating >= 6 ? 'text-film-accent' : 'text-film-muted';

  function handleMarkWatched() {
    setShowRatingModal(true);
  }

  function handleRatingConfirm(rating: number | null) {
    setShowRatingModal(false);
    onMarkWatched(rating);
  }

  return (
    <>
      <div className="animate-scale-in">
        {/* Backdrop */}
        {backdrop && (
          <div className="relative h-48 rounded-t-2xl overflow-hidden -mb-6">
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-film-black/20 via-film-black/60 to-film-deep" />
          </div>
        )}

        <div className={cn(
          'bg-film-deep border border-film-border rounded-2xl overflow-hidden',
          backdrop ? 'rounded-t-none border-t-0' : ''
        )}>
          <div className="p-6 md:p-8">
            <div className="flex gap-6">
              {/* Poster */}
              <div className="shrink-0">
                <div className="w-32 md:w-44 aspect-[2/3] rounded-xl overflow-hidden bg-film-card border border-film-border shadow-2xl">
                  {poster ? (
                    <img
                      src={poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      onError={() => setPosterError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-film-subtle">
                      <span className="text-3xl">🎬</span>
                      <span className="text-xs text-center px-2">Poster non disponibile</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info principale */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h1 className="font-display text-2xl md:text-4xl text-film-text leading-none tracking-wide">
                    {movie.title}
                  </h1>
                  {movie.original_title !== movie.title && (
                    <p className="text-film-muted text-sm mt-1 italic">{movie.original_title}</p>
                  )}
                  {movie.tagline && (
                    <p className="text-film-accent text-sm mt-1 italic">"{movie.tagline}"</p>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Star size={14} className={ratingColor} fill="currentColor" />
                    <span className={cn('font-mono font-bold text-lg leading-none', ratingColor)}>
                      {formatRating(rating)}
                    </span>
                    <span className="text-film-subtle text-xs">/10</span>
                  </div>
                  <div className="w-px h-4 bg-film-border" />
                  <div className="flex items-center gap-1.5 text-film-muted">
                    <Calendar size={13} />
                    <span className="text-sm">{formatYear(movie.release_date)}</span>
                  </div>
                  <div className="w-px h-4 bg-film-border" />
                  <div className="flex items-center gap-1.5 text-film-muted">
                    <Clock size={13} />
                    <span className="text-sm">{formatRuntime(movie.runtime)}</span>
                  </div>
                </div>

                {/* Generi */}
                <div className="flex flex-wrap gap-2">
                  {movie.genres?.map(g => (
                    <span key={g.id} className="px-2.5 py-0.5 rounded-lg bg-film-card border border-film-border text-film-muted text-xs">
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Regista */}
                {director && (
                  <div className="flex items-center gap-2">
                    <span className="text-film-subtle text-xs uppercase tracking-wider">Regia</span>
                    <span className="text-film-text text-sm font-medium">{director.name}</span>
                  </div>
                )}

                {/* Rating personale (se visto) */}
                {isWatched && (
                  <div className="space-y-1">
                    <span className="text-film-subtle text-xs uppercase tracking-wider">Il tuo voto</span>
                    <StarRating
                      value={personalRating ?? null}
                      onChange={rating => onUpdateRating?.(rating)}
                      size="sm"
                    />
                  </div>
                )}

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={onShuffle}
                    disabled={loading}
                    className="flex items-center gap-2 bg-film-accent hover:bg-film-accent-dim text-film-black font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shuffle size={15} className={loading ? 'animate-spin-slow' : ''} />
                    {loading ? 'Cercando...' : 'Altro film'}
                  </button>

                  <button
                    onClick={isWatched ? onUnmarkWatched : handleMarkWatched}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-105 active:scale-95',
                      isWatched
                        ? 'bg-film-card border-film-red text-film-red hover:bg-film-red/10'
                        : 'bg-film-card border-film-border text-film-muted hover:text-film-text hover:border-film-accent'
                    )}
                  >
                    {isWatched ? <EyeOff size={15} /> : <Eye size={15} />}
                    {isWatched ? 'Rimuovi dai visti' : 'Segna come visto'}
                  </button>
                </div>
              </div>
            </div>

            {/* Trama */}
            {movie.overview && (
              <div className="mt-6 space-y-2">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Trama</h3>
                <p className="text-film-text/80 text-sm leading-relaxed">{movie.overview}</p>
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Cast</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {cast.map(actor => (
                    <CastMember key={actor.id} actor={actor} />
                  ))}
                </div>
                {(movie.credits?.cast?.length || 0) > 8 && (
                  <button
                    onClick={() => setShowFullCast(!showFullCast)}
                    className="flex items-center gap-1.5 text-film-muted hover:text-film-accent text-xs transition-colors mt-2"
                  >
                    {showFullCast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showFullCast ? 'Mostra meno' : `Mostra tutti (${movie.credits?.cast?.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating modal */}
      {showRatingModal && (
        <RatingModal
          movie={movie}
          onConfirm={handleRatingConfirm}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </>
  );
}

function CastMember({ actor }: { actor: { id: number; name: string; character: string; profile_path: string | null } }) {
  const [imgError, setImgError] = useState(false);
  const photo = !imgError ? getImageUrl(actor.profile_path, 'w92') : null;

  return (
    <div className="flex items-center gap-2.5 bg-film-card rounded-xl p-2.5 border border-film-border">
      <div className="w-9 h-9 rounded-full overflow-hidden bg-film-surface border border-film-border shrink-0">
        {photo ? (
          <img src={photo} alt={actor.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-film-subtle text-sm font-display">
            {actor.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-film-text text-xs font-medium truncate">{actor.name}</p>
        <p className="text-film-subtle text-xs truncate italic">{actor.character}</p>
      </div>
    </div>
  );
}
