/**
 * InnerMovieDetail — scheda film completa usata dentro PersonDetailScreen e GenreMoviesScreen.
 *
 * È IDENTICA alla MovieDetailScreen principale ma:
 * - Fetcha i propri dati (id + mediaType)
 * - Ha un proprio z-index (z-[95]) per stare sopra le schermate che la chiamano
 * - Il Back chiama onBack() che chiude solo questo overlay (torna alla lista Cast/Generi)
 * - Ha tutte le CTA (watched/liked/watchlist/rating), i tab Cast/Crew/Generi, i film simili
 * - Può aprire ricorsivamente altri InnerMovieDetail (dai film simili o dal cast interno)
 *
 * Props opzionali per CTA funzionanti — se non passate le CTA vengono nascoste.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Star, Clock, Play, Eye, Heart, Bookmark, BookmarkCheck } from 'lucide-react';
import {
  getMovieDetail, getImageUrl, getTitle, getReleaseDate,
  getBestTrailer, getWatchProviders, getProviderLogoUrl,
} from '../services/tmdb';
import type { TMDBMovieDetail } from '../types';
import { formatYear, formatRating, formatRuntime, cn } from '../utils';
import { RatingModal } from './RatingModal';
import type { RatingResult } from './RatingModal';
import { MovieDetailTabs } from './MovieDetailTabs';

interface InnerMovieDetailProps {
  id: number;
  mediaType: 'movie' | 'tv';
  watchedIds: Set<number>;
  // CTA props — opzionali, se mancano le CTA vengono omesse
  watchlistIds?: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
}

export function InnerMovieDetail({
  id, mediaType, watchedIds,
  watchlistIds = new Set(), likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onBack,
}: InnerMovieDetailProps) {
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [openPerson, setOpenPerson] = useState<{ id: number; name: string } | null>(null);
  const [openGenre, setOpenGenre] = useState<{ id: number; name: string; type: 'genre' | 'keyword'; mediaType: 'movie' | 'tv' } | null>(null);
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setMovie(null);
    scrollRef.current?.scrollTo(0, 0);
    getMovieDetail(id, mediaType)
      .then(setMovie)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  const isWatched = watchedIds.has(id);
  const isOnWatchlist = watchlistIds.has(id);
  const isLiked = likedIds.has(id);
  const personalRating = getPersonalRating?.(id) ?? null;
  const hasCTA = !!(onMarkWatched && onUnmarkWatched && onAddToWatchlist && onRemoveFromWatchlist);

  const handleRatingConfirm = useCallback(async (result: RatingResult) => {
    if (!movie) return;
    setShowRatingModal(false);
    if (result.watched) {
      await onMarkWatched?.(movie, result.rating);
      if (onToggleLiked) {
        if (result.liked && !isLiked) await onToggleLiked(movie.id);
        if (!result.liked && isLiked) await onToggleLiked(movie.id);
      }
    } else if (isWatched) {
      await onUnmarkWatched?.(movie.id);
    }
  }, [movie, isWatched, isLiked, onMarkWatched, onUnmarkWatched, onToggleLiked]);

  const title = movie ? getTitle(movie) : '...';
  const trailerUrl = movie ? getBestTrailer(movie) : null;
  const providers = movie ? getWatchProviders(movie) : null;
  const streaming = [...(providers?.flatrate ?? []), ...(providers?.free ?? [])]
    .filter((p, i, a) => a.findIndex(x => x.provider_id === p.provider_id) === i).slice(0, 5);

  return (
    <div className="fixed inset-0 z-[95] bg-film-black flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <p className="flex-1 text-film-text font-semibold truncate">{title}</p>
          {isWatched && <span className="text-green-400 text-xs shrink-0">✓ Visto</span>}
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {movie && !loading && (
          <div className="space-y-4 pb-8">
            {/* Backdrop + trailer */}
            {movie.backdrop_path && (
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                <img src={getImageUrl(movie.backdrop_path, 'w780') || ''} alt=""
                  className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-film-black/70" />
                {trailerUrl && (
                  <a href={trailerUrl} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                      <Play size={18} className="text-white ml-0.5" fill="white" />
                    </div>
                  </a>
                )}
              </div>
            )}

            <div className="px-4 space-y-4">
              {/* Titolo + tagline */}
              <div>
                <h2 className="font-display text-2xl text-film-text tracking-wide leading-tight">{title}</h2>
                {movie.tagline && <p className="text-film-accent text-xs italic mt-1">"{movie.tagline}"</p>}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {movie.vote_average > 0 && (
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-film-accent" fill="currentColor" />
                    <span className="text-film-accent text-sm font-mono font-bold">{formatRating(movie.vote_average)}</span>
                    <span className="text-film-subtle text-xs">/10</span>
                  </div>
                )}
                <span className="text-film-border text-xs">·</span>
                <span className="text-film-muted text-sm">{formatYear(getReleaseDate(movie))}</span>
                {movie.runtime && (
                  <><span className="text-film-border text-xs">·</span>
                  <div className="flex items-center gap-1 text-film-muted">
                    <Clock size={11} />
                    <span className="text-sm">{formatRuntime(movie.runtime)}</span>
                  </div></>
                )}
                {movie.number_of_seasons && (
                  <><span className="text-film-border text-xs">·</span>
                  <span className="text-film-muted text-sm">{movie.number_of_seasons} stag.</span></>
                )}
              </div>

              {/* Generi */}
              {movie.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map(g => (
                    <span key={g.id} className="px-2 py-0.5 rounded-lg bg-film-card border border-film-border text-film-muted text-xs">{g.name}</span>
                  ))}
                </div>
              )}

              {/* CTA */}
              {hasCTA && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowRatingModal(true)}
                    className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                      isWatched ? 'border-green-600/50 bg-green-950/30 text-green-400' : 'border-film-border bg-film-surface text-film-muted')}>
                    <Eye size={14} />{isWatched ? 'Visto ✓' : 'Già visto'}
                  </button>
                  {isWatched && (
                    <button onClick={() => onToggleLiked?.(movie.id)}
                      className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                        isLiked ? 'border-pink-500/40 bg-pink-950/30 text-pink-400' : 'border-film-border bg-film-surface text-film-muted')}>
                      <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                      {isLiked ? 'Piaciuto ♥' : 'Mi è piaciuto?'}
                    </button>
                  )}
                  {!isWatched && (
                    <button onClick={isOnWatchlist ? () => onRemoveFromWatchlist?.(movie.id) : () => onAddToWatchlist?.(movie)}
                      className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all active:scale-95',
                        isOnWatchlist ? 'border-purple-500/40 bg-purple-900/20 text-purple-300' : 'border-film-border bg-film-surface text-film-muted')}>
                      {isOnWatchlist ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      {isOnWatchlist ? 'In watchlist' : 'Watchlist'}
                    </button>
                  )}
                </div>
              )}

              {/* Rating personale (read-only) */}
              {isWatched && personalRating && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-film-surface rounded-xl border border-film-border">
                  <span className="text-film-subtle text-xs uppercase tracking-wider">Il tuo voto</span>
                  <span className="text-film-accent font-bold">{personalRating} ★</span>
                  <button onClick={() => setShowRatingModal(true)} className="text-film-subtle text-xs ml-auto active:opacity-60">Modifica</button>
                </div>
              )}

              {/* Provider */}
              {streaming.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-film-subtle text-xs shrink-0">Disponibile su</span>
                  {streaming.map(p => (
                    <img key={p.provider_id} src={getProviderLogoUrl(p.logo_path)}
                      alt={p.provider_name} className="w-7 h-7 rounded-lg" title={p.provider_name} />
                  ))}
                </div>
              )}

              {/* Overview */}
              {movie.overview && (
                <p className="text-film-text/75 text-sm leading-relaxed">{movie.overview}</p>
              )}

              {/* Tabs Cast / Crew / Generi — identici alla scheda principale */}
              <MovieDetailTabs
                movie={movie}
                onOpenPerson={(pid, name) => setOpenPerson({ id: pid, name })}
                onOpenGenre={(gid, name, mt) => setOpenGenre({ id: gid, name, type: 'genre', mediaType: mt })}
                onOpenKeyword={(kid, name, mt) => setOpenGenre({ id: kid, name, type: 'keyword', mediaType: mt })}
              />

              {/* Film simili */}
              {(() => {
                const similar = (movie.recommendations?.results?.length
                  ? movie.recommendations.results : movie.similar?.results ?? []).slice(0, 10);
                return similar.length > 0 ? (
                  <div>
                    <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">
                      {movie.media_type === 'tv' ? 'Serie simili' : 'Film simili'}
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
                      {similar.map(item => (
                        <button key={item.id}
                          onClick={() => setInnerMovie({ id: item.id, mediaType: movie.media_type })}
                          className="shrink-0 w-20 text-left active:scale-95 transition-all">
                          <div className="w-20 aspect-[2/3] rounded-xl overflow-hidden bg-film-surface border border-film-border">
                            {item.poster_path
                              ? <img src={getImageUrl(item.poster_path, 'w185') || ''} alt={getTitle(item)} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>}
                          </div>
                          <p className="text-film-text text-xs mt-1 line-clamp-2 leading-tight">{getTitle(item)}</p>
                          {item.vote_average > 0 && <p className="text-film-accent text-xs">★ {item.vote_average.toFixed(1)}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Rating modal */}
      {showRatingModal && movie && (
        <RatingModal
          movie={movie}
          initialWatched={isWatched}
          initialRating={personalRating}
          initialLiked={isLiked}
          initialWatchlist={isOnWatchlist}
          onConfirm={handleRatingConfirm}
          onToggleWatchlist={isOnWatchlist ? () => onRemoveFromWatchlist?.(movie.id) : () => onAddToWatchlist?.(movie)}
          onCancel={() => setShowRatingModal(false)}
        />
      )}

      {/* Person detail (z-[98]) */}
      {openPerson && (
        <PersonInner
          personId={openPerson.id}
          personName={openPerson.name}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched}
          onUnmarkWatched={onUnmarkWatched}
          onToggleLiked={onToggleLiked}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setOpenPerson(null)}
        />
      )}

      {/* Genre/keyword detail (z-[98]) */}
      {openGenre && (
        <GenreInner
          id={openGenre.id}
          name={openGenre.name}
          type={openGenre.type}
          mediaType={openGenre.mediaType}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched}
          onUnmarkWatched={onUnmarkWatched}
          onToggleLiked={onToggleLiked}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setOpenGenre(null)}
        />
      )}

      {/* Inner film (ricorsione, z-[95] sovrapposto) */}
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched}
          onUnmarkWatched={onUnmarkWatched}
          onToggleLiked={onToggleLiked}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

// ── PersonInner — PersonDetailScreen a z-[98] dentro InnerMovieDetail ──────

import { PersonDetailScreen } from './PersonDetailScreen';
import { GenreMoviesScreen } from './GenreMoviesScreen';

function PersonInner(props: {
  personId: number; personName: string;
  watchedIds: Set<number>; watchlistIds: Set<number>; likedIds: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
}) {
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  return (
    <div className="fixed inset-0 z-[98]">
      <PersonDetailScreen
        personId={props.personId}
        personName={props.personName}
        watchedIds={props.watchedIds}
        onBack={props.onBack}
        onOpenMovie={(id, mt) => setInnerMovie({ id, mediaType: mt })}
      />
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={props.watchedIds}
          watchlistIds={props.watchlistIds}
          likedIds={props.likedIds}
          getPersonalRating={props.getPersonalRating}
          onMarkWatched={props.onMarkWatched}
          onUnmarkWatched={props.onUnmarkWatched}
          onToggleLiked={props.onToggleLiked}
          onAddToWatchlist={props.onAddToWatchlist}
          onRemoveFromWatchlist={props.onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

function GenreInner(props: {
  id: number; name: string; type: 'genre' | 'keyword'; mediaType: 'movie' | 'tv';
  watchedIds: Set<number>; watchlistIds: Set<number>; likedIds: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
}) {
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  return (
    <div className="fixed inset-0 z-[98]">
      <GenreMoviesScreen
        id={props.id}
        name={props.name}
        type={props.type}
        mediaType={props.mediaType}
        watchedIds={props.watchedIds}
        watchlistIds={props.watchlistIds}
        likedIds={props.likedIds}
        getPersonalRating={props.getPersonalRating}
        onMarkWatched={props.onMarkWatched}
        onUnmarkWatched={props.onUnmarkWatched}
        onToggleLiked={props.onToggleLiked}
        onAddToWatchlist={props.onAddToWatchlist}
        onRemoveFromWatchlist={props.onRemoveFromWatchlist}
        onBack={props.onBack}
        onOpenMovie={(id, mt) => setInnerMovie({ id, mediaType: mt })}
      />
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={props.watchedIds}
          watchlistIds={props.watchlistIds}
          likedIds={props.likedIds}
          getPersonalRating={props.getPersonalRating}
          onMarkWatched={props.onMarkWatched}
          onUnmarkWatched={props.onUnmarkWatched}
          onToggleLiked={props.onToggleLiked}
          onAddToWatchlist={props.onAddToWatchlist}
          onRemoveFromWatchlist={props.onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}
