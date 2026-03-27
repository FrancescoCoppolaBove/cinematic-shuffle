/**
 * InnerMovieDetail — wrapper che usa MovieDetailScreen completa.
 *
 * Fetcha il film, poi monta MovieDetailScreen identica a quella principale.
 * Garantisce coerenza totale: stesse CTA, stessa grafica, stessi tab.
 * z-index 95 → sta sopra PersonDetailScreen (88) e GenreMoviesScreen (89).
 */
import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getMovieDetail } from '../services/tmdb';
import type { TMDBMovieDetail } from '../types';
import { MovieDetailScreen } from './MovieDetailScreen';
import { PersonDetailScreen } from './PersonDetailScreen';
import { GenreMoviesScreen } from './GenreMoviesScreen';

interface InnerMovieDetailProps {
  id: number;
  mediaType: 'movie' | 'tv';
  watchedIds: Set<number>;
  watchlistIds?: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  getRewatchCount?: (id: number) => number;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  tvStatus?: Map<number, 'following' | 'completed'>;
  onSetFollowing?: (seriesId: number) => Promise<void>;
  onSetCompleted?: (movie: TMDBMovieDetail, seasons: { season_number: number; episode_count: number }[]) => Promise<void>;
  onUnsetTVStatus?: (seriesId: number) => Promise<void>;
}

export function InnerMovieDetail({
  id, mediaType,
  watchedIds, watchlistIds = new Set(), likedIds = new Set(),
  getPersonalRating, getRewatchCount, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onIncrementRewatch,
  onAddToWatchlist, onRemoveFromWatchlist,
  onBack,
  tvStatus, onSetFollowing, onSetCompleted, onUnsetTVStatus,
}: InnerMovieDetailProps) {
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Per aprire un altro film dai "simili" dentro questo overlay
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);

  useEffect(() => {
    setLoading(true);
    setMovie(null);
    setInnerMovie(null);
    getMovieDetail(id, mediaType)
      .then(setMovie)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  // ALL hooks must be before any conditional return (Rules of Hooks)
  // localRewatchCount: initializes to 0, updated when movie loads via useEffect
  const [localRewatchCount, setLocalRewatchCount] = useState(0);

  // Sync localRewatchCount when movie changes
  useEffect(() => {
    if (movie) setLocalRewatchCount(getRewatchCount?.(movie.id) ?? 0);
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIncrementRewatch = useCallback(async (movieId: number, delta: number) => {
    setLocalRewatchCount(prev => Math.max(0, prev + delta));
    await onIncrementRewatch?.(movieId, delta);
  }, [onIncrementRewatch]);

  if (loading || !movie) {
    return (
      <div
        className="fixed left-0 right-0 z-[95] bg-film-black flex flex-col"
        style={{ top: 0, bottom: 'var(--nav-h, 60px)' }}
      >
        <div
          className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={onBack} className="active:opacity-60">
              <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
                <ChevronLeft size={18} className="text-film-text" />
              </div>
            </button>
            <div className="w-32 h-5 bg-film-surface rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const isWatched = watchedIds.has(movie.id);
  const isOnWatchlist = watchlistIds.has(movie.id);
  const isLiked = likedIds.has(movie.id);
  const personalRating = getPersonalRating?.(movie.id) ?? null;

  return (
    <div className="fixed left-0 right-0 z-[95]" style={{ top: 0, bottom: 'var(--nav-h, 60px)' }}>
      <MovieDetailScreen
        movie={movie}
        isWatched={isWatched}
        isOnWatchlist={isOnWatchlist}
        personalRating={personalRating}
        isLiked={isLiked}
        rewatchCount={localRewatchCount}
        backLabel="Indietro"
        onBack={onBack}
        onMarkWatched={(rating) => onMarkWatched?.(movie, rating) ?? Promise.resolve()}
        onUnmarkWatched={() => onUnmarkWatched?.(movie.id) ?? Promise.resolve()}
        onUpdateRating={(r) => onUpdateRating?.(movie.id, r) ?? Promise.resolve()}
        onToggleLiked={onToggleLiked}
        onIncrementRewatch={handleIncrementRewatch}
        onAddToWatchlist={() => onAddToWatchlist?.(movie) ?? Promise.resolve()}
        onRemoveFromWatchlist={() => onRemoveFromWatchlist?.(movie.id) ?? Promise.resolve()}
        tvSeriesStatus={movie.media_type === 'tv' ? (tvStatus?.get(movie.id) ?? null) : undefined}
        onSetFollowing={movie.media_type === 'tv' && onSetFollowing ? () => onSetFollowing(movie.id) : undefined}
        onSetCompleted={movie.media_type === 'tv' && onSetCompleted ? () => onSetCompleted(movie, movie.seasons ?? []) : undefined}
        onUnsetTVStatus={movie.media_type === 'tv' && onUnsetTVStatus ? () => onUnsetTVStatus(movie.id) : undefined}
        onOpenMovie={(mid, mt) => setInnerMovie({ id: mid, mediaType: mt })}
        // Passa tutti i propWatchedIds per i tab Cast/Crew/Generi
        watchedIds={watchedIds}
        watchlistIds={watchlistIds}
        likedIds={likedIds}
        getPersonalRatingFull={getPersonalRating}
        onMarkWatchedFull={onMarkWatched}
        onUnmarkWatchedFull={onUnmarkWatched}
        onUpdateRatingFull={onUpdateRating}
        onToggleLikedFull={onToggleLiked}
        onAddToWatchlistFull={onAddToWatchlist}
        onRemoveFromWatchlistFull={onRemoveFromWatchlist}
        loading={false}
      />

      {/* Film aperto dai simili — ricorsione a z-[95] sovrapposto */}
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          getRewatchCount={getRewatchCount}
          onMarkWatched={onMarkWatched}
          onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating}
          onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

// ── PersonInner + GenreInner: apre InnerMovieDetail dai click interni ──────────
// Questi wrapper servono a PersonDetailScreen e GenreMoviesScreen
// per aprire film mantenendo i props CTA corretti

export function PersonInner(props: {
  personId: number; personName: string;
  watchedIds: Set<number>; watchlistIds?: Set<number>; likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  getRewatchCount?: (id: number) => number;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  tvStatus?: Map<number, 'following' | 'completed'>;
  onSetFollowing?: (seriesId: number) => Promise<void>;
  onSetCompleted?: (movie: TMDBMovieDetail, seasons: { season_number: number; episode_count: number }[]) => Promise<void>;
  onUnsetTVStatus?: (seriesId: number) => Promise<void>;
}) {
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  return (
    <div className="fixed left-0 right-0 z-[98]" style={{ top: 0, bottom: 'var(--nav-h, 60px)' }}>
      <PersonDetailScreen
        personId={props.personId}
        personName={props.personName}
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
          getRewatchCount={props.getRewatchCount}
          onMarkWatched={props.onMarkWatched}
          onUnmarkWatched={props.onUnmarkWatched}
          onUpdateRating={props.onUpdateRating}
          onToggleLiked={props.onToggleLiked}
          onIncrementRewatch={props.onIncrementRewatch}
          onAddToWatchlist={props.onAddToWatchlist}
          onRemoveFromWatchlist={props.onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

export function GenreInner(props: {
  id: number; name: string; type: 'genre' | 'keyword'; mediaType: 'movie' | 'tv';
  watchedIds: Set<number>; watchlistIds?: Set<number>; likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  getRewatchCount?: (id: number) => number;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  tvStatus?: Map<number, 'following' | 'completed'>;
  onSetFollowing?: (seriesId: number) => Promise<void>;
  onSetCompleted?: (movie: TMDBMovieDetail, seasons: { season_number: number; episode_count: number }[]) => Promise<void>;
  onUnsetTVStatus?: (seriesId: number) => Promise<void>;
}) {
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  return (
    <div className="fixed left-0 right-0 z-[98]" style={{ top: 0, bottom: 'var(--nav-h, 60px)' }}>
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
        onUpdateRating={props.onUpdateRating}
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
          getRewatchCount={props.getRewatchCount}
          onMarkWatched={props.onMarkWatched}
          onUnmarkWatched={props.onUnmarkWatched}
          onUpdateRating={props.onUpdateRating}
          onToggleLiked={props.onToggleLiked}
          onIncrementRewatch={props.onIncrementRewatch}
          onAddToWatchlist={props.onAddToWatchlist}
          onRemoveFromWatchlist={props.onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}
