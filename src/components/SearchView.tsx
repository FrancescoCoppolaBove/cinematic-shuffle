import { useState, useRef } from 'react';
import { Search, X, Star } from 'lucide-react';
import type { TMDBMovieDetail, SearchResult } from '../types';
import { searchContent, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating } from '../utils';

interface SearchViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenMovieGlobal?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function SearchView({
  watchedIds, watchlistIds,
  onOpenMovieGlobal,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
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

  function handleSelect(result: SearchResult) {
    // Always open fullscreen via global navigation stack
    onOpenMovieGlobal?.(result.id, result.media_type);
    setResults([]);
    setQuery('');
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-film-surface border border-film-border rounded-2xl px-4 py-3.5 focus-within:border-film-accent transition-colors">
          {loading
            ? <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin shrink-0" />
            : <Search size={18} className="text-film-muted shrink-0" />}
          <input
            type="text"
            placeholder="Cerca film, serie TV..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle text-base focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="text-film-muted active:opacity-60">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-film-card border border-film-border rounded-2xl overflow-hidden z-20 shadow-2xl max-h-[60vh] overflow-y-auto">
            {results.map(r => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-4 px-4 py-3 active:bg-film-surface transition-colors text-left border-b border-film-border last:border-0"
              >
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-film-border shrink-0">
                  {r.poster_path
                    ? <img src={getImageUrl(r.poster_path, 'w92') || ''} alt={getTitle(r)} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs">{r.media_type === 'tv' ? '📺' : '🎬'}</div>
                  }
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
                <div className="text-film-muted shrink-0">
                  <Star size={14} className="opacity-40" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-film-red/10 border border-film-red/30 rounded-xl px-4 py-3 text-film-red text-sm">{error}</div>
      )}

      {/* Empty state */}
      {!query && results.length === 0 && (
        <div className="text-center py-16 text-film-muted">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Cerca film o serie TV</p>
          <p className="text-xs mt-1 text-film-subtle">Tocca un risultato per aprire la scheda completa</p>
        </div>
      )}
    </div>
  );
}
