import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Tv, Film, ChevronRight, Eye as EyeIcon } from 'lucide-react';
import type { TrendingItem, TMDBMovieDetail } from '../types';
import {
  getTrending, getTrendingPage,
  getImageUrl, getTitle, getReleaseDate,
} from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { GridControls, DEFAULT_GRID_FILTERS } from './GridControls';
import type { GridFilters, ViewMode } from './GridControls';
import { CardView } from './CardView';
import { useMemo } from 'react';

interface HomeViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenMovieGlobal: (id: number, mediaType: 'movie' | 'tv') => void;
}

type HomeSubView =
  | { kind: 'home' }
  | { kind: 'popular'; mediaType: 'movie' | 'tv' };

export function HomeView(props: HomeViewProps) {
  const [subView, setSubView] = useState<HomeSubView>({ kind: 'home' });

  const handleOpenMovie = useCallback((id: number, mediaType: 'movie' | 'tv') => {
    props.onOpenMovieGlobal(id, mediaType);
  }, [props]);

  if (subView.kind === 'popular') {
    return (
      <PopularFullPage
        mediaType={subView.mediaType}
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
        onBack={() => setSubView({ kind: 'home' })}
        onSelect={(item, playlist, idx) => (props.onOpenMovieGlobal as Function)(item.id, item.media_type, playlist?.map((i: TrendingItem) => ({ id: i.id, mediaType: i.media_type, title: i.title, poster_path: i.poster_path })), idx)}
        onOpenMovieGlobal={props.onOpenMovieGlobal}
      />
    );
  }

  return (
    <HomeMainView
      {...props}
      onOpenMovie={handleOpenMovie}
      onOpenPopular={mt => setSubView({ kind: 'popular', mediaType: mt })}
    />
  );
}

// ── Home main ─────────────────────────────────────────────────────

function HomeMainView({
  watchedIds, watchlistIds, onOpenMovie, onOpenPopular,
}: HomeViewProps & {
  onOpenMovie: (id: number, mt: 'movie' | 'tv') => void;
  onOpenPopular: (mt: 'movie' | 'tv') => void;
}) {
  const [movies, setMovies] = useState<TrendingItem[]>([]);
  const [tv, setTv] = useState<TrendingItem[]>([]);
  const [loadingM, setLoadingM] = useState(true);
  const [loadingT, setLoadingT] = useState(true);

  useEffect(() => {
    getTrending('movie', 'week', 12).then(r => { setMovies(r); setLoadingM(false); });
    getTrending('tv', 'week', 12).then(r => { setTv(r); setLoadingT(false); });
  }, []);

  return (
    <div className="space-y-7">
      {/* Section: movies */}
      <TrendingSection
        title="Film popolari"
        subtitle="questa settimana"
        items={movies}
        loading={loadingM}
        watchedIds={watchedIds}
        watchlistIds={watchlistIds}
        onSelect={item => onOpenMovie(item.id, 'movie')}
        onSeeAll={() => onOpenPopular('movie')}
        accentColor="text-film-accent"
      />
      {/* Section: TV */}
      <TrendingSection
        title="Serie TV popolari"
        subtitle="questa settimana"
        items={tv}
        loading={loadingT}
        watchedIds={watchedIds}
        watchlistIds={watchlistIds}
        onSelect={item => onOpenMovie(item.id, 'tv')}
        onSeeAll={() => onOpenPopular('tv')}
        accentColor="text-purple-400"
        isTV
      />
    </div>
  );
}

function TrendingSection({
  title, subtitle, items, loading, watchedIds, watchlistIds,
  onSelect, onSeeAll, accentColor, isTV = false,
}: {
  title: string; subtitle: string;
  items: TrendingItem[]; loading: boolean;
  watchedIds: Set<number>; watchlistIds: Set<number>;
  onSelect: (item: TrendingItem) => void;
  onSeeAll: () => void;
  accentColor: string;
  isTV?: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isTV
            ? <Tv size={15} className={accentColor} />
            : <TrendingUp size={15} className={accentColor} />
          }
          <div>
            <span className="text-film-text font-medium text-sm">{title}</span>
            <span className="text-film-subtle text-xs ml-1.5">{subtitle}</span>
          </div>
        </div>
        <button onClick={onSeeAll}
          className="flex items-center gap-1 text-film-muted hover:text-film-accent text-xs transition-colors">
          Vedi tutti <ChevronRight size={13} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {items.slice(0, 6).map((item, idx) => (
            <TrendingPosterCard
              key={item.id}
              item={item}
              rank={idx + 1}
              isWatched={watchedIds.has(item.id)}
              isOnWatchlist={watchlistIds.has(item.id)}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Full popular page ─────────────────────────────────────────────

function PopularFullPage({
  mediaType, watchedIds, watchlistIds, likedIds,
  getPersonalRating, onMarkWatched, onUnmarkWatched,
  onUpdateRating, onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onBack, onSelect, onOpenMovieGlobal,
}: {
  mediaType: 'movie' | 'tv';
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onBack: () => void;
  onSelect: (item: TrendingItem, playlist: TrendingItem[], index: number) => void;
  onOpenMovieGlobal: (id: number, mediaType: 'movie' | 'tv') => void;
}) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<GridFilters>(DEFAULT_GRID_FILTERS);

  const filtered = useMemo(() => {
    let list = [...items];
    if (filters.search) list = list.filter(m => m.title.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.minRating > 0) list = list.filter(m => m.vote_average >= filters.minRating);
    switch (filters.sortBy) {
      case 'title': list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'tmdb_rating': list.sort((a, b) => b.vote_average - a.vote_average); break;
      default: break;
    }
    return list;
  }, [items, filters]);

  useEffect(() => {
    setLoading(true);
    getTrendingPage(mediaType, 1).then(({ items: i, totalPages: t }) => {
      setItems(i);
      setTotalPages(t);
      setPage(1);
      setLoading(false);
    });
  }, [mediaType]);

  async function loadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const next = page + 1;
    const { items: more } = await getTrendingPage(mediaType, next);
    setItems(prev => [...prev, ...more]);
    setPage(next);
    setLoadingMore(false);
  }

  const isMovie = mediaType === 'movie';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="text-film-muted hover:text-film-text text-sm transition-colors shrink-0">
          ←
        </button>
        <div className="flex items-center gap-2">
          {isMovie
            ? <Film size={16} className="text-film-accent" />
            : <Tv size={16} className="text-purple-400" />
          }
          <h2 className="font-display text-xl tracking-wider text-film-text">
            {isMovie ? 'FILM POPOLARI' : 'SERIE TV POPOLARI'}
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
          ))}
        </div>
      ) : (
        <>
          <GridControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={items.length}
            filteredCount={filtered.length}
          />

          {viewMode === 'card' ? (
            <CardView
              items={filtered}
              watchedIds={watchedIds}
              watchlistIds={watchlistIds}
              likedIds={likedIds}
              getPersonalRating={getPersonalRating}
              onMarkWatched={onMarkWatched}
              onUnmarkWatched={onUnmarkWatched}
              onUpdateRating={onUpdateRating}
              onToggleLiked={onToggleLiked}
              onAddToWatchlist={onAddToWatchlist}
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              onOpenFull={(id, mt) => onOpenMovieGlobal(id, mt)}
              onClose={() => setViewMode('grid')}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {filtered.map((item, idx) => (
                <TrendingPosterCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  rank={idx + 1}
                  isWatched={watchedIds.has(item.id)}
                  isOnWatchlist={watchlistIds.has(item.id)}
                  onClick={() => onSelect(item, filtered, idx)}
                />
              ))}
            </div>
          )}

          {page < totalPages && viewMode === 'grid' && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl border border-film-border text-film-muted hover:text-film-text hover:border-film-accent/50 text-sm transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
                  Caricamento...
                </span>
              ) : `Carica altri (${items.length} di ${totalPages * 20})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Poster card shared ────────────────────────────────────────────

export function TrendingPosterCard({
  item, rank, isWatched, isOnWatchlist, onClick,
}: {
  item: TrendingItem;
  rank?: number;
  isWatched: boolean;
  isOnWatchlist: boolean;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w342') : null;
  const title = getTitle(item);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative aspect-[2/3] rounded-xl overflow-hidden border transition-all active:scale-[0.97]',
        isWatched
          ? 'border-film-border opacity-50 grayscale'
          : 'border-film-border hover:border-film-accent/60',
        'bg-film-card'
      )}
    >
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover"
            onError={() => setImgErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
            {item.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }

      {/* Rank badge */}
      {rank && (
        <div className="absolute top-1.5 left-1.5 bg-film-black/80 backdrop-blur-sm text-film-accent font-display text-sm px-1.5 py-0.5 rounded-lg leading-none">
          #{rank}
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
        {isWatched && (
          <div className="bg-green-900/80 backdrop-blur-sm text-green-300 rounded-lg p-1">
            <EyeIcon size={10} />
          </div>
        )}
        {isOnWatchlist && !isWatched && (
          <div className="bg-purple-900/80 backdrop-blur-sm text-purple-300 rounded-lg p-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-film-black via-film-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-film-muted text-xs">{formatYear(getReleaseDate(item))}</span>
          {item.vote_average > 0 && (
            <span className="text-film-accent text-xs">★ {formatRating(item.vote_average)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
