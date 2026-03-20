/**
 * GenreMoviesScreen — lista film/serie per genere o keyword.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { TMDBMovieBasic } from '../types';
import { discoverByGenre, discoverByKeyword, getImageUrl, getTitle } from '../services/tmdb';
import { formatYear, formatRating } from '../utils';

interface GenreMoviesScreenProps {
  id: number;
  name: string;
  type: 'genre' | 'keyword';
  mediaType: 'movie' | 'tv';
  backLabel?: string;
  watchedIds: Set<number>;
  onBack: () => void;
  onOpenMovie: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function GenreMoviesScreen({
  id, name, type, mediaType, backLabel: _backLabel = 'Indietro',
  watchedIds, onBack, onOpenMovie,
}: GenreMoviesScreenProps) {
  const [movies, setMovies] = useState<TMDBMovieBasic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fn = type === 'genre' ? discoverByGenre : discoverByKeyword;
    fn(id, mediaType)
      .then(setMovies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, type, mediaType]);

  return (
    <div
      className="fixed inset-0 z-[89] bg-film-black overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-film-black/95 backdrop-blur-md border-b border-film-border"
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
            <p className="text-film-subtle text-xs capitalize">{type === 'genre' ? 'Genere' : 'Tema'} · {mediaType === 'tv' ? 'Serie TV' : 'Film'}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-16 text-film-muted">
          <p>Nessun risultato trovato</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 p-4">
          {movies.map(m => (
            <button
              key={m.id}
              onClick={() => onOpenMovie(m.id, m.media_type ?? mediaType)}
              className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform text-left"
            >
              {m.poster_path ? (
                <img
                  src={getImageUrl(m.poster_path, 'w342') || ''}
                  alt={getTitle(m)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
                  {m.media_type === 'tv' ? '📺' : '🎬'}
                </div>
              )}
              {/* Watched indicator */}
              {watchedIds.has(m.id) && (
                <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-4 h-4 flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">✓</span>
                </div>
              )}
              {/* Bottom gradient */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-6 pb-1.5 pointer-events-none">
                <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{getTitle(m)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-white/50 text-xs">{formatYear(m.release_date || m.first_air_date || '')}</span>
                  {m.vote_average > 0 && (
                    <span className="text-film-accent text-xs">★ {formatRating(m.vote_average)}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
