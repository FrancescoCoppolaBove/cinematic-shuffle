/**
 * GenreMoviesScreen — lista film/serie per genere o keyword.
 * Con filtri e modalità Card.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, LayoutGrid, Rows3, SlidersHorizontal, X } from 'lucide-react';
import { InnerMovieDetail } from './InnerMovieDetail';
import type { TMDBMovieBasic, TMDBMovieDetail } from '../types';
import { discoverByGenre, discoverByKeyword, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { CardView } from './CardView';

type ViewMode = 'grid' | 'card';

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

type SortBy = 'rating' | 'year_desc' | 'year_asc';

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [innerMovie, setInnerMovie] = useState<{id: number; mediaType: 'movie'|'tv'} | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carica pagina iniziale + pagina 2 subito per avere ~40 film
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
        const existingIds = new Set(prev.map(m => m.id));
        return [...prev, ...res.items.filter(m => !existingIds.has(m.id))];
      });
      setPage(nextPage);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [id, type, mediaType, page, totalPages, loadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore();
  }, [loadMore]);

  const filtered = useMemo(() => {
    let list = [...movies];
    if (minRating > 0) list = list.filter(m => m.vote_average >= minRating);
    if (onlyUnseen) list = list.filter(m => !watchedIds.has(m.id));
    switch (sortBy) {
      case 'year_desc': list.sort((a, b) => (b.release_date || b.first_air_date || '').localeCompare(a.release_date || a.first_air_date || '')); break;
      case 'year_asc': list.sort((a, b) => (a.release_date || a.first_air_date || '').localeCompare(b.release_date || b.first_air_date || '')); break;
      default: list.sort((a, b) => b.vote_average - a.vote_average);
    }
    return list;
  }, [movies, sortBy, minRating, onlyUnseen, watchedIds]);

  const watchedCount = movies.filter(m => watchedIds.has(m.id)).length;
  const activeFilters = [minRating > 0, onlyUnseen].filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[89] bg-film-black flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
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

          {/* View mode toggle */}
          <div className="flex bg-film-surface border border-film-border rounded-xl overflow-hidden">
            <button onClick={() => setViewMode('grid')}
              className={cn('p-2', viewMode === 'grid' ? 'bg-film-accent text-film-black' : 'text-film-muted')}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('card')}
              className={cn('p-2', viewMode === 'card' ? 'bg-film-accent text-film-black' : 'text-film-muted')}>
              <Rows3 size={14} />
            </button>
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('p-2 rounded-xl border transition-all',
              showFilters || activeFilters > 0
                ? 'bg-film-accent/10 border-film-accent text-film-accent'
                : 'bg-film-surface border-film-border text-film-muted'
            )}
          >
            {showFilters ? <X size={16} /> : <SlidersHorizontal size={16} />}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-4 pb-3 space-y-3 border-t border-film-border/50 pt-3 animate-slide-up">
            {/* Sort */}
            <div>
              <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">Ordina per</p>
              <div className="flex gap-2">
                {([['rating', 'Voto'], ['year_desc', 'Anno ↓'], ['year_asc', 'Anno ↑']] as [SortBy, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setSortBy(v)}
                    className={cn('flex-1 py-1.5 rounded-xl text-xs border transition-all',
                      sortBy === v ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-card border-film-border text-film-muted')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Min rating */}
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-film-subtle text-xs uppercase tracking-wider">Voto minimo IMDB</p>
                <span className={cn('text-xs font-mono', minRating > 0 ? 'text-film-accent' : 'text-film-subtle')}>
                  {minRating > 0 ? `≥ ${minRating.toFixed(1)}` : 'Qualsiasi'}
                </span>
              </div>
              <input type="range" min={0} max={9} step={0.5} value={minRating}
                onChange={e => setMinRating(parseFloat(e.target.value))}
                className="w-full accent-film-accent" />
            </div>

            {/* Only unseen */}
            <div className="flex items-center justify-between">
              <span className="text-film-text text-sm">Solo non visti</span>
              <button onClick={() => setOnlyUnseen(!onlyUnseen)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', onlyUnseen ? 'bg-film-accent' : 'bg-film-border')}>
                <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', onlyUnseen ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>

            {activeFilters > 0 && (
              <button onClick={() => { setMinRating(0); setOnlyUnseen(false); setSortBy('rating'); }}
                className="w-full py-1.5 text-film-red text-xs border border-film-red/30 rounded-xl">
                Reset filtri
              </button>
            )}
          </div>
        )}
      </div>

      {/* Counter */}
      <div className="shrink-0 px-4 py-2 flex items-center gap-2 border-b border-film-border/30">
        <span className="text-film-subtle text-xs">{filtered.length} risultati</span>
        {filtered.length < movies.length && (
          <span className="text-film-subtle text-xs">su {movies.length}</span>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-film-muted px-4">
            <p>Nessun risultato con questi filtri</p>
          </div>
        ) : viewMode === 'card' ? (
          <CardView
            items={filtered.map(m => ({ ...m, media_type: m.media_type ?? mediaType }))}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            likedIds={likedIds}
            getPersonalRating={getPersonalRating ?? (() => null)}
            onMarkWatched={onMarkWatched ?? (async () => {})}
            onUnmarkWatched={onUnmarkWatched ?? (async () => {})}
            onUpdateRating={onUpdateRating ?? (async () => {})}
            onToggleLiked={onToggleLiked}
            onAddToWatchlist={onAddToWatchlist ?? (async () => {})}
            onRemoveFromWatchlist={onRemoveFromWatchlist ?? (async () => {})}
            onOpenFull={(id, mt) => setInnerMovie({ id, mediaType: mt })}
            onClose={() => setViewMode('grid')}
          />
        ) : (
          <div className="grid grid-cols-3 gap-2.5 p-4">
            {filtered.map(m => {
              const mt = (m.media_type ?? mediaType) as 'movie' | 'tv';
              return (
                <button key={m.id} onClick={() => setInnerMovie({ id: m.id, mediaType: mt })}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform text-left">
                  {m.poster_path ? (
                    <img src={getImageUrl(m.poster_path, 'w342') || ''} alt={getTitle(m)} className={`w-full h-full object-cover ${watchedIds.has(m.id) ? 'opacity-40 grayscale' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
                      {mt === 'tv' ? '📺' : '🎬'}
                    </div>
                  )}
                  {watchedIds.has(m.id) && (
                    <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">✓</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-6 pb-1.5 pointer-events-none">
                    <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{getTitle(m)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-white/50 text-xs">{formatYear(getReleaseDate(m))}</span>
                      {m.vote_average > 0 && <span className="text-film-accent text-xs">★ {formatRating(m.vote_average)}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Inner movie detail */}
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={watchedIds}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}
