/**
 * BrowseListScreen — lista universale di film/serie con:
 * - Infinite scroll (50 item iniziali, poi 20 per batch)
 * - Filtri completi (tutti quelli di FilterPanel)
 * - View grid / card
 * - Watched overlay
 * - Usata da Browse By, Genre, Keyword, Provider, Anno, Country, Language...
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ListFilterBar, DEFAULT_API_FILTERS, DEFAULT_CLIENT_FILTERS } from './ListFilterBar';
import type { ApiFilters, ClientFilters } from './ListFilterBar';
import type { TMDBMovieBasic, TMDBMovieDetail } from '../types';
import {
  getImageUrl, getEnglishTitle, getReleaseDate,
  browseDiscover, discoverByGenre, discoverByKeyword,
} from '../services/tmdb';
import type { BrowseFilters, DiscoverPageResult } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { InnerMovieDetail } from './InnerMovieDetail';

export type BrowseSource =
  | { type: 'browse'; filters: BrowseFilters; title: string }
  | { type: 'genre'; id: number; mediaType: 'movie' | 'tv'; title: string }
  | { type: 'keyword'; id: number; mediaType: 'movie' | 'tv'; title: string }
  | { type: 'provider'; id: number; name: string; logoPath: string | null }
  | { type: 'year'; year: number; mediaType?: 'movie' | 'tv' }
  | { type: 'upcoming' }
  | { type: 'top500' }
  | { type: 'anticipated' }
  | { type: 'hidden_gems' }
  | { type: 'classics' }
  | { type: 'similar'; movieId: number; movieTitle: string; mediaType: 'movie' | 'tv' };

interface BrowseListScreenProps {
  source: BrowseSource;
  watchedIds: Set<number>;
  watchlistIds?: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  zIndex?: number;
  onCardQuickView?: (movie: TMDBMovieBasic, mediaType: 'movie' | 'tv') => void;
}

function getSourceTitle(source: BrowseSource): string {
  switch (source.type) {
    case 'browse': return source.title;
    case 'genre': return source.title;
    case 'keyword': return source.title;
    case 'provider': return source.name;
    case 'year': return String(source.year);
    case 'upcoming': return 'Upcoming';
    case 'top500': return 'Top 500 Films';
    case 'anticipated': return 'Most Anticipated';
    case 'hidden_gems': return 'Hidden Gems';
    case 'classics': return 'Great Classics';
    case 'similar': return `Films like "${source.movieTitle}"`;
  }
}

async function fetchPage(source: BrowseSource, page: number): Promise<DiscoverPageResult> {
  switch (source.type) {
    case 'genre':
      return discoverByGenre(source.id, source.mediaType, page);
    case 'keyword':
      return discoverByKeyword(source.id, source.mediaType, page);
    case 'browse':
      return browseDiscover(source.filters, page);
    case 'provider':
      return browseDiscover({ withProviders: [source.id], sortBy: 'popularity.desc' }, page);
    case 'year':
      return browseDiscover({
        mediaType: source.mediaType,
        year: source.year,
        sortBy: 'popularity.desc',
        minVoteCount: 20,
      }, page);
    case 'upcoming': {
      const { getUpcoming } = await import('../services/tmdb');
      return getUpcoming(page);
    }
    case 'top500': {
      const { getTop500 } = await import('../services/tmdb');
      return getTop500(page);
    }
    case 'anticipated': {
      const { getMostAnticipated } = await import('../services/tmdb');
      return getMostAnticipated(page);
    }
    case 'hidden_gems':
      return browseDiscover({
        sortBy: 'vote_average.desc',
        minVoteCount: 100,
        minRating: 7.5,
      }, page);
    case 'similar': {
      const { getMovieSimilarPaged } = await import('../services/tmdb');
      return getMovieSimilarPaged(source.movieId, source.mediaType, page);
    }
    case 'classics':
      return browseDiscover({
        sortBy: 'vote_average.desc',
        minVoteCount: 500,
        decade: '1970s',
      }, page);
  }
}

export function BrowseListScreen({
  source, watchedIds, watchlistIds = new Set(), likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onIncrementRewatch, onAddToWatchlist, onRemoveFromWatchlist,
  onCardQuickView,
  onBack, zIndex = 95,
}: BrowseListScreenProps) {
  const [movies, setMovies] = useState<TMDBMovieBasic[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'card'>('grid');
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const [apiFilters, setApiFilters] = useState<ApiFilters>(DEFAULT_API_FILTERS);
  const [clientFilters, setClientFilters] = useState<ClientFilters>(DEFAULT_CLIENT_FILTERS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const title = getSourceTitle(source);

  // Initial load: fetch first 3 pages (≈60 items) upfront
  useEffect(() => {
    setLoading(true);
    setMovies([]);
    setPage(3);

    const initial = async () => {
      try {
        const [p1, p2, p3] = await Promise.all([
          fetchPage(source, 1),
          fetchPage(source, 2).catch(() => ({ items: [], totalPages: 1, totalResults: 0 })),
          fetchPage(source, 3).catch(() => ({ items: [], totalPages: 1, totalResults: 0 })),
        ]);
        const combined = [...p1.items, ...p2.items, ...p3.items];
        const seen = new Set<number>();
        setMovies(combined.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }));
        setTotalPages(p1.totalPages);
        setTotalResults(p1.totalResults);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    initial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, (source as { id?: number }).id, (source as { year?: number }).year]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    if (loadingMore || nextPage > totalPages) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(source, nextPage);
      setMovies(prev => {
        const existing = new Set(prev.map(m => m.id));
        return [...prev, ...res.items.filter(m => !existing.has(m.id))];
      });
      setPage(nextPage);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, page, totalPages, loadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 500) loadMore();
  }, [loadMore, loadingMore]);

  const mediaType = (source as { mediaType?: 'movie' | 'tv' }).mediaType ?? 'movie';

  // Apply client-side filters
  const displayedMovies = movies.filter(m => {
    if (clientFilters.search) {
      const q = clientFilters.search.toLowerCase();
      if (!getEnglishTitle(m).toLowerCase().includes(q)) return false;
    }
    if (clientFilters.watchedStatus === 'watched' && !watchedIds.has(m.id)) return false;
    if (clientFilters.watchedStatus === 'unwatched' && watchedIds.has(m.id)) return false;
    if (clientFilters.likedStatus === 'liked' && !likedIds.has(m.id)) return false;
    if (clientFilters.likedStatus === 'not_liked' && likedIds.has(m.id)) return false;
    if (clientFilters.watchlistStatus === 'watchlist' && !watchlistIds.has(m.id)) return false;
    if (clientFilters.watchlistStatus === 'not_watchlist' && watchlistIds.has(m.id)) return false;
    if (clientFilters.ratedStatus === 'rated' && !getPersonalRating?.(m.id)) return false;
    if (clientFilters.ratedStatus === 'not_rated' && getPersonalRating?.(m.id)) return false;
    return true;
  });

  return (
    <div
      className="fixed left-0 right-0 bg-film-black flex flex-col"
      style={{ zIndex, top: 'var(--header-h, 52px)', bottom: 0, isolation: 'isolate' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-film-text font-semibold truncate">{title}</h2>
            {totalResults > 0 && !loading && (
              <p className="text-film-subtle text-xs">{movies.length.toLocaleString()} di {totalResults.toLocaleString()}</p>
            )}
          </div>
          <div className="w-9" />{/* spacer for centering */}
        </div>
      </div>

      {/* Filter bar */}
      <ListFilterBar
        apiFilters={apiFilters}
        clientFilters={clientFilters}
        onApiFiltersChange={setApiFilters}
        onClientFiltersChange={setClientFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={movies.length}
        filteredCount={displayedMovies.length}
      />

      {/* Content */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto scroll-container" style={{ paddingBottom: 'var(--nav-h, 60px)' }}>
        {loading ? (
          <div className="grid grid-cols-3 gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-film-muted">
            <p className="text-sm">Nessun film trovato</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {displayedMovies.map(m => (
                <PosterCard
                  key={m.id}
                  movie={m}
                  isWatched={watchedIds.has(m.id)}
                  onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type ?? mediaType })}
                />
              ))}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loadingMore && page < totalPages && (
              <div className="flex justify-center py-4">
                <button onClick={loadMore} className="text-film-accent text-sm active:opacity-60">Carica altri</button>
              </div>
            )}
          </div>
        ) : (
          // Card view — lista compatta con poster + info + tap per scheda
          <div className="divide-y divide-film-border/40">
            {displayedMovies.map(m => (
              <button key={m.id} onClick={() => onCardQuickView ? onCardQuickView(m, m.media_type ?? mediaType) : setInnerMovie({ id: m.id, mediaType: m.media_type ?? mediaType })}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 text-left">
                <div className="relative shrink-0 w-11 h-16 rounded-lg overflow-hidden bg-film-surface">
                  {m.poster_path
                    ? <img src={getImageUrl(m.poster_path, 'w92') || ''} alt={getEnglishTitle(m)}
                        className={cn("w-full h-full object-cover", watchedIds.has(m.id) && "opacity-40 grayscale")} />
                    : <div className="w-full h-full flex items-center justify-center text-base">{m.media_type === 'tv' ? '📺' : '🎬'}</div>}
                  {watchedIds.has(m.id) && <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-900/80 rounded-full flex items-center justify-center"><span className="text-green-300 text-[7px] font-bold">✓</span></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{getEnglishTitle(m)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-film-muted text-xs">{formatYear(getReleaseDate(m))}</span>
                    {m.vote_average > 0 && <><span className="text-film-border text-xs">·</span><span className="text-film-accent text-xs">★ {formatRating(m.vote_average)}</span></>}
                  </div>
                </div>
                <ChevronRight size={13} className="text-film-subtle/50 shrink-0" />
              </button>
            ))}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id} mediaType={innerMovie.mediaType}
          watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating} onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}

    </div>
  );
}

function PosterCard({ movie, isWatched, fadeWatched = true, onClick }: {
  movie: TMDBMovieBasic; isWatched: boolean; fadeWatched?: boolean; onClick: () => void; // eslint-disable-line
}) {
  const [err, setErr] = useState(false);
  const poster = !err ? getImageUrl(movie.poster_path, 'w342') : null;

  return (
    <button
      onClick={onClick}
      className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform"
    >
      {poster
        ? <img src={poster} alt={getEnglishTitle(movie)} className={cn("w-full h-full object-cover", isWatched && fadeWatched && "opacity-40 grayscale")} onError={() => setErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-xl text-film-subtle">{movie.media_type === 'tv' ? '📺' : '🎬'}</div>
      }
      {isWatched && (
        <div className="absolute top-1.5 right-1.5 bg-green-900/80 backdrop-blur-sm rounded-lg p-1">
          <span className="text-green-300 text-[8px] font-bold">✓</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-5 pb-1.5 pointer-events-none">
        <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{getEnglishTitle(movie)}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-white/50 text-xs">{formatYear(getReleaseDate(movie))}</span>
          {movie.vote_average > 0 && <span className="text-film-accent text-xs ml-auto">★ {formatRating(movie.vote_average)}</span>}
        </div>
      </div>
    </button>
  );
}
