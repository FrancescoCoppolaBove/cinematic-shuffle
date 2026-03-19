import { useState } from 'react';
import { Star, Clock, Calendar, Eye, EyeOff, ChevronDown, ChevronUp, Shuffle, Bookmark, BookmarkCheck, Tv } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';
import { StarRating } from './StarRating';

interface MovieCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  personalRating?: number | null;
  onMarkWatched: (rating: number | null) => void;
  onUnmarkWatched: () => void;
  onUpdateRating?: (rating: number | null) => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onShuffle: () => void;
  loading?: boolean;
}

export function MovieCard({
  movie, isWatched, isOnWatchlist, personalRating,
  onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onShuffle, loading,
}: MovieCardProps) {
  const [showFullCast, setShowFullCast] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const title = getTitle(movie);
  const releaseDate = getReleaseDate(movie);
  const poster = !posterError ? getImageUrl(movie.poster_path, 'w500') : null;
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const isTV = movie.media_type === 'tv';
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const creator = isTV ? movie.credits?.crew?.find(c => c.job === 'Executive Producer' || c.department === 'Creator') : null;
  const cast = movie.credits?.cast?.slice(0, showFullCast ? 20 : 8) || [];
  const rating = movie.vote_average;
  const ratingColor = rating >= 7.5 ? 'text-green-400' : rating >= 6 ? 'text-film-accent' : 'text-film-muted';

  const runtime = isTV
    ? (movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]}min/ep` : null)
    : movie.runtime;

  return (
    <>
      <div className="animate-scale-in">
        {backdrop && (
          <div className="relative h-48 rounded-t-2xl overflow-hidden -mb-6">
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-film-black/20 via-film-black/60 to-film-deep" />
            {/* Media type badge */}
            <div className="absolute top-3 left-3">
              <span className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm border',
                isTV ? 'bg-purple-900/70 border-purple-500/40 text-purple-200' : 'bg-film-black/70 border-film-border text-film-muted'
              )}>
                {isTV ? <Tv size={10} /> : null}
                {isTV ? 'Serie TV' : 'Film'}
              </span>
            </div>
          </div>
        )}

        <div className={cn('bg-film-deep border border-film-border rounded-2xl overflow-hidden', backdrop ? 'rounded-t-none border-t-0' : '')}>
          <div className="p-6 md:p-8">
            <div className="flex gap-6">
              {/* Poster */}
              <div className="shrink-0">
                <div className="w-32 md:w-44 aspect-[2/3] rounded-xl overflow-hidden bg-film-card border border-film-border shadow-2xl">
                  {poster ? (
                    <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setPosterError(true)} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-film-subtle">
                      <span className="text-3xl">{isTV ? '📺' : '🎬'}</span>
                      <span className="text-xs text-center px-2">Poster non disponibile</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Badge se no backdrop */}
                {!backdrop && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border',
                    isTV ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' : 'bg-film-card border-film-border text-film-muted'
                  )}>
                    {isTV ? <Tv size={10} /> : null}{isTV ? 'Serie TV' : 'Film'}
                  </span>
                )}

                <div>
                  <h1 className="font-display text-2xl md:text-4xl text-film-text leading-none tracking-wide">{title}</h1>
                  {movie.tagline && <p className="text-film-accent text-sm mt-1 italic">"{movie.tagline}"</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Star size={14} className={ratingColor} fill="currentColor" />
                    <span className={cn('font-mono font-bold text-lg leading-none', ratingColor)}>{formatRating(rating)}</span>
                    <span className="text-film-subtle text-xs">/10</span>
                  </div>
                  <div className="w-px h-4 bg-film-border" />
                  <div className="flex items-center gap-1.5 text-film-muted">
                    <Calendar size={13} /><span className="text-sm">{formatYear(releaseDate)}</span>
                  </div>
                  {runtime && (
                    <>
                      <div className="w-px h-4 bg-film-border" />
                      <div className="flex items-center gap-1.5 text-film-muted">
                        <Clock size={13} />
                        <span className="text-sm">{typeof runtime === 'number' ? formatRuntime(runtime) : runtime}</span>
                      </div>
                    </>
                  )}
                  {isTV && movie.number_of_seasons && (
                    <>
                      <div className="w-px h-4 bg-film-border" />
                      <span className="text-film-muted text-sm">{movie.number_of_seasons} stagion{movie.number_of_seasons === 1 ? 'e' : 'i'}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {movie.genres?.map(g => (
                    <span key={g.id} className="px-2.5 py-0.5 rounded-lg bg-film-card border border-film-border text-film-muted text-xs">{g.name}</span>
                  ))}
                </div>

                {director && (
                  <div className="flex items-center gap-2">
                    <span className="text-film-subtle text-xs uppercase tracking-wider">Regia</span>
                    <span className="text-film-text text-sm font-medium">{director.name}</span>
                  </div>
                )}
                {creator && (
                  <div className="flex items-center gap-2">
                    <span className="text-film-subtle text-xs uppercase tracking-wider">Creatore</span>
                    <span className="text-film-text text-sm font-medium">{creator.name}</span>
                  </div>
                )}

                {isWatched && (
                  <div className="space-y-1">
                    <span className="text-film-subtle text-xs uppercase tracking-wider">Il tuo voto</span>
                    <StarRating value={personalRating ?? null} onChange={r => onUpdateRating?.(r)} size="sm" />
                  </div>
                )}

                {/* CTAs */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={onShuffle} disabled={loading}
                    className="flex items-center gap-2 bg-film-accent hover:bg-film-accent-dim text-film-black font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                    <Shuffle size={15} className={loading ? 'animate-spin-slow' : ''} />
                    {loading ? 'Cercando...' : 'Altro'}
                  </button>

                  {!isWatched && (
                    <button onClick={() => setShowRatingModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-film-border bg-film-card text-film-muted hover:text-film-text hover:border-film-accent transition-all hover:scale-105 active:scale-95">
                      <Eye size={15} />Già visto
                    </button>
                  )}
                  {isWatched && (
                    <button onClick={onUnmarkWatched}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-film-red bg-film-card text-film-red hover:bg-film-red/10 transition-all hover:scale-105 active:scale-95">
                      <EyeOff size={15} />Rimuovi
                    </button>
                  )}

                  {!isOnWatchlist && !isWatched && (
                    <button onClick={onAddToWatchlist}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-film-border bg-film-card text-film-muted hover:text-purple-300 hover:border-purple-500/50 transition-all hover:scale-105 active:scale-95">
                      <Bookmark size={15} />Watchlist
                    </button>
                  )}
                  {isOnWatchlist && !isWatched && (
                    <button onClick={onRemoveFromWatchlist}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-purple-500/50 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40 transition-all hover:scale-105 active:scale-95">
                      <BookmarkCheck size={15} />In watchlist
                    </button>
                  )}
                </div>
              </div>
            </div>

            {movie.overview && (
              <div className="mt-6 space-y-2">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Trama</h3>
                <p className="text-film-text/80 text-sm leading-relaxed">{movie.overview}</p>
              </div>
            )}

            {cast.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Cast</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {cast.map(actor => <CastMember key={actor.id} actor={actor} />)}
                </div>
                {(movie.credits?.cast?.length || 0) > 8 && (
                  <button onClick={() => setShowFullCast(!showFullCast)}
                    className="flex items-center gap-1.5 text-film-muted hover:text-film-accent text-xs transition-colors mt-2">
                    {showFullCast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showFullCast ? 'Mostra meno' : `Mostra tutti (${movie.credits?.cast?.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRatingModal && (
        <RatingModal movie={movie} onConfirm={r => { setShowRatingModal(false); onMarkWatched(r); }} onCancel={() => setShowRatingModal(false)} />
      )}
    </>
  );
}

function CastMember({ actor }: { actor: { id: number; name: string; character: string; profile_path: string | null } }) {
  const [err, setErr] = useState(false);
  const photo = !err ? getImageUrl(actor.profile_path, 'w92') : null;
  return (
    <div className="flex items-center gap-2.5 bg-film-card rounded-xl p-2.5 border border-film-border">
      <div className="w-9 h-9 rounded-full overflow-hidden bg-film-surface border border-film-border shrink-0">
        {photo ? <img src={photo} alt={actor.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-film-subtle text-sm font-display">{actor.name.charAt(0)}</div>}
      </div>
      <div className="min-w-0">
        <p className="text-film-text text-xs font-medium truncate">{actor.name}</p>
        <p className="text-film-subtle text-xs truncate italic">{actor.character}</p>
      </div>
    </div>
  );
}
