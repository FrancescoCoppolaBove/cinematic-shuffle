import { useState, useRef } from 'react';
import { Search, X, Star } from 'lucide-react';
import type { TMDBMovieDetail, SearchResult, WatchedMovie } from '../types';
import { searchContent, getMovieDetail, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating } from '../utils';
import { MovieCard } from './MovieCard';

interface SearchViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  watchedMovies: WatchedMovie[];
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenMovieGlobal?: (id: number, mediaType: 'movie' | 'tv', playlist?: import('../hooks/useNavigationStack').PlaylistItem[], index?: number) => void;
}

export function SearchView({
  watchedIds, watchlistIds, getPersonalRating,
  onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
onOpenMovieGlobal,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovieDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchContent(q)); }
      catch { setError('Errore nella ricerca'); }
      finally { setLoading(false); }
    }, 400);
  }

  async function handleSelect(result: SearchResult) {
    setLoadingDetail(true);
    setResults([]); setQuery(''); setError(null);
    try { setSelectedMovie(await getMovieDetail(result.id, result.media_type)); }
    catch { setError('Impossibile caricare i dettagli'); }
    finally { setLoadingDetail(false); }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="flex items-center gap-3 bg-film-surface border border-film-border rounded-2xl px-4 py-3.5 focus-within:border-film-accent transition-colors">
          {loading
            ? <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin shrink-0" />
            : <Search size={18} className="text-film-muted shrink-0" />}
          <input type="text" placeholder="Cerca film, serie TV..." value={query}
            onChange={e => handleSearch(e.target.value)} autoFocus
            className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle text-base focus:outline-none" />
          {query && <button onClick={() => { setQuery(''); setResults([]); }} className="text-film-muted hover:text-film-text"><X size={16} /></button>}
        </div>

        {results.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-film-card border border-film-border rounded-2xl overflow-hidden z-20 shadow-2xl">
            {results.map(r => (
              <button key={r.id} onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-film-surface transition-colors text-left border-b border-film-border last:border-0">
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-film-border shrink-0">
                  {r.poster_path
                    ? <img src={getImageUrl(r.poster_path, 'w92') || ''} alt={r.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs">{r.media_type === 'tv' ? '📺' : '🎬'}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{getTitle(r)}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-film-subtle text-xs">{r.media_type === 'tv' ? 'Serie TV' : 'Film'}</span>
                    <span className="text-film-muted text-xs">{formatYear(getReleaseDate(r))}</span>
                    {r.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-film-accent text-xs">
                        <Star size={10} fill="currentColor" />{formatRating(r.vote_average)}
                      </span>
                    )}
                    {watchedIds.has(r.id) && <span className="text-xs text-green-400">✓ Visto</span>}
                    {watchlistIds.has(r.id) && !watchedIds.has(r.id) && <span className="text-xs text-purple-400">🔖 Watchlist</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="bg-film-red/10 border border-film-red/30 rounded-xl px-4 py-3 text-film-red text-sm">{error}</div>}

      {loadingDetail && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedMovie && !loadingDetail && (
        <div className="animate-slide-up">
          <MovieCard
            movie={selectedMovie}
            isWatched={watchedIds.has(selectedMovie.id)}
            isOnWatchlist={watchlistIds.has(selectedMovie.id)}
            personalRating={getPersonalRating(selectedMovie.id)}
            showShuffleBtn={false}
            onMarkWatched={r => onMarkWatched(selectedMovie, r)}
            onUnmarkWatched={() => onUnmarkWatched(selectedMovie.id)}
            onUpdateRating={r => onUpdateRating(selectedMovie.id, r)}
            onAddToWatchlist={() => onAddToWatchlist(selectedMovie)}
            onRemoveFromWatchlist={() => onRemoveFromWatchlist(selectedMovie.id)}
            onShuffle={() => { setSelectedMovie(null); setQuery(''); }}
            onOpenMovie={onOpenMovieGlobal}
          />
        </div>
      )}

      {!selectedMovie && !loadingDetail && !query && (
        <div className="text-center py-16 text-film-muted">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Cerca film o serie TV</p>
          <p className="text-xs mt-1 text-film-subtle">Aggiungili ai visti o alla watchlist</p>
        </div>
      )}
    </div>
  );
}
