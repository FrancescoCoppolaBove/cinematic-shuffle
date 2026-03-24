/**
 * GenreMoviesScreen — lista film/serie per genere o keyword.
 * Con ListFilterBar universale e infinite scroll.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, Star } from 'lucide-react';
import { InnerMovieDetail } from './InnerMovieDetail';
import { ListFilterBar, DEFAULT_CLIENT_FILTERS } from './ListFilterBar';
import type { ClientFilters } from './ListFilterBar';
import type { TMDBMovieBasic, TMDBMovieDetail } from '../types';
import { discoverByGenre, discoverByKeyword, getImageUrl, getEnglishTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';

interface GenreMoviesScreenProps {
  id: number;
  name: string;
  type: 'genre' | 'keyword';
  mediaType: 'movie' | 'tv';
  watchedIds: Set<number>;
  watchlistIds?: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function GenreMoviesScreen({
  id, name, type, mediaType,
  watchedIds, watchlistIds = new Set(), likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onBack, onOpenMovie: _onOpenMovie,
}: GenreMoviesScreenProps) {
  const [movies, setMovies] = useState<TMDBMovieBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(2);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'card'>('grid');
  const [innerMovie, setInnerMovie] = useState<{id: number; mediaType: 'movie'|'tv'} | null>(null);
  const [clientFilters, setClientFilters] = useState<ClientFilters>(DEFAULT_CLIENT_FILTERS);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load: 2 pages in parallel (~40 items)
  useEffect(() => {
    setLoading(true);
    setMovies([]);
    setPage(2);
    const fn = type === 'genre' ? discoverByGenre : discoverByKeyword;
    Promise.all([fn(id, mediaType, 1), fn(id, mediaType, 2)])
      .then(([r1, r2]) => {
        const combined = [...r1.items, ...r2.items];
        const seen = new Set<number>();
        setMovies(combined.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }));
        setTotalPages(r1.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, type, mediaType]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    if (loadingMore || nextPage > totalPages) return;
    setLoadingMore(true);
    try {
      const fn = type === 'genre' ? discoverByGenre : discoverByKeyword;
      const res = await fn(id, mediaType, nextPage);
      setMovies(prev => {
        const existing = new Set(prev.map(m => m.id));
        return [...prev, ...res.items.filter(m => !existing.has(m.id))];
      });
      setPage(nextPage);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [id, type, mediaType, page, totalPages, loadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore();
  }, [loadMore, loadingMore]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = [...movies];
    if (clientFilters.search) {
      const q = clientFilters.search.toLowerCase();
      list = list.filter(m => getEnglishTitle(m).toLowerCase().includes(q));
    }
    if (clientFilters.watchedStatus === 'watched') list = list.filter(m => watchedIds.has(m.id));
    if (clientFilters.watchedStatus === 'unwatched') list = list.filter(m => !watchedIds.has(m.id));
    if (clientFilters.likedStatus === 'liked') list = list.filter(m => likedIds.has(m.id));
    if (clientFilters.likedStatus === 'not_liked') list = list.filter(m => !likedIds.has(m.id));
    if (clientFilters.watchlistStatus === 'watchlist') list = list.filter(m => watchlistIds.has(m.id));
    if (clientFilters.watchlistStatus === 'not_watchlist') list = list.filter(m => !watchlistIds.has(m.id));
    return list;
  }, [movies, clientFilters, watchedIds, likedIds, watchlistIds]);

  const watchedCount = movies.filter(m => watchedIds.has(m.id)).length;

  return (
    <div
      className="fixed left-0 right-0 z-[89] bg-film-black flex flex-col"
      style={{ top: 'var(--header-h, 52px)', bottom: 'var(--nav-h, 60px)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-semibold truncate">{name}</p>
            <p className="text-film-subtle text-xs">
              {type === 'genre' ? 'Genere' : 'Tema'} · {mediaType === 'tv' ? 'Serie TV' : 'Film'}
              {watchedCount > 0 && (
                <span className="text-green-400 ml-1.5">· {watchedCount} visti</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Universal filter bar */}
      <ListFilterBar
        apiFilters={{ sortBy: 'popularity.desc', mediaType: mediaType === 'tv' ? 'tv' : 'movie', releaseStatus: 'any' }}
        clientFilters={clientFilters}
        onApiFiltersChange={() => { /* genre/keyword doesn't re-fetch on api filter change */ }}
        onClientFiltersChange={setClientFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={movies.length}
        filteredCount={filtered.length}
      />

      {/* Content */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-film-muted">
            <p className="text-sm">Nessun film trovato</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type ?? mediaType })}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform"
                >
                  {m.poster_path
                    ? <img
                        src={getImageUrl(m.poster_path, 'w342') || ''}
                        alt={getEnglishTitle(m)}
                        className={cn("w-full h-full object-cover",
                          watchedIds.has(m.id) && clientFilters.fadeWatched && "opacity-40 grayscale")}
                      />
                    : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
                        {mediaType === 'tv' ? '📺' : '🎬'}
                      </div>
                  }
                  {watchedIds.has(m.id) && (
                    <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-4 h-4 flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">✓</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-5 pb-1.5 pointer-events-none">
                    <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{getEnglishTitle(m)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-white/50 text-xs">{formatYear(getReleaseDate(m))}</span>
                      {m.vote_average > 0 && (
                        <span className="flex items-center gap-0.5 text-film-accent text-xs ml-auto">
                          <Star size={8} fill="currentColor" />{formatRating(m.vote_average)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loadingMore && page < totalPages && (
              <div className="flex justify-center py-4">
                <button onClick={loadMore} className="text-film-accent text-sm active:opacity-60">
                  Carica altri
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Card view — compact list rows */
          <div className="divide-y divide-film-border/40">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type ?? mediaType })}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 text-left"
              >
                <div className="relative shrink-0 w-11 h-16 rounded-lg overflow-hidden bg-film-surface">
                  {m.poster_path
                    ? <img
                        src={getImageUrl(m.poster_path, 'w92') || ''}
                        alt={getEnglishTitle(m)}
                        className={cn("w-full h-full object-cover",
                          watchedIds.has(m.id) && clientFilters.fadeWatched && "opacity-40 grayscale")}
                      />
                    : <div className="w-full h-full flex items-center justify-center text-base">{mediaType === 'tv' ? '📺' : '🎬'}</div>
                  }
                  {watchedIds.has(m.id) && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-900/80 rounded-full flex items-center justify-center">
                      <span className="text-green-300 text-[7px] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{getEnglishTitle(m)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-film-muted text-xs">{formatYear(getReleaseDate(m))}</span>
                    {m.vote_average > 0 && (
                      <><span className="text-film-border text-xs">·</span>
                      <span className="text-film-accent text-xs">★ {formatRating(m.vote_average)}</span></>
                    )}
                  </div>
                </div>
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

      {/* Inner movie detail */}
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
          onUpdateRating={onUpdateRating}
          onToggleLiked={onToggleLiked}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}
