import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Star, Clock, Play,
  Eye, Bookmark, BookmarkCheck, Heart,
  Tv, Film, MapPin, Shuffle, Check,
} from 'lucide-react';
import type { TMDBMovieDetail, TMDBMovieBasic } from '../types';
import {
  getImageUrl, getProviderLogoUrl, getEnglishTitle, getOriginalTitle, getReleaseDate,
  getBestTrailer, getWatchProviders, getCollection,
} from '../services/tmdb';
import { formatRuntime, formatYear, formatRating, cn } from '../utils';
import { getAuth } from 'firebase/auth';
import { fetchWatchedEpisodes, toggleWatchedEpisode, markAllEpisodesInSeason } from '../services/firestore';
import { MovieDetailTabs } from './MovieDetailTabs';
import { PersonInner, GenreInner } from './InnerMovieDetail';
import { BrowseListScreen } from './BrowseListScreen';
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
  getRewatchCountFull?: (id: number) => number;
  onMarkWatchedFull?: (movie: import('../types').TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatchedFull?: (id: number) => Promise<void>;
  onUpdateRatingFull?: (id: number, rating: number | null) => Promise<void>;
  onToggleLikedFull?: (id: number) => Promise<void>;
  onAddToWatchlistFull?: (movie: import('../types').TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlistFull?: (id: number) => Promise<void>;
  loading?: boolean;
  tvSeriesStatus?: 'following' | 'completed' | null;
  onSetFollowing?: () => Promise<void>;
  onSetCompleted?: () => Promise<void>;
  onUnsetTVStatus?: () => Promise<void>;
  onRequestRating?: () => void;
}

export function MovieDetailScreen({
  movie, isWatched, isOnWatchlist, personalRating,
  showShuffleBtn = false, backLabel = 'Indietro',
  playlist, playlistIndex = 0, onSwipeToIndex,
  onBack, onMarkWatched: _onMarkWatched, onUnmarkWatched: _onUnmarkWatched, onUpdateRating: _onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
  onShuffle, onOpenMovie, onIncrementRewatch, onToggleLiked: _onToggleLiked, isLiked = false, rewatchCount = 0,
  watchedIds: propWatchedIds, watchlistIds: propWatchlistIds, likedIds: propLikedIds,
  getPersonalRatingFull, getRewatchCountFull, onMarkWatchedFull, onUnmarkWatchedFull, onUpdateRatingFull,
  onToggleLikedFull, onAddToWatchlistFull, onRemoveFromWatchlistFull, loading,
  tvSeriesStatus, onSetFollowing, onSetCompleted: _onSetCompleted, onUnsetTVStatus,
  onRequestRating,
}: MovieDetailScreenProps) {
  const [posterError, setPosterError] = useState(false);
  const [openPerson, setOpenPerson] = useState<{id: number; name: string} | null>(null);
  const [openSimilar, setOpenSimilar] = useState(false);
  const [openSeason, setOpenSeason] = useState<{ seriesId: number; seasonNumber: number; seasonName: string } | null>(null);
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
    : movie.similar?.results ?? []).slice(0, 10);

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
    const threshold = 60; // px needed to commit

    if (dx < -threshold && canGoNext) {
      // Commit: quick snap left, swap content, snap back from right
      setIsAnimating(true);
      setDragX(-window.innerWidth * 0.6); // fly partially off — faster
      setTimeout(() => {
        onSwipeToIndex!(playlistIndex + 1);
        // Place new content coming in from the right
        setDragX(window.innerWidth * 0.3);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDragX(0); // animate to center
            setTimeout(() => setIsAnimating(false), 220);
          });
        });
      }, 180);
    } else if (dx > threshold && canGoPrev) {
      // Commit: quick snap right, swap content, snap back from left
      setIsAnimating(true);
      setDragX(window.innerWidth * 0.6);
      setTimeout(() => {
        onSwipeToIndex!(playlistIndex - 1);
        setDragX(-window.innerWidth * 0.3);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDragX(0);
            setTimeout(() => setIsAnimating(false), 220);
          });
        });
      }, 180);
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
    : 'transform 220ms cubic-bezier(0.33, 1, 0.68, 1)'; // snappier ease-out

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
        style={{ WebkitOverflowScrolling: 'touch', willChange: 'transform' } as React.CSSProperties}
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

            {/* Play button removed — Trailer CTA in buttons below */}

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
              {/* Watch CTA — film vs serie TV */}
              {movie.media_type === 'tv' ? (
                <>
                  {/* "Già vista" — apre il modal di rating (same as film) */}
                  <button
                    onClick={() => onRequestRating?.()}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                      tvSeriesStatus === 'completed'
                        ? 'border-green-600/50 bg-green-950/30 text-green-400'
                        : 'border-film-border bg-film-surface text-film-muted'
                    )}
                  >
                    <Eye size={14} />
                    {tvSeriesStatus === 'completed' ? 'Completata ✓' : 'Già vista'}
                  </button>
                  {/* "Sto seguendo" */}
                  <button
                    onClick={async () => {
                      if (tvSeriesStatus === 'following') {
                        await onUnsetTVStatus?.();
                      } else {
                        await onSetFollowing?.();
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                      tvSeriesStatus === 'following'
                        ? 'border-blue-500/50 bg-blue-950/30 text-blue-400'
                        : 'border-film-border bg-film-surface text-film-muted'
                    )}
                  >
                    <Tv size={14} />
                    {tvSeriesStatus === 'following' ? 'In corso 📺' : 'Sto seguendo'}
                  </button>
                </>
              ) : (
                /* Film: singolo bottone "Già visto" */
                <button
                  onClick={() => onRequestRating?.()}
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
              )}

              {/* Liked badge — tap apre il modal */}
              {(isWatched || tvSeriesStatus) && (
                <button
                  onClick={() => onRequestRating?.()}
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
              {!isOnWatchlist && !isWatched && !tvSeriesStatus && (
                <button onClick={onAddToWatchlist}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border border-film-border bg-film-surface text-film-muted active:scale-95 transition-all">
                  <Bookmark size={14} />Watchlist
                </button>
              )}
              {isOnWatchlist && !isWatched && !tvSeriesStatus && (
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
              <ProvidersSection providers={allProviders} tmdbLink={providers?.link ?? null} />
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

            {/* TV Seasons info — only for TV shows */}
            {isTV && (movie.seasons?.length ?? 0) > 0 && (
              <Section label="Stagioni">
                {/* Status badge — solo se in produzione */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {movie.in_production && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-green-900/40 text-green-400 border border-green-700/50">
                      🟢 In produzione
                    </span>
                  )}
                  {movie.next_episode_to_air && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-film-accent/10 text-film-accent border border-film-accent/30">
                      🎬 Stagione {movie.next_episode_to_air.season_number} · {new Date(movie.next_episode_to_air.air_date).getFullYear()}
                    </span>
                  )}
                </div>

                {/* Seasons list */}
                <div className="space-y-0">
                  {movie.seasons
                    ?.filter(s => s.season_number > 0)
                    .map(s => {
                      const year = s.air_date ? new Date(s.air_date).getFullYear() : null;
                      const isCurrentSeason = movie.next_episode_to_air?.season_number === s.season_number;
                      const hasNoEpisodes = (s.episode_count ?? 0) === 0;
                      // Stagione senza episodi: determina stato
                      const noEpLabel = !s.air_date
                        ? 'In lavorazione'
                        : year && year > new Date().getFullYear()
                          ? `Annunciata · ${year}`
                          : year
                            ? `In arrivo · ${year}`
                            : 'Annunciata';

                      const inner = (
                        <>
                          {s.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${s.poster_path}`}
                              alt={s.name}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-film-border"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-film-surface border border-film-border shrink-0 flex items-center justify-center text-film-subtle text-xs font-mono">
                              {s.season_number}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${hasNoEpisodes ? 'text-film-muted' : 'text-film-text'}`}>{s.name}</p>
                              {isCurrentSeason && (
                                <span className="text-film-accent text-xs font-medium">● In corso</span>
                              )}
                            </div>
                            <p className="text-film-subtle text-xs mt-0.5">
                              {hasNoEpisodes
                                ? noEpLabel
                                : `${s.episode_count} episodi${year ? ` · ${year}` : ''}`}
                            </p>
                          </div>
                          {!hasNoEpisodes && (
                            <ChevronRight size={14} className="text-film-subtle/50 shrink-0" />
                          )}
                        </>
                      );

                      return hasNoEpisodes ? (
                        <div key={s.id} className="flex items-center gap-3 py-2 border-b border-film-border/40 last:border-0 opacity-60">
                          {inner}
                        </div>
                      ) : (
                        <button
                          key={s.id}
                          onClick={() => setOpenSeason({ seriesId: movie.id, seasonNumber: s.season_number, seasonName: s.name })}
                          className="w-full flex items-center gap-3 py-2 border-b border-film-border/40 last:border-0 active:bg-film-surface/50 transition-colors text-left"
                        >
                          {inner}
                        </button>
                      );
                    })}
                </div>
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
                <button
                  onClick={() => setOpenSimilar(true)}
                  className="mt-2 text-film-accent text-xs font-medium active:opacity-60 transition-opacity"
                >
                  Vedi tutti i film simili →
                </button>
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
          getRewatchCount={getRewatchCountFull}
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
          getRewatchCount={getRewatchCountFull}
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

      {openSeason && (
        <SeasonDetailOverlay
          seriesId={openSeason.seriesId}
          seasonNumber={openSeason.seasonNumber}
          seasonName={openSeason.seasonName}
          onBack={() => setOpenSeason(null)}
        />
      )}

      {openSimilar && (
        <BrowseListScreen
          source={{ type: 'similar', movieId: movie.id, movieTitle: title, mediaType: movie.media_type }}
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
          onBack={() => setOpenSimilar(false)}
          zIndex={96}
        />
      )}

      {/* Rating modal */}

    </div>
  );
}


// ── ProvidersSection: first 5 visible, rest collapsed, each links to platform ──
function ProvidersSection({ providers, tmdbLink }: {
  providers: { provider_id: number; provider_name: string; logo_path: string }[];
  tmdbLink: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? providers : providers.slice(0, 5);
  const hasMore = providers.length > 5;

  return (
    <Section label="Dove guardarlo" icon={<MapPin size={13} className="text-film-accent" />}>
      <div className="flex flex-wrap gap-2">
        {visible.map(p => (
          <a
            key={p.provider_id}
            href={tmdbLink ?? `https://www.justwatch.com/it/cerca?q=${encodeURIComponent(p.provider_name)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-2.5 py-1.5 active:opacity-70 transition-opacity"
          >
            <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">
              <img src={getProviderLogoUrl(p.logo_path)} alt={p.provider_name} className="w-full h-full object-cover" />
            </div>
            <span className="text-film-text text-xs font-medium">{p.provider_name}</span>
          </a>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-film-accent text-xs mt-1 active:opacity-60"
        >
          {expanded ? 'Mostra meno ↑' : `Mostra altri ${providers.length - 5} →`}
        </button>
      )}
    </Section>
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

// ── Episode overview expand/collapse ─────────────────────────────
function EpisodeOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;
  return (
    <div className="mt-1">
      <p className={cn('text-film-text/60 text-xs leading-relaxed', !expanded && isLong && 'line-clamp-2')}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-film-accent text-xs mt-0.5 active:opacity-60"
        >
          {expanded ? 'Mostra meno ↑' : 'Mostra tutto ↓'}
        </button>
      )}
    </div>
  );
}

// ── SeasonDetailOverlay — episodi di una stagione ─────────────────
function SeasonDetailOverlay({
  seriesId, seasonNumber, seasonName, onBack,
}: {
  seriesId: number;
  seasonNumber: number;
  seasonName: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<{
    episodes: import('../services/tmdb').TVEpisode[];
    overview: string;
    air_date: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [uid, setUid] = useState<string | null>(null);

  // Get current user uid
  useEffect(() => {
    const auth = getAuth();
    setUid(auth.currentUser?.uid ?? null);
  }, []);

  // Load episodes
  useEffect(() => {
    import('../services/tmdb').then(({ getTVSeasonEpisodes }) =>
      getTVSeasonEpisodes(seriesId, seasonNumber)
    ).then(res => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [seriesId, seasonNumber]);

  // Load watched episodes from Firestore
  useEffect(() => {
    if (!uid) return;
    fetchWatchedEpisodes(uid, seriesId).then(setWatchedEps).catch(() => {});
  }, [uid, seriesId]);

  const epKey = (epNum: number) => `${seasonNumber}_${epNum}`;

  const handleToggleEp = async (epNum: number) => {
    if (!uid) return;
    const next = await toggleWatchedEpisode(uid, seriesId, epKey(epNum), watchedEps);
    setWatchedEps(next);
  };

  const handleToggleSeason = async () => {
    if (!uid || !data) return;
    const keys = data.episodes.map(ep => epKey(ep.episode_number));
    const next = await markAllEpisodesInSeason(uid, seriesId, keys, watchedEps);
    setWatchedEps(next);
  };

  const seasonKeys = data?.episodes.map(ep => epKey(ep.episode_number)) ?? [];
  const watchedCount = seasonKeys.filter(k => watchedEps.has(k)).length;
  const allWatched = seasonKeys.length > 0 && watchedCount === seasonKeys.length;

  return (
    <div
      className="fixed left-0 right-0 z-[97] bg-film-black flex flex-col"
      style={{ top: 0, bottom: 'var(--nav-h, 60px)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-film-black border-b border-film-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-semibold truncate">{seasonName}</p>
            {data && (
              <p className="text-film-subtle text-xs">
                {watchedCount}/{data.episodes.length} episodi visti
              </p>
            )}
          </div>
          {/* Mark all season button */}
          {data && data.episodes.length > 0 && (
            <button
              onClick={handleToggleSeason}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:opacity-60',
                allWatched
                  ? 'bg-film-accent/20 border-film-accent text-film-accent'
                  : 'bg-film-surface border-film-border text-film-muted'
              )}
            >
              <Check size={12} />
              {allWatched ? 'Vista' : 'Segna tutta'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {data.overview && (
              <div className="px-4 py-3 border-b border-film-border/50">
                <p className={cn('text-film-text/70 text-sm leading-relaxed', !overviewExpanded && 'line-clamp-3')}>
                  {data.overview}
                </p>
                {data.overview.length > 180 && (
                  <button
                    onClick={() => setOverviewExpanded(v => !v)}
                    className="text-film-accent text-xs mt-1 active:opacity-60"
                  >
                    {overviewExpanded ? 'Mostra meno ↑' : 'Mostra tutto ↓'}
                  </button>
                )}
              </div>
            )}

            <div className="divide-y divide-film-border/40">
              {data.episodes.map(ep => {
                const key = epKey(ep.episode_number);
                const isWatched = watchedEps.has(key);
                return (
                  <div key={ep.id} className={cn('flex gap-3 px-4 py-3 transition-colors', isWatched && 'bg-film-surface/30')}>
                    {/* Still image */}
                    <div className="relative shrink-0">
                      {ep.still_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${ep.still_path}`}
                          alt={ep.name}
                          className={cn('w-24 h-14 rounded-lg object-cover border border-film-border', isWatched && 'opacity-50 grayscale')}
                        />
                      ) : (
                        <div className="w-24 h-14 rounded-lg bg-film-surface border border-film-border flex items-center justify-center">
                          <Tv size={18} className="text-film-subtle" />
                        </div>
                      )}
                      {isWatched && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-film-accent flex items-center justify-center">
                            <Check size={13} className="text-film-black" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-film-subtle text-xs">Ep. {ep.episode_number}</p>
                          <p className={cn('text-sm font-medium leading-tight', isWatched ? 'text-film-subtle' : 'text-film-text')}>{ep.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ep.vote_average > 0 && (
                            <span className="text-film-accent text-xs font-mono">★ {ep.vote_average.toFixed(1)}</span>
                          )}
                          {/* Watch toggle button */}
                          <button
                            onClick={() => handleToggleEp(ep.episode_number)}
                            className={cn(
                              'w-7 h-7 rounded-full border flex items-center justify-center transition-colors active:opacity-60',
                              isWatched
                                ? 'bg-film-accent border-film-accent'
                                : 'bg-film-surface border-film-border'
                            )}
                          >
                            <Check size={13} className={isWatched ? 'text-film-black' : 'text-film-subtle'} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {ep.air_date && (
                          <span className="text-film-subtle text-xs">
                            {new Date(ep.air_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {ep.runtime && (
                          <>
                            <span className="text-film-border text-xs">·</span>
                            <span className="text-film-subtle text-xs flex items-center gap-0.5">
                              <Clock size={10} />{ep.runtime} min
                            </span>
                          </>
                        )}
                      </div>

                      {ep.overview && <EpisodeOverview text={ep.overview} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
