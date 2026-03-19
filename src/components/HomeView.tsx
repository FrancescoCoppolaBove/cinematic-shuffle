import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Tv, Film, BookmarkCheck, Eye } from 'lucide-react';
import type { TrendingItem, TMDBMovieDetail } from '../types';
import { getTrending, getMovieDetail, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';
import { MovieCard } from './MovieCard';

interface HomeViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
}

type Tab = 'movies' | 'tv';

export function HomeView({
  watchedIds, watchlistIds,
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onAddToWatchlist, onRemoveFromWatchlist,
}: HomeViewProps) {
  const [tab, setTab] = useState<Tab>('movies');
  const [trendingMovies, setTrendingMovies] = useState<TrendingItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<TrendingItem[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingTV, setLoadingTV] = useState(true);
  const [selectedItem, setSelectedItem] = useState<TMDBMovieDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    getTrending('movie').then(r => { setTrendingMovies(r); setLoadingMovies(false); });
    getTrending('tv').then(r => { setTrendingTV(r); setLoadingTV(false); });
  }, []);

  const handleSelect = useCallback(async (item: TrendingItem) => {
    setLoadingDetail(true);
    try {
      const detail = await getMovieDetail(item.id, item.media_type);
      setSelectedItem(detail);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  if (selectedItem) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedItem(null)}
          className="flex items-center gap-2 text-film-muted hover:text-film-text text-sm transition-colors">
          ← Torna alla home
        </button>
        <MovieCard
          movie={selectedItem}
          isWatched={watchedIds.has(selectedItem.id)}
          isOnWatchlist={watchlistIds.has(selectedItem.id)}
          personalRating={getPersonalRating(selectedItem.id)}
          onMarkWatched={r => onMarkWatched(selectedItem, r)}
          onUnmarkWatched={() => onUnmarkWatched(selectedItem.id)}
          onUpdateRating={r => onUpdateRating(selectedItem.id, r)}
          onAddToWatchlist={() => onAddToWatchlist(selectedItem)}
          onRemoveFromWatchlist={() => onRemoveFromWatchlist(selectedItem.id)}
          onShuffle={() => setSelectedItem(null)}
        />
      </div>
    );
  }

  const items = tab === 'movies' ? trendingMovies : trendingTV;
  const isLoading = tab === 'movies' ? loadingMovies : loadingTV;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-film-accent" />
          <h2 className="font-display text-2xl tracking-wider text-film-text">TRENDING</h2>
          <span className="text-film-subtle text-xs uppercase tracking-wider mt-1">questa settimana</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('movies')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
            tab === 'movies' ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface border-film-border text-film-muted hover:text-film-text')}>
          <Film size={14} />Film
        </button>
        <button onClick={() => setTab('tv')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
            tab === 'tv' ? 'bg-purple-500 text-white border-purple-500' : 'bg-film-surface border-film-border text-film-muted hover:text-film-text')}>
          <Tv size={14} />Serie TV
        </button>
      </div>

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Grid */}
      {!loadingDetail && (
        isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-film-surface animate-pulse border border-film-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {items.map((item, idx) => (
              <TrendingCard
                key={item.id}
                item={item}
                rank={idx + 1}
                isWatched={watchedIds.has(item.id)}
                isOnWatchlist={watchlistIds.has(item.id)}
                onClick={() => handleSelect(item)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function TrendingCard({
  item, rank, isWatched, isOnWatchlist, onClick,
}: {
  item: TrendingItem;
  rank: number;
  isWatched: boolean;
  isOnWatchlist: boolean;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w342') : null;
  const title = getTitle(item);

  return (
    <button onClick={onClick}
      className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border hover:border-film-accent/60 transition-all hover:scale-[1.03] active:scale-[0.98] bg-film-card">
      {/* Poster */}
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-3xl text-film-subtle">
            {item.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }

      {/* Rank badge */}
      <div className="absolute top-1.5 left-1.5 bg-film-black/80 backdrop-blur-sm text-film-accent font-display text-sm px-1.5 py-0.5 rounded-lg leading-none">
        #{rank}
      </div>

      {/* Status badges */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
        {isWatched && (
          <div className="bg-green-900/80 backdrop-blur-sm text-green-300 rounded-lg p-1" title="Già visto">
            <Eye size={10} />
          </div>
        )}
        {isOnWatchlist && !isWatched && (
          <div className="bg-purple-900/80 backdrop-blur-sm text-purple-300 rounded-lg p-1" title="In watchlist">
            <BookmarkCheck size={10} />
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-film-black via-film-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        <p className="text-film-text text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-film-muted text-xs">{formatYear(getReleaseDate(item))}</span>
          {item.vote_average > 0 && (
            <span className="text-film-accent text-xs">★ {formatRating(item.vote_average)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
