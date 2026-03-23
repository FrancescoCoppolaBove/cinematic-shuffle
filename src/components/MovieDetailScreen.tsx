import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, Star, Clock, Play,
  Eye, Bookmark, BookmarkCheck, Heart,
  Tv, Film, MapPin, Shuffle,
} from 'lucide-react';
import type { TMDBMovieDetail, TMDBMovieBasic } from '../types';
import {
  getImageUrl, getProviderLogoUrl, getEnglishTitle, getOriginalTitle, getReleaseDate,
  getBestTrailer, getWatchProviders, getCollection,
} from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { RatingModal } from './RatingModal';
import type { RatingResult } from './RatingModal';
import { MovieDetailTabs } from './MovieDetailTabs';
import { PersonInner, GenreInner } from './InnerMovieDetail';
import { StarRating } from './StarRating';
import type { PlaylistItem } from '../hooks/useNavigationStack';

interface MovieDetailScreenProps {
  movie: TMDBMovieDetail;
  isWatched: boolean;
  isOnWatchlist: boolean;
  personalRating?: number | null;
  showShuffleBtn?: boolean;
  backLabel?: string;
  playlist?: PlaylistItem[];
  playlistIndex?: number;
  onSwipeToIndex?: (index: number) => void;
  onBack: () => void;
  onMarkWatched: (rating: number | null) => void;
  onUnmarkWatched: () => void;
  onUpdateRating?: (rating: number | null) => void;
  onAddToWatchlist: () => void;
  onRemoveFromWatchlist: () => void;
  onShuffle?: () => void;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;
  isLiked?: boolean;
  rewatchCount?: number;
  watchedIds?: Set<number>;
  watchlistIds?: Set<number>;
  likedIds?: Set<number>;
  getPersonalRatingFull?: (id: number) => number | null;
  onMarkWatchedFull?: (movie: import('../types').TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatchedFull?: (id: number) => Promise<void>;
  onUpdateRatingFull?: (id: number, rating: number | null) => Promise<void>;
  onToggleLikedFull?: (id: number) => Promise<void>;
  onAddToWatchlistFull?: (movie: import('../types').TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlistFull?: (id: number) => Promise<void>;
  loading?: boolean;
}

export function MovieDetailScreen({
  movie, isWatched, isOnWatchlist, personalRating,
  showShuffleBtn = false, backLabel = 'Indietro',
  playlist, playlistIndex = 0, onSwipeToIndex,
  onBack, onMarkWatched, onUnmarkWatched, onUpdateRating: _onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onShuffle, onOpenMovie, onIncrementRewatch, onToggleLiked, isLiked = false, rewatchCount = 0,
  watchedIds: propWatchedIds, watchlistIds: propWatchlistIds, likedIds: propLikedIds,
  getPersonalRatingFull, onMarkWatchedFull, onUnmarkWatchedFull, onUpdateRatingFull,
  onToggleLikedFull, onAddToWatchlistFull, onRemoveFromWatchlistFull, loading,
}: MovieDetailScreenProps) {
  const [posterError, setPosterError] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [openPerson, setOpenPerson] = useState<{id: number; name: string} | null>(null);
  const [openGenre, setOpenGenre] = useState<{id: number; name: string; type: 'genre'|'keyword'; mediaType: 'movie'|'tv'} | null>(null);
  const [collectionParts, setCollectionParts] = useState<TMDBMovieBasic[] | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  // ── Swipe animation state ──────────────────────────────────────
  // dragX: current live offset while finger is down (follows finger in real time)
  // slideDir: direction of the commit animation once finger lifts
  const [dragX, setDragX] = useState(0);

  const [isAnimating, setIsAnimating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Raw touch tracking (refs, not state — updated every frame)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const activeDragX = useRef(0); // mirrors dragX for use inside closures

  const title = getEnglishTitle(movie);
  const releaseDate = getReleaseDate(movie);
  const poster = !posterError ? getImageUrl(movie.poster_path, 'w500') : null;
  const backdrop = getImageUrl(movie.backdrop_path, 'w780');
  const isTV = movie.media_type === 'tv';
  const director = !isTV ? movie.credits?.crew?.find(c => c.job === 'Director') : null;
  const creator = isTV ? movie.credits?.crew?.find(c =>
    c.job === 'Creator' || c.job === 'Executive Producer') : null;
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
  ].filter((p, i, arr) => arr.findIndex(x => x.provider_id === p.provider_id) === i).slice(0, 8);

  const similar = (movie.recommendations?.results?.length
    ? movie.recommendations.results
    : movie.similar?.results ?? []).slice(0, 12);

  const runtime = isTV
    ? (movie.episode_run_time?.[0] ? `${movie.episode_run_time[0]}min/ep` : null)
    : movie.runtime;

  const hasPlaylist = !!(playlist && playlist.length > 1 && onSwipeToIndex);
  const canGoPrev = hasPlaylist && playlistIndex > 0;
  const canGoNext = hasPlaylist && playlistIndex < (playlist?.length ?? 0) - 1;

  // Reset content on movie change (after swipe animation completes)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setPosterError(false);
    setCollectionParts(null);
    setShowStickyHeader(false);

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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowStickyHeader(el.scrollTop > 200);
  }, []);

  // ── Touch handlers ─────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!hasPlaylist || isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeLocked.current = null;
    activeDragX.current = 0;
  }, [hasPlaylist, isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!hasPlaylist || touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Lock direction after 8px of movement
    if (!swipeLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    if (swipeLocked.current === 'horizontal') {
      e.preventDefault();

      // Resistance at the edges: if swiping left at first item or right at last, add rubber band
      let resistedDx = dx;
      if ((dx > 0 && !canGoPrev) || (dx < 0 && !canGoNext)) {
        // Rubber band: sqrt dampening makes it feel elastic
        resistedDx = Math.sign(dx) * Math.sqrt(Math.abs(dx)) * 8;
      }

      activeDragX.current = resistedDx;
      setDragX(resistedDx);
    }
  }, [hasPlaylist, canGoPrev, canGoNext]);

  const handleTouchEnd = useCallback(() => {
    if (!hasPlaylist || swipeLocked.current !== 'horizontal') {
      touchStartX.current = null;
      touchStartY.current = null;
      swipeLocked.current = null;
      setDragX(0);
      return;
    }

    const dx = activeDragX.current;
    const threshold = 80; // px needed to commit

    if (dx < -threshold && canGoNext) {
      // Commit: slide out to the left

      setIsAnimating(true);
      setDragX(-window.innerWidth); // fly off screen
      setTimeout(() => {
        onSwipeToIndex!(playlistIndex + 1);
        setDragX(0);

        setIsAnimating(false);
      }, 280);
    } else if (dx > threshold && canGoPrev) {
      // Commit: slide out to the right

      setIsAnimating(true);
      setDragX(window.innerWidth);
      setTimeout(() => {
        onSwipeToIndex!(playlistIndex - 1);
        setDragX(0);

        setIsAnimating(false);
      }, 280);
    } else {
      // Snap back: spring return to center
      setDragX(0);
    }

    touchStartX.current = null;
    touchStartY.current = null;
    swipeLocked.current = null;
    activeDragX.current = 0;
  }, [hasPlaylist, canGoNext, canGoPrev, onSwipeToIndex, playlistIndex]);

  // CSS transition string:
  // - During drag: no transition (follows finger instantly)
  // - On release: spring-like cubic-bezier for snap-back or commit
  const isBeingDragged = swipeLocked.current === 'horizontal' && dragX !== 0;
  const transitionStyle = isBeingDragged
    ? 'none'
    : 'transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  return (
    <div
      className="fixed inset-0 z-[80] bg-film-black"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Scrollable + swipeable content wrapper ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {/* This inner div is what physically moves during swipe */}
        <div
          ref={contentRef}
          style={{
            transform: dragX !== 0 ? `translateX(${dragX}px)` : 'translateX(0)',
            transition: transitionStyle,
            willChange: 'transform',
          }}
        >
          {/* ── Hero backdrop ── */}
          <div
            className="relative w-full"
            style={{ height: '65vw', minHeight: 220, maxHeight: 400 }}
          >
            {backdrop ? (
              <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-film-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-film-black/40 via-film-black/10 to-film-black" />

            {/* Back button */}
            <button
              onClick={onBack}
              className="absolute z-10 flex items-center gap-1.5 active:opacity-60 transition-opacity"
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)', left: 16 }}
            >
              <div className="w-9 h-9 rounded-full bg-film-black/65 backdrop-blur-md flex items-center justify-center border border-white/10">
                <ChevronLeft size={20} className="text-white" />
              </div>
              <span className="text-white/90 text-sm font-medium drop-shadow-lg">{backLabel}</span>
            </button>

            {/* Playlist counter */}
            {hasPlaylist && (
              <div className="absolute z-10 flex items-center gap-2"
                style={{ top: 'calc(env(safe-area-inset-top) + 16px)', right: 16 }}>
                <span className="text-white/70 text-xs bg-film-black/50 backdrop-blur-sm px-2.5 py-1 rounded-xl">
                  {playlistIndex + 1} / {playlist!.length}
                </span>
              </div>
            )}

            {/* Trailer play */}
            {trailerUrl && (
              <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                  <Play size={26} className="text-white ml-1" fill="white" />
                </div>
              </a>
            )}

            {/* Swipe progress indicator — dots strip under backdrop */}
            {hasPlaylist && playlist!.length <= 20 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {playlist!.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === playlistIndex ? 16 : 6,
                      height: 4,
                      background: i === playlistIndex
                        ? '#E8C547'
                        : 'rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Media badge */}
            <div className="absolute bottom-8 left-4">
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

          {/* ── Content ── */}
          <div className="px-4">
            {/* Poster + title */}
            <div className="flex gap-4 items-end mb-5">
              <div className="shrink-0 -mt-16 relative z-10">
                <div className="w-28 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-film-black shadow-2xl bg-film-card">
                  {poster ? (
                    <img src={poster} alt={title} className="w-full h-full object-cover"
                      onError={() => setPosterError(true)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {isTV ? '📺' : '🎬'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <h1 className="font-display text-2xl leading-tight tracking-wide text-film-text break-words">
                  {title}
                </h1>
                {getOriginalTitle(movie) && (
                  <p className="text-film-subtle text-sm mt-0.5 leading-snug">{getOriginalTitle(movie)}</p>
                )}
                {movie.tagline && (
                  <p className="text-film-accent text-xs italic mt-1 leading-snug">"{movie.tagline}"</p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                  <div className="flex items-center gap-1">
                    <Star size={12} className={ratingColor} fill="currentColor" />
                    <span className={cn('font-mono font-bold text-sm', ratingColor)}>{formatRating(rating)}</span>
                    <span className="text-film-subtle text-xs">/10</span>
                  </div>
                  <span className="text-film-border text-xs">·</span>
                  <span className="text-film-muted text-xs">{formatYear(releaseDate)}</span>
                  {runtime && (
                    <>
                      <span className="text-film-border text-xs">·</span>
                      <div className="flex items-center gap-1 text-film-muted">
                        <Clock size={11} />
                        <span className="text-xs">{typeof runtime === 'number' ? formatRuntime(runtime) : runtime}</span>
                      </div>
                    </>
                  )}
                  {isTV && movie.number_of_seasons && (
                    <>
                      <span className="text-film-border text-xs">·</span>
                      <span className="text-film-muted text-xs">{movie.number_of_seasons} stagioni</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Generi */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {movie.genres?.map(g => (
                <span key={g.id} className="px-2.5 py-1 rounded-xl bg-film-surface border border-film-border text-film-muted text-xs">
                  {g.name}
                </span>
              ))}
            </div>

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

            {isWatched && (
              <div className="flex items-center gap-3 px-4 py-3 bg-film-surface rounded-2xl border border-film-border mb-4">
                <span className="text-film-subtle text-xs uppercase tracking-wider shrink-0">Il tuo voto</span>
                <StarRating value={personalRating ?? null} onChange={() => {}} readonly size="sm" />
              </div>
            )}


            {/* Rewatch counter — solo se visto */}
            {isWatched && onIncrementRewatch && (
              <div className="flex items-center justify-between px-4 py-3 bg-film-surface rounded-2xl border border-film-border mb-4">
                <div>
                  <p className="text-film-text text-sm font-medium">Rewatch</p>
                  <p className="text-film-subtle text-xs mt-0.5">
                    {rewatchCount === 0 ? 'Prima visione' : `Rivisto ${rewatchCount} ${rewatchCount === 1 ? 'volta' : 'volte'}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onIncrementRewatch(movie.id, -1)}
                    disabled={rewatchCount === 0}
                    className="w-9 h-9 rounded-full bg-film-card border border-film-border flex items-center justify-center text-film-text text-lg active:scale-90 transition-transform disabled:opacity-30"
                  >−</button>
                  <span className="text-film-accent font-mono font-bold text-lg w-6 text-center">{rewatchCount}</span>
                  <button
                    onClick={() => onIncrementRewatch(movie.id, 1)}
                    className="w-9 h-9 rounded-full bg-film-accent text-film-black flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                  >+</button>
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {showShuffleBtn && onShuffle && (
                <button onClick={onShuffle} disabled={loading}
                  className="flex items-center gap-2 bg-film-accent text-film-black font-semibold px-4 py-2.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-50">
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
              {/* "Già visto" — apre sempre il modal, sia per aggiungere che per modificare */}
              <button
                onClick={() => setShowRatingModal(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                  isWatched
                    ? 'border-green-600/50 bg-green-950/30 text-green-400'
                    : 'border-film-border bg-film-surface text-film-muted'
                )}
              >
                <Eye size={14} />
                {isWatched ? 'Visto ✓' : 'Già visto'}
              </button>

              {/* Liked badge — tap apre il modal */}
              {isWatched && (
                <button
                  onClick={() => setShowRatingModal(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                    isLiked
                      ? 'border-pink-500/40 bg-pink-950/30 text-pink-400'
                      : 'border-film-border bg-film-surface text-film-muted'
                  )}
                >
                  <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                  {isLiked ? 'Piaciuto ♥' : 'Mi è piaciuto?'}
                </button>
              )}

              {/* Watchlist */}
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

            {movie.overview && (
              <Section label="Trama">
                <p className="text-film-text/80 text-sm leading-relaxed">{movie.overview}</p>
              </Section>
            )}

            {allProviders.length > 0 && (
              <Section label="Dove guardarlo" icon={<MapPin size={13} className="text-film-accent" />}>
                <div className="flex flex-wrap gap-2">
                  {allProviders.map(p => (
                    <div key={p.provider_id}
                      className="flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-2.5 py-1.5">
                      <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">
                        <img src={getProviderLogoUrl(p.logo_path)} alt={p.provider_name} className="w-full h-full object-cover" />
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

            {/* Cast section moved to MovieDetailTabs below */}

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
                      <RelatedCard key={part.id} item={part} isCurrent={part.id === movie.id}
                        isWatched={(propWatchedIds ?? new Set()).has(part.id)}
                        mediaType="movie" onClick={() => onOpenMovie?.(part.id, 'movie')} />
                    ))}
                  </div>
                )}
              </Section>
            )}

            {similar.length > 0 && (
              <Section label={isTV ? 'Serie simili' : 'Film simili'}>
                <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {similar.map(item => (
                    <RelatedCard key={item.id} item={item} isCurrent={false}
                      isWatched={(propWatchedIds ?? new Set()).has(item.id)}
                      mediaType={movie.media_type} onClick={() => onOpenMovie?.(item.id, movie.media_type)} />
                  ))}
                </div>
              </Section>
            )}


          {/* ── Tabs: Cast / Crew / Generi ── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Cast & Approfondimenti</h3>
            </div>
            <MovieDetailTabs
              movie={movie}
              onOpenPerson={(id, name) => setOpenPerson({ id, name })}
              onOpenGenre={(id, name, mt) => setOpenGenre({ id, name, type: 'genre', mediaType: mt })}
              onOpenKeyword={(id, name, mt) => setOpenGenre({ id, name, type: 'keyword', mediaType: mt })}
            />
          </div>

            <div className="h-8" />
          </div>
        </div>{/* end animated inner div */}
      </div>{/* end scrollable */}

      {/* ── Sticky header (fuori dal div animato, sempre fisso) ── */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-20 border-b border-film-border/50 bg-film-black/90 backdrop-blur-md transition-all duration-200',
          showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="shrink-0 active:opacity-60 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text text-sm font-medium truncate">{title}</p>
            <p className="text-film-subtle text-xs">{formatYear(releaseDate)}</p>
          </div>
          {hasPlaylist && (
            <span className="text-film-subtle text-xs shrink-0 font-mono">
              {playlistIndex + 1}/{playlist!.length}
            </span>
          )}
        </div>
      </div>

      {/* Person detail overlay */}
      {openPerson && (
        <PersonInner
          personId={openPerson.id}
          personName={openPerson.name}
          watchedIds={propWatchedIds ?? new Set()}
          watchlistIds={propWatchlistIds}
          likedIds={propLikedIds}
          getPersonalRating={getPersonalRatingFull}
          onMarkWatched={onMarkWatchedFull}
          onUnmarkWatched={onUnmarkWatchedFull}
          onUpdateRating={onUpdateRatingFull}
          onToggleLiked={onToggleLikedFull}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlistFull}
          onRemoveFromWatchlist={onRemoveFromWatchlistFull}
          onBack={() => setOpenPerson(null)}
        />
      )}

      {/* Genre/Keyword overlay */}
      {openGenre && (
        <GenreInner
          id={openGenre.id}
          name={openGenre.name}
          type={openGenre.type}
          mediaType={openGenre.mediaType}
          watchedIds={propWatchedIds ?? new Set()}
          watchlistIds={propWatchlistIds}
          likedIds={propLikedIds}
          getPersonalRating={getPersonalRatingFull}
          onMarkWatched={onMarkWatchedFull}
          onUnmarkWatched={onUnmarkWatchedFull}
          onUpdateRating={onUpdateRatingFull}
          onToggleLiked={onToggleLikedFull}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlistFull}
          onRemoveFromWatchlist={onRemoveFromWatchlistFull}
          onBack={() => setOpenGenre(null)}
        />
      )}

      {/* Rating modal */}
      {showRatingModal && (
        <RatingModal
          movie={movie}
          initialWatched={isWatched}
          initialRating={personalRating ?? null}
          initialLiked={isLiked}
          initialWatchlist={isOnWatchlist}
          showWatchlistBtn={!isWatched}
          onConfirm={(result: RatingResult) => {
            setShowRatingModal(false);
            if (result.watched) {
              // Segna come visto (o aggiorna rating/liked)
              onMarkWatched(result.rating);
              if (result.liked && onToggleLiked && !isLiked) onToggleLiked(movie.id);
              if (!result.liked && onToggleLiked && isLiked) onToggleLiked(movie.id);
            } else if (isWatched) {
              // Era visto, ora deselezionato → rimuovi
              onUnmarkWatched();
            }
          }}
          onToggleWatchlist={isOnWatchlist ? onRemoveFromWatchlist : onAddToWatchlist}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </div>
  );
}

function Section({ label, icon, children }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode;
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

function RelatedCard({ item, isCurrent, mediaType, onClick, isWatched = false }: {
  item: TMDBMovieBasic; isCurrent: boolean; mediaType: 'movie' | 'tv'; onClick?: () => void; isWatched?: boolean;
}) {
  const [err, setErr] = useState(false);
  const poster = !err ? getImageUrl(item.poster_path, 'w185') : null;
  const t = getEnglishTitle(item);
  return (
    <button onClick={onClick} disabled={isCurrent || !onClick}
      className={cn('shrink-0 w-24 text-left active:scale-95 transition-all',
        isCurrent ? 'opacity-50 cursor-default' : '', !onClick && 'cursor-default')}>
      <div className={cn('w-24 aspect-[2/3] rounded-xl overflow-hidden bg-film-surface border',
        isCurrent ? 'border-film-accent' : 'border-film-border')}>
        {poster
          ? <img src={poster} alt={t} className={`w-full h-full object-cover${isCurrent ? '' : isWatched ? ' opacity-40 grayscale' : ''}`} onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-xl">{mediaType === 'tv' ? '📺' : '🎬'}</div>
        }
      </div>
      <p className="text-film-text text-xs mt-1.5 line-clamp-2 leading-tight">{t}</p>
      {item.vote_average > 0 && (
        <p className="text-film-accent text-xs mt-0.5">★ {item.vote_average.toFixed(1)}</p>
      )}
    </button>
  );
}
