import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Star, Clock, Play,
  Eye, EyeOff, Bookmark, BookmarkCheck,
  Tv, Film, MapPin, ChevronDown, ChevronUp, Shuffle,
} from 'lucide-react';
import type { TMDBMovieDetail, TMDBMovieBasic } from '../types';
import {
  getImageUrl, getProviderLogoUrl, getTitle, getReleaseDate,
  getBestTrailer, getWatchProviders, getCollection,
} from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';
import { StarRating } from './StarRating';

interface MovieDetailScreenProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  personalRating?: number | null;
  showShuffleBtn?: boolean;
  backLabel?: string;
  onBack: () => void;
  onMarkWatched: (rating: number | null) => void;
  onUnmarkWatched: () => void;
  onUpdateRating?: (rating: number | null) => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onShuffle?: () => void;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;
  loading?: boolean;
}

export function MovieDetailScreen({
  movie, isWatched, isOnWatchlist, personalRating,
  showShuffleBtn = false, backLabel = 'Indietro',
  onBack, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onShuffle, onOpenMovie, loading,
}: MovieDetailScreenProps) {
  const [showFullCast, setShowFullCast] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [collectionParts, setCollectionParts] = useState<TMDBMovieBasic[] | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [loadingCollection, setLoadingCollection] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const title = getTitle(movie);
  const releaseDate = getReleaseDate(movie);
  const poster = !posterError ? getImageUrl(movie.poster_path, 'w500') : null;
  const backdrop = getImageUrl(movie.backdrop_path, 'original');
  const isTV = movie.media_type === 'tv';
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const creator = isTV ? movie.credits?.crew?.find(c =>
    c.job === 'Creator' || c.job === 'Executive Producer') : null;
  const cast = movie.credits?.cast?.slice(0, showFullCast ? 30 : 8) || [];
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

  useEffect(() => {
    // Reset scroll on movie change
    scrollRef.current?.scrollTo(0, 0);
    setShowFullCast(false);
    setPosterError(false);
    setCollectionParts(null);

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
    <div
      className="fixed inset-0 z-[80] bg-film-black overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      ref={scrollRef}
    >
      {/* ── Hero backdrop (a tutto schermo) ── */}
      <div className="relative w-full" style={{ height: '65vw', minHeight: 220, maxHeight: 420 }}>
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-film-surface" />
        )}
        {/* Gradient fade verso il basso */}
        <div className="absolute inset-0 bg-gradient-to-b from-film-black/30 via-transparent to-film-black" />

        {/* Back button — sovrapposto in alto a sinistra, stile Letterboxd */}
        <button
          onClick={onBack}
          className="absolute z-10 flex items-center gap-1.5 active:opacity-70 transition-opacity"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)', left: 16 }}
        >
          <div className="w-9 h-9 rounded-full bg-film-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
            <ChevronLeft size={20} className="text-white" />
          </div>
          <span className="text-white text-sm font-medium drop-shadow-lg">{backLabel}</span>
        </button>

        {/* Trailer play button sovrapposto al centro */}
        {trailerUrl && (
          <a
            href={trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
              <Play size={26} className="text-white ml-1" fill="white" />
            </div>
          </a>
        )}

        {/* Media type badge */}
        <div className="absolute bottom-4 left-4">
          <span className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-medium backdrop-blur-sm border',
            isTV
              ? 'bg-purple-900/80 border-purple-500/50 text-purple-200'
              : 'bg-film-black/70 border-white/10 text-white/70'
          )}>
            {isTV ? <Tv size={11} /> : <Film size={11} />}
            {isTV ? 'Serie TV' : 'Film'}
          </span>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="px-4 -mt-2">

        {/* Poster + titolo hero — stile Letterboxd */}
        <div className="flex gap-4 items-end mb-5">
          {/* Poster piccolo in basso a sinistra */}
          <div className="shrink-0 -mt-16 relative z-10">
            <div className="w-28 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-film-black shadow-2xl bg-film-card">
              {poster ? (
                <img
                  src={poster}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={() => setPosterError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {isTV ? '📺' : '🎬'}
                </div>
              )}
            </div>
          </div>

          {/* Titolo e info base */}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="font-display text-2xl leading-tight tracking-wide text-film-text break-words">
              {title}
            </h1>
            {movie.tagline && (
              <p className="text-film-accent text-xs italic mt-1 leading-snug">
                "{movie.tagline}"
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <Star size={12} className={ratingColor} fill="currentColor" />
                <span className={cn('font-mono font-bold text-sm', ratingColor)}>
                  {formatRating(rating)}
                </span>
                <span className="text-film-subtle text-xs">/10</span>
              </div>
              <span className="text-film-border text-xs">·</span>
              <span className="text-film-muted text-xs">{formatYear(releaseDate)}</span>
              {runtime && (
                <>
                  <span className="text-film-border text-xs">·</span>
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
                  <span className="text-film-border text-xs">·</span>
                  <span className="text-film-muted text-xs">
                    {movie.number_of_seasons} stagioni
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Generi */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {movie.genres?.map(g => (
            <span key={g.id}
              className="px-2.5 py-1 rounded-xl bg-film-surface border border-film-border text-film-muted text-xs">
              {g.name}
            </span>
          ))}
        </div>

        {/* Regia / Creatore */}
        {director && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-film-subtle text-xs uppercase tracking-wider">Regia</span>
            <span className="text-film-text text-sm font-medium">{director.name}</span>
          </div>
        )}
        {creator && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-film-subtle text-xs uppercase tracking-wider">Creato da</span>
            <span className="text-film-text text-sm font-medium">{creator.name}</span>
          </div>
        )}

        {/* Personal rating if watched */}
        {isWatched && (
          <div className="flex items-center gap-3 px-4 py-3 bg-film-surface rounded-2xl border border-film-border mb-4">
            <span className="text-film-subtle text-xs uppercase tracking-wider shrink-0">Il tuo voto</span>
            <StarRating value={personalRating ?? null} onChange={r => onUpdateRating?.(r)} size="sm" />
          </div>
        )}

        {/* ── CTA row ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {showShuffleBtn && onShuffle && (
            <button onClick={onShuffle} disabled={loading}
              className="flex items-center gap-2 bg-film-accent text-film-black font-semibold px-4 py-2.5 rounded-2xl text-sm transition-all active:scale-95 disabled:opacity-50">
              <Shuffle size={15} className={loading ? 'animate-spin-slow' : ''} />
              {loading ? 'Cercando...' : 'Altro'}
            </button>
          )}

          {trailerUrl && (
            <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-red-800/50 bg-red-950/30 text-red-400 active:scale-95 transition-all">
              <Play size={14} fill="currentColor" />Trailer
            </a>
          )}

          {!isWatched ? (
            <button onClick={() => setShowRatingModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-film-border bg-film-surface text-film-muted active:scale-95 transition-all">
              <Eye size={14} />Già visto
            </button>
          ) : (
            <button onClick={onUnmarkWatched}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-film-red/50 bg-film-red/10 text-film-red active:scale-95 transition-all">
              <EyeOff size={14} />Rimuovi
            </button>
          )}

          {!isOnWatchlist && !isWatched && (
            <button onClick={onAddToWatchlist}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-film-border bg-film-surface text-film-muted active:scale-95 transition-all">
              <Bookmark size={14} />Watchlist
            </button>
          )}
          {isOnWatchlist && !isWatched && (
            <button onClick={onRemoveFromWatchlist}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-purple-500/40 bg-purple-900/20 text-purple-300 active:scale-95 transition-all">
              <BookmarkCheck size={14} />In watchlist
            </button>
          )}
        </div>

        {/* ── Trama ── */}
        {movie.overview && (
          <Section label="Trama">
            <p className="text-film-text/80 text-sm leading-relaxed">{movie.overview}</p>
          </Section>
        )}

        {/* ── Dove guardarlo ── */}
        {allProviders.length > 0 && (
          <Section label="Dove guardarlo" icon={<MapPin size={13} className="text-film-accent" />}>
            <div className="flex flex-wrap gap-2">
              {allProviders.map(p => (
                <div key={p.provider_id}
                  className="flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-2.5 py-1.5">
                  <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">
                    <img src={getProviderLogoUrl(p.logo_path)} alt={p.provider_name}
                      className="w-full h-full object-cover" />
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
          </Section>
        )}

        {/* ── Cast ── */}
        {cast.length > 0 && (
          <Section label="Cast">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {cast.map(actor => <CastCard key={actor.id} actor={actor} />)}
              {!showFullCast && (movie.credits?.cast?.length ?? 0) > 8 && (
                <button onClick={() => setShowFullCast(true)}
                  className="shrink-0 flex flex-col items-center justify-center w-16 h-[90px] rounded-xl bg-film-surface border border-film-border text-film-muted">
                  <ChevronDown size={16} />
                  <span className="text-xs mt-1">+{(movie.credits?.cast?.length ?? 0) - 8}</span>
                </button>
              )}
            </div>
            {showFullCast && (
              <button onClick={() => setShowFullCast(false)}
                className="flex items-center gap-1 text-film-muted text-xs mt-1 hover:text-film-accent transition-colors">
                <ChevronUp size={13} />Mostra meno
              </button>
            )}
          </Section>
        )}

        {/* ── Saga / Franchise ── */}
        {(collectionParts || loadingCollection) && (
          <Section label={collectionName || 'Saga'}>
            {loadingCollection ? (
              <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="shrink-0 w-20 aspect-[2/3] rounded-xl bg-film-surface animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {collectionParts?.map(part => (
                  <RelatedCard
                    key={part.id}
                    item={part}
                    isCurrent={part.id === movie.id}
                    mediaType="movie"
                    onClick={() => onOpenMovie?.(part.id, 'movie')}
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Film / Serie simili ── */}
        {similar.length > 0 && (
          <Section label={isTV ? 'Serie simili' : 'Film simili'}>
            <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {similar.map(item => (
                <RelatedCard
                  key={item.id}
                  item={item}
                  isCurrent={false}
                  mediaType={movie.media_type}
                  onClick={() => onOpenMovie?.(item.id, movie.media_type)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Spazio finale sopra safe area */}
        <div className="h-8" />
      </div>

      {/* Rating modal */}
      {showRatingModal && (
        <RatingModal
          movie={movie}
          onConfirm={r => { setShowRatingModal(false); onMarkWatched(r); }}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────

function Section({ label, icon, children }: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">{label}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Cast card (scroll orizzontale) ──────────────────────────────

function CastCard({ actor }: {
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
      <p className="text-film-text text-xs font-medium mt-1.5 line-clamp-2 leading-tight">{actor.name}</p>
      <p className="text-film-subtle text-xs line-clamp-1 italic">{actor.character}</p>
    </div>
  );
}

// ── Related / Similar card ───────────────────────────────────────

function RelatedCard({ item, isCurrent, mediaType, onClick }: {
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
        'shrink-0 w-24 text-left active:scale-95 transition-all',
        isCurrent ? 'opacity-50 cursor-default' : '',
        !onClick && 'cursor-default'
      )}
    >
      <div className={cn(
        'w-24 aspect-[2/3] rounded-xl overflow-hidden bg-film-surface border',
        isCurrent ? 'border-film-accent' : 'border-film-border'
      )}>
        {poster
          ? <img src={poster} alt={t} className="w-full h-full object-cover"
              onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-xl">
              {mediaType === 'tv' ? '📺' : '🎬'}
            </div>
        }
      </div>
      <p className="text-film-text text-xs mt-1.5 line-clamp-2 leading-tight">{t}</p>
      {item.vote_average > 0 && (
        <p className="text-film-accent text-xs mt-0.5">★ {item.vote_average.toFixed(1)}</p>
      )}
    </button>
  );
}
