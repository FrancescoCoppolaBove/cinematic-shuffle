import { useState, useEffect } from 'react';
import {
  Star, Clock, Calendar, Eye, EyeOff, ChevronDown, ChevronUp,
  Shuffle, Bookmark, BookmarkCheck, Tv, Play, MapPin, Film,
} from 'lucide-react';
import type { TMDBMovieDetail, TMDBMovieBasic } from '../types';
import {
  getImageUrl, getProviderLogoUrl, getTitle, getReleaseDate,
  getBestTrailer, getWatchProviders, getCollection,
} from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';
import { StarRating } from './StarRating';

interface MovieCardProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  personalRating?: number | null;
  showShuffleBtn?: boolean;          // punto 3 — mostra solo in Shuffle
  onMarkWatched: (rating: number | null) => void;
  onUnmarkWatched: () => void;
  onUpdateRating?: (rating: number | null) => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onShuffle?: () => void;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;  // per navigare a similar/related
  loading?: boolean;
}

export function MovieCard({
  movie, isWatched, isOnWatchlist, personalRating,
  showShuffleBtn = false,
  onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onShuffle, onOpenMovie, loading,
}: MovieCardProps) {
  const [showFullCast, setShowFullCast] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [collectionParts, setCollectionParts] = useState<TMDBMovieBasic[] | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [loadingCollection, setLoadingCollection] = useState(false);

  const title = getTitle(movie);
  const releaseDate = getReleaseDate(movie);
  const poster = !posterError ? getImageUrl(movie.poster_path, 'w500') : null;
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const isTV = movie.media_type === 'tv';
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const creator = isTV ? movie.credits?.crew?.find(c =>
    c.job === 'Creator' || c.job === 'Executive Producer') : null;
  const cast = movie.credits?.cast?.slice(0, showFullCast ? 20 : 6) || [];
  const rating = movie.vote_average;
  const ratingColor = rating >= 7.5 ? 'text-green-400' : rating >= 6 ? 'text-film-accent' : 'text-film-muted';

  const trailerUrl = getBestTrailer(movie);
  const providers = getWatchProviders(movie);
  const allProviders = [
    ...(providers?.flatrate ?? []),
    ...(providers?.free ?? []),
    ...(providers?.ads ?? []),
    ...(providers?.rent ?? []),
    ...(providers?.buy ?? []),
  ].filter((p, i, arr) => arr.findIndex(x => x.provider_id === p.provider_id) === i)
   .slice(0, 8);

  const similar = (movie.recommendations?.results?.length
    ? movie.recommendations.results
    : movie.similar?.results ?? []
  ).slice(0, 12);

  const runtime = isTV
    ? (movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]}min/ep` : null)
    : movie.runtime;

  // Load collection if belongs_to_collection
  useEffect(() => {
    if (movie.belongs_to_collection?.id && !isTV) {
      setLoadingCollection(true);
      getCollection(movie.belongs_to_collection.id)
        .then(({ name, parts }) => {
          setCollectionName(name);
          setCollectionParts(parts.sort((a, b) =>
            (a.release_date ?? '').localeCompare(b.release_date ?? '')));
        })
        .catch(() => {})
        .finally(() => setLoadingCollection(false));
    }
  }, [movie.id, movie.belongs_to_collection?.id, isTV]);

  return (
    <>
      <div className="animate-scale-in">
        {/* Backdrop — full width hero */}
        {backdrop && (
          <div className="relative w-full aspect-[16/9] rounded-t-2xl overflow-hidden -mb-6">
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-film-black/40 to-film-deep" />
            {/* Media badge */}
            <div className="absolute top-3 left-3">
              <span className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm border',
                isTV
                  ? 'bg-purple-900/80 border-purple-500/50 text-purple-200'
                  : 'bg-film-black/70 border-film-border/50 text-film-muted'
              )}>
                {isTV ? <Tv size={10} /> : <Film size={10} />}
                {isTV ? 'Serie TV' : 'Film'}
              </span>
            </div>
            {/* Trailer button overlay on backdrop */}
            {trailerUrl && (
              <a
                href={trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-full bg-film-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-film-accent/80 group-hover:scale-110 transition-all">
                  <Play size={22} className="text-white ml-1" fill="white" />
                </div>
              </a>
            )}
          </div>
        )}

        <div className={cn(
          'bg-film-deep border border-film-border rounded-2xl overflow-hidden',
          backdrop ? 'rounded-t-none border-t-0' : ''
        )}>
          <div className="p-4">
            {/* Top section: poster + info */}
            <div className="flex gap-4">
              {/* Poster — mobile friendly size */}
              <div className="shrink-0">
                <div className="w-24 aspect-[2/3] rounded-xl overflow-hidden bg-film-card border border-film-border shadow-xl">
                  {poster ? (
                    <img src={poster} alt={title} className="w-full h-full object-cover"
                      onError={() => setPosterError(true)} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-film-subtle">
                      <span className="text-2xl">{isTV ? '📺' : '🎬'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info column */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* No backdrop: show badge inline */}
                {!backdrop && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border',
                    isTV
                      ? 'bg-purple-900/30 border-purple-500/30 text-purple-300'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}>
                    {isTV ? <Tv size={9} /> : <Film size={9} />}
                    {isTV ? 'Serie TV' : 'Film'}
                  </span>
                )}

                {/* Title */}
                <h1 className="font-display text-xl leading-tight tracking-wide text-film-text">
                  {title}
                </h1>
                {movie.tagline && (
                  <p className="text-film-accent text-xs italic leading-snug">"{movie.tagline}"</p>
                )}

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star size={12} className={ratingColor} fill="currentColor" />
                    <span className={cn('font-mono font-bold text-sm leading-none', ratingColor)}>
                      {formatRating(rating)}
                    </span>
                    <span className="text-film-subtle text-xs">/10</span>
                  </div>
                  <span className="text-film-border">·</span>
                  <div className="flex items-center gap-1 text-film-muted">
                    <Calendar size={11} />
                    <span className="text-xs">{formatYear(releaseDate)}</span>
                  </div>
                  {runtime && (
                    <>
                      <span className="text-film-border">·</span>
                      <div className="flex items-center gap-1 text-film-muted">
                        <Clock size={11} />
                        <span className="text-xs">
                          {typeof runtime === 'number' ? formatRuntime(runtime) : runtime}
                        </span>
                      </div>
                    </>
                  )}
                  {isTV && movie.number_of_seasons && (
                    <>
                      <span className="text-film-border">·</span>
                      <span className="text-film-muted text-xs">
                        {movie.number_of_seasons} stag.
                      </span>
                    </>
                  )}
                </div>

                {/* Genres */}
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres?.slice(0, 3).map(g => (
                    <span key={g.id}
                      className="px-2 py-0.5 rounded-md bg-film-card border border-film-border text-film-muted text-xs">
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Director / Creator */}
                {director && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-film-subtle text-xs">Regia</span>
                    <span className="text-film-text text-xs font-medium">{director.name}</span>
                  </div>
                )}
                {creator && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-film-subtle text-xs">Creato da</span>
                    <span className="text-film-text text-xs font-medium">{creator.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Personal rating if watched */}
            {isWatched && (
              <div className="mt-3 flex items-center gap-3 px-3 py-2.5 bg-film-card rounded-xl border border-film-border">
                <span className="text-film-subtle text-xs uppercase tracking-wider shrink-0">Il tuo voto</span>
                <StarRating value={personalRating ?? null} onChange={r => onUpdateRating?.(r)} size="sm" />
              </div>
            )}

            {/* ── CTAs ── */}
            <div className="mt-3 flex gap-2 flex-wrap">
              {/* Shuffle — solo quando showShuffleBtn */}
              {showShuffleBtn && onShuffle && (
                <button onClick={onShuffle} disabled={loading}
                  className="flex items-center gap-2 bg-film-accent hover:bg-film-accent-dim text-film-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50">
                  <Shuffle size={15} className={loading ? 'animate-spin-slow' : ''} />
                  {loading ? 'Cercando...' : 'Altro'}
                </button>
              )}

              {/* Trailer */}
              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-800/50 bg-red-950/30 text-red-400 hover:bg-red-950/60 transition-all active:scale-95">
                  <Play size={14} fill="currentColor" />Trailer
                </a>
              )}

              {/* Già visto / Rimuovi */}
              {!isWatched ? (
                <button onClick={() => setShowRatingModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-film-border bg-film-card text-film-muted hover:text-film-text hover:border-film-accent transition-all active:scale-95">
                  <Eye size={14} />Già visto
                </button>
              ) : (
                <button onClick={onUnmarkWatched}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-film-red/50 bg-film-red/10 text-film-red transition-all active:scale-95">
                  <EyeOff size={14} />Rimuovi
                </button>
              )}

              {/* Watchlist */}
              {!isOnWatchlist && !isWatched && (
                <button onClick={onAddToWatchlist}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-film-border bg-film-card text-film-muted hover:text-purple-300 hover:border-purple-500/50 transition-all active:scale-95">
                  <Bookmark size={14} />Watchlist
                </button>
              )}
              {isOnWatchlist && !isWatched && (
                <button onClick={onRemoveFromWatchlist}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-purple-500/40 bg-purple-900/20 text-purple-300 transition-all active:scale-95">
                  <BookmarkCheck size={14} />In watchlist
                </button>
              )}
            </div>

            {/* ── Trama ── */}
            {movie.overview && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium mb-2">Trama</h3>
                <p className="text-film-text/80 text-sm leading-relaxed">{movie.overview}</p>
              </div>
            )}

            {/* ── Dove guardarlo ── */}
            {allProviders.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={13} className="text-film-accent" />
                  <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Dove guardarlo</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allProviders.map(p => (
                    <div key={p.provider_id}
                      className="flex items-center gap-2 bg-film-card border border-film-border rounded-xl px-2.5 py-1.5">
                      <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">
                        <img
                          src={getProviderLogoUrl(p.logo_path)}
                          alt={p.provider_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-film-text text-xs font-medium">{p.provider_name}</span>
                    </div>
                  ))}
                </div>
                {providers?.link && (
                  <a href={providers.link} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 text-film-accent text-xs hover:underline">
                    Vedi tutte le opzioni →
                  </a>
                )}
              </div>
            )}

            {/* ── Cast ── */}
            {cast.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium mb-3">Cast</h3>
                {/* Horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                  {cast.map(actor => <CastMember key={actor.id} actor={actor} />)}
                  {!showFullCast && (movie.credits?.cast?.length ?? 0) > 6 && (
                    <button
                      onClick={() => setShowFullCast(true)}
                      className="shrink-0 flex flex-col items-center justify-center w-16 h-[88px] rounded-xl bg-film-card border border-film-border text-film-muted hover:text-film-text transition-colors"
                    >
                      <ChevronDown size={16} />
                      <span className="text-xs mt-1">+{(movie.credits?.cast?.length ?? 0) - 6}</span>
                    </button>
                  )}
                </div>
                {showFullCast && (
                  <button onClick={() => setShowFullCast(false)}
                    className="flex items-center gap-1 text-film-muted text-xs mt-2 hover:text-film-accent transition-colors">
                    <ChevronUp size={13} />Mostra meno
                  </button>
                )}
              </div>
            )}

            {/* ── Franchise / Saga (collection) ── */}
            {(collectionParts || loadingCollection) && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium mb-3">
                  {collectionName || 'Saga'}
                </h3>
                {loadingCollection ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="shrink-0 w-20 aspect-[2/3] rounded-xl bg-film-card animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                    {collectionParts?.map(part => (
                      <RelatedPosterCard
                        key={part.id}
                        item={part}
                        isCurrent={part.id === movie.id}
                        mediaType="movie"
                        onClick={() => onOpenMovie?.(part.id, 'movie')}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Film simili ── */}
            {similar.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium mb-3">
                  {isTV ? 'Serie simili' : 'Film simili'}
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                  {similar.map(item => (
                    <RelatedPosterCard
                      key={item.id}
                      item={item}
                      isCurrent={false}
                      mediaType={movie.media_type}
                      onClick={() => onOpenMovie?.(item.id, movie.media_type)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showRatingModal && (
        <RatingModal
          movie={movie}
          onConfirm={r => { setShowRatingModal(false); onMarkWatched(r); }}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </>
  );
}

// ── Cast member — horizontal scroll card ──────────────────────────
function CastMember({ actor }: {
  actor: { id: number; name: string; character: string; profile_path: string | null }
}) {
  const [err, setErr] = useState(false);
  const photo = !err ? getImageUrl(actor.profile_path, 'w185') : null;
  return (
    <div className="shrink-0 w-16 text-center">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-film-surface border border-film-border mx-auto">
        {photo
          ? <img src={photo} alt={actor.name} className="w-full h-full object-cover"
              onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-film-subtle text-xl font-display">
              {actor.name.charAt(0)}
            </div>
        }
      </div>
      <p className="text-film-text text-xs font-medium mt-1 truncate leading-tight">{actor.name}</p>
      <p className="text-film-subtle text-xs truncate leading-tight italic">{actor.character}</p>
    </div>
  );
}

// ── Related / Similar poster card ─────────────────────────────────
function RelatedPosterCard({ item, isCurrent, mediaType, onClick }: {
  item: TMDBMovieBasic;
  isCurrent: boolean;
  mediaType: 'movie' | 'tv';
  onClick?: () => void;
}) {
  const [err, setErr] = useState(false);
  const poster = !err ? getImageUrl(item.poster_path, 'w185') : null;
  const t = getTitle(item);
  return (
    <button
      onClick={onClick}
      disabled={isCurrent || !onClick}
      className={cn(
        'shrink-0 w-20 text-left transition-all active:scale-95',
        isCurrent ? 'opacity-50 cursor-default' : 'hover:opacity-90',
        !onClick && 'cursor-default'
      )}
    >
      <div className={cn(
        'w-20 aspect-[2/3] rounded-xl overflow-hidden bg-film-card border',
        isCurrent ? 'border-film-accent' : 'border-film-border'
      )}>
        {poster
          ? <img src={poster} alt={t} className="w-full h-full object-cover"
              onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-lg">
              {mediaType === 'tv' ? '📺' : '🎬'}
            </div>
        }
      </div>
      <p className="text-film-text text-xs mt-1 line-clamp-2 leading-tight">{t}</p>
      {item.vote_average > 0 && (
        <p className="text-film-accent text-xs">★ {item.vote_average.toFixed(1)}</p>
      )}
    </button>
  );
}
