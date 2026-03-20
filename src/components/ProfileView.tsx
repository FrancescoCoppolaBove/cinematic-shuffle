/**
 * ProfileView — tre tab: Profilo, Visti, Watchlist
 * Le tab Visti e Watchlist montano i componenti originali completi.
 */
import { useState } from 'react';
import { LogOut, Star, Heart, RotateCcw, Film, Tv, Bookmark } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, WatchlistItem, TMDBMovieDetail } from '../types';
import type { PlaylistItem } from '../hooks/useNavigationStack';
import { cn } from '../utils';
import { WatchedView } from './WatchedView';
import { WatchlistView } from './WatchlistView';

interface ProfileViewProps {
  user: User;
  watchedMovies: WatchedMovie[];
  watchlist: WatchlistItem[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onMarkWatched: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched: (id: number) => Promise<void>;
  onToggleLiked: (id: number) => Promise<void>;
  onAddToWatchlist: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist: (id: number) => Promise<void>;
  onOpenMovieGlobal: (id: number, mt: 'movie' | 'tv', playlist?: PlaylistItem[], index?: number) => void;
  onSignOut: () => void;
}

type MainTab = 'profilo' | 'visti' | 'watchlist';

export function ProfileView({
  user, watchedMovies, watchlist,
  watchedIds, watchlistIds, likedIds,
  getPersonalRating, onUpdateRating, onMarkWatched, onUnmarkWatched,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenMovieGlobal, onSignOut,
}: ProfileViewProps) {
  const [tab, setTab] = useState<MainTab>('profilo');

  const films = watchedMovies.filter(m => m.media_type === 'movie');
  const series = watchedMovies.filter(m => m.media_type === 'tv');
  const liked = watchedMovies.filter(m => m.liked);
  const rated = watchedMovies.filter(m => m.personal_rating !== null);
  const rewatched = watchedMovies.filter(m => m.rewatchCount > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const TABS: { key: MainTab; label: string; count?: number }[] = [
    { key: 'profilo',   label: 'Profilo' },
    { key: 'visti',     label: 'Visti',     count: watchedMovies.length },
    { key: 'watchlist', label: 'Watchlist', count: watchlist.length },
  ];

  // Shared props for WatchedView/WatchlistView
  const sharedProps = {
    watchedIds, watchlistIds, watchedMovies,
    likedIds,
    getPersonalRating,
    onMarkWatched,
    onUnmarkWatched,
    onUpdateRating,
    onToggleLiked,
    onAddToWatchlist,
    onRemoveFromWatchlist,
    onOpenMovie: (id: number, mt: 'movie' | 'tv') => onOpenMovieGlobal(id, mt),
  };

  return (
    <div>
      {/* ── Top tab bar ── */}
      <div className="flex border-b border-film-border mb-0">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-all relative',
              tab === key ? 'text-film-accent' : 'text-film-muted'
            )}
          >
            {label}
            {count !== undefined && (
              <span className={cn('ml-1.5 text-xs', tab === key ? 'text-film-accent/70' : 'text-film-subtle')}>
                {count}
              </span>
            )}
            {tab === key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-film-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Profilo ── */}
      {tab === 'profilo' && (
        <div className="px-4 pt-5 pb-6 space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-film-accent/40 shrink-0">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-film-accent flex items-center justify-center text-film-black text-3xl font-display">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl text-film-text tracking-wide truncate">
                {user.displayName || 'Cinephile'}
              </h1>
              <p className="text-film-subtle text-sm truncate mt-0.5">{user.email}</p>
            </div>
            <button
              onClick={onSignOut}
              className="shrink-0 p-2.5 rounded-xl border border-film-border text-film-subtle active:text-film-red active:border-film-red/50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Stats grid 3×2 */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill icon={<Film size={14} />}    label="Film"     value={films.length}    color="text-film-accent" />
            <StatPill icon={<Tv size={14} />}      label="Serie"    value={series.length}   color="text-purple-400" />
            <StatPill icon={<Bookmark size={14} />} label="In lista" value={watchlist.length} color="text-blue-400" />
            <StatPill icon={<Heart size={14} />}   label="Preferiti" value={liked.length}   color="text-pink-400" />
            <StatPill
              icon={<Star size={14} />}
              label="Voto medio"
              value={avgRating ? `${avgRating}★` : '—'}
              color="text-film-accent"
            />
            <StatPill icon={<RotateCcw size={14} />} label="Rewatch" value={rewatched.length} color="text-orange-400" />
          </div>


        </div>
      )}

      {/* ── Tab: Visti — monta WatchedView completo ── */}
      {tab === 'visti' && (
        <div className="px-4 pt-4 pb-6">
          <WatchedView
            {...sharedProps}
            loading={false}
            onOpenMovieGlobal={(id, mt, playlist, index) =>
              onOpenMovieGlobal(id, mt, playlist, index)
            }
          />
        </div>
      )}

      {/* ── Tab: Watchlist — monta WatchlistView completo ── */}
      {tab === 'watchlist' && (
        <div className="px-4 pt-4 pb-6">
          <WatchlistView
            watchlist={watchlist}
            {...sharedProps}
            onOpenMovieGlobal={(id, mt, playlist, index) =>
              onOpenMovieGlobal(id, mt, playlist, index)
            }
          />
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode; label: string;
  value: number | string; color: string;
}) {
  return (
    <div className="bg-film-surface border border-film-border rounded-2xl px-3 py-3 flex flex-col items-center gap-1">
      <span className={color}>{icon}</span>
      <span className={cn('font-display text-xl font-bold', color)}>
        {value}
      </span>
      <span className="text-film-subtle text-xs text-center leading-tight">{label}</span>
    </div>
  );
}
