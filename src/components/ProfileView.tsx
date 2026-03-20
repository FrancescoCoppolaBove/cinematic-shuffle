import { useState } from 'react';
import { LogOut, Bookmark, Star, Heart, RotateCcw, Film, Tv } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, WatchlistItem } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';

interface ProfileViewProps {
  user: User;
  watchedMovies: WatchedMovie[];
  watchlist: WatchlistItem[];
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onSignOut: () => void;
}

type Tab = 'visti' | 'watchlist' | 'preferiti';

export function ProfileView({ user, watchedMovies, watchlist, onSignOut }: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>('visti');

  const films = watchedMovies.filter(m => m.media_type === 'movie');
  const series = watchedMovies.filter(m => m.media_type === 'tv');
  const liked = watchedMovies.filter(m => m.liked);
  const rated = watchedMovies.filter(m => m.personal_rating !== null);
  const rewatched = watchedMovies.filter(m => m.rewatchCount > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const tabItems: { key: Tab; label: string; count: number }[] = [
    { key: 'visti', label: 'Visti', count: watchedMovies.length },
    { key: 'watchlist', label: 'Watchlist', count: watchlist.length },
    { key: 'preferiti', label: 'Preferiti', count: liked.length },
  ];

  const displayItems = tab === 'visti' ? watchedMovies
    : tab === 'watchlist' ? watchlist
    : liked;

  return (
    <div className="pb-6">
      {/* ── Hero profile section ── */}
      <div className="px-4 pt-6 pb-4">
        {/* Avatar + name row */}
        <div className="flex items-center gap-4 mb-5">
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

        {/* Stats grid — 2×3 */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill icon={<Film size={14} />} label="Film" value={films.length} color="text-film-accent" />
          <StatPill icon={<Tv size={14} />} label="Serie" value={series.length} color="text-purple-400" />
          <StatPill icon={<Bookmark size={14} />} label="Watchlist" value={watchlist.length} color="text-blue-400" />
          <StatPill icon={<Heart size={14} />} label="Preferiti" value={liked.length} color="text-pink-400" />
          <StatPill icon={<Star size={14} />} label="Voto medio" value={avgRating ? `${avgRating}★` : '—'} color="text-film-accent" />
          <StatPill icon={<RotateCcw size={14} />} label="Rewatch" value={rewatched.length} color="text-orange-400" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex px-4 gap-2 mb-4">
        {tabItems.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all border',
              tab === key
                ? 'bg-film-accent text-film-black border-film-accent'
                : 'bg-film-surface border-film-border text-film-muted'
            )}
          >
            {label}
            <span className={cn('ml-1.5 text-xs',
              tab === key ? 'text-film-black/70' : 'text-film-subtle')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {displayItems.length === 0 ? (
        <div className="text-center py-16 text-film-muted px-4">
          <div className="text-5xl opacity-20 mb-4">
            {tab === 'watchlist' ? '🔖' : tab === 'preferiti' ? '❤️' : '🎬'}
          </div>
          <p className="text-sm">
            {tab === 'watchlist' ? 'La tua watchlist è vuota'
              : tab === 'preferiti' ? 'Nessun film preferito ancora'
              : 'Nessun film o serie visti ancora'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-4">
          {displayItems.map(item => (
            <PosterCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode; label: string;
  value: number | string; color: string;
}) {
  return (
    <div className="bg-film-surface border border-film-border rounded-2xl px-3 py-3 flex flex-col items-center gap-1">
      <span className={color}>{icon}</span>
      <span className={cn('font-display text-xl font-bold', color)}>
        {typeof value === 'number' && value === 0 ? '0' : value}
      </span>
      <span className="text-film-subtle text-xs text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Poster card ─────────────────────────────────────────────────

function PosterCard({ item }: { item: WatchedMovie | WatchlistItem }) {
  const [err, setErr] = useState(false);
  const poster = !err ? getImageUrl(item.poster_path, 'w342') : null;
  const title = getTitle(item);
  const isWatched = 'personal_rating' in item;

  return (
    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card">
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
            {'media_type' in item && item.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }
      {/* Rating badge */}
      {isWatched && (item as WatchedMovie).personal_rating && (
        <div className="absolute top-1.5 left-1.5 bg-film-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded-lg">
          <span className="text-film-accent text-xs font-bold">
            {(item as WatchedMovie).personal_rating}★
          </span>
        </div>
      )}
      {/* Liked badge */}
      {isWatched && (item as WatchedMovie).liked && (
        <div className="absolute top-1.5 right-1.5 bg-film-black/80 backdrop-blur-sm w-6 h-6 rounded-lg flex items-center justify-center">
          <Heart size={11} className="text-pink-400" fill="currentColor" />
        </div>
      )}
      {/* Bottom gradient + title */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 via-film-black/40 to-transparent px-2 pt-8 pb-1.5 pointer-events-none">
        <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        <p className="text-white/50 text-xs">{formatYear(getReleaseDate(item))}</p>
      </div>
    </div>
  );
}
