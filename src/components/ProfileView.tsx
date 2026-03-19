import { useState } from 'react';
import { LogOut, Eye, Bookmark, Star, Tv } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, WatchlistItem } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';
import { StarRating } from './StarRating';

interface ProfileViewProps {
  user: User;
  watchedMovies: WatchedMovie[];
  watchlist: WatchlistItem[];
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  onSignOut: () => void;
}

type Section = 'watched' | 'watchlist' | 'rated';

export function ProfileView({ user, watchedMovies, watchlist, onUpdateRating, onSignOut }: ProfileViewProps) {
  const [section, setSection] = useState<Section>('watched');

  const ratedMovies = watchedMovies.filter(m => m.personal_rating !== null);
  const watchedFilms = watchedMovies.filter(m => m.media_type === 'movie');
  const watchedTV = watchedMovies.filter(m => m.media_type === 'tv');
  const avgRating = ratedMovies.length > 0
    ? (ratedMovies.reduce((s, m) => s + (m.personal_rating ?? 0), 0) / ratedMovies.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="bg-film-surface border border-film-border rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-film-border">
              {user.photoURL
                ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-film-accent flex items-center justify-center text-film-black text-2xl font-display">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
              }
            </div>
            <div>
              <h2 className="font-display text-2xl text-film-text tracking-wide">{user.displayName || 'Utente'}</h2>
              <p className="text-film-muted text-sm">{user.email}</p>
            </div>
          </div>
          <button onClick={onSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-film-border text-film-subtle hover:text-film-red hover:border-film-red/50 text-xs transition-all">
            <LogOut size={13} />Esci
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <StatCard icon={<Eye size={16} />} label="Film visti" value={watchedFilms.length} color="text-film-accent" />
          <StatCard icon={<Tv size={16} />} label="Serie viste" value={watchedTV.length} color="text-purple-400" />
          <StatCard icon={<Bookmark size={16} />} label="Watchlist" value={watchlist.length} color="text-blue-400" />
          <StatCard
            icon={<Star size={16} />}
            label="Voto medio"
            value={avgRating ? `${avgRating}★` : '—'}
            color="text-film-accent"
          />
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {([
          { key: 'watched', label: 'Visti', count: watchedMovies.length, icon: Eye },
          { key: 'watchlist', label: 'Watchlist', count: watchlist.length, icon: Bookmark },
          { key: 'rated', label: 'Votati', count: ratedMovies.length, icon: Star },
        ] as { key: Section; label: string; count: number; icon: typeof Eye }[]).map(({ key, label, count, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border flex-1 justify-center',
              section === key ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface border-film-border text-film-muted hover:text-film-text')}>
            <Icon size={13} />{label}
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
              section === key ? 'bg-film-black/20' : 'bg-film-card')}>{count}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      {section === 'watched' && (
        <WatchedList movies={watchedMovies} />
      )}
      {section === 'watchlist' && (
        <WatchlistList items={watchlist} />
      )}
      {section === 'rated' && (
        <RatedList movies={ratedMovies} onUpdateRating={onUpdateRating} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-film-card border border-film-border rounded-xl p-3 text-center">
      <div className={cn('flex justify-center mb-1', color)}>{icon}</div>
      <div className="font-display text-2xl text-film-text">{value}</div>
      <div className="text-film-subtle text-xs mt-0.5">{label}</div>
    </div>
  );
}

function WatchedList({ movies }: { movies: WatchedMovie[] }) {
  if (movies.length === 0) return <EmptyState icon={<Eye size={32} />} message="Nessun film o serie vista" />;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {movies.map(m => <PosterCard key={m.id} item={m} />)}
    </div>
  );
}

function WatchlistList({ items }: { items: WatchlistItem[] }) {
  if (items.length === 0) return <EmptyState icon={<Bookmark size={32} />} message="Watchlist vuota" />;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {items.map(m => <PosterCard key={m.id} item={m} />)}
    </div>
  );
}

function RatedList({ movies, onUpdateRating }: { movies: WatchedMovie[]; onUpdateRating: (id: number, r: number | null) => Promise<void> }) {
  if (movies.length === 0) return <EmptyState icon={<Star size={32} />} message="Non hai ancora votato nessun film" />;
  return (
    <div className="space-y-2">
      {[...movies].sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0)).map(m => (
        <div key={m.id} className="flex items-center gap-3 bg-film-surface border border-film-border rounded-xl p-3">
          <div className="w-9 h-12 rounded-lg overflow-hidden bg-film-card border border-film-border shrink-0">
            {m.poster_path
              ? <img src={getImageUrl(m.poster_path, 'w92') || ''} alt={m.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-film-subtle text-sm">🎬</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-film-text text-sm font-medium truncate">{m.title}</p>
            <p className="text-film-muted text-xs">{formatYear(m.release_date)}</p>
            <div className="mt-1" onClick={e => e.stopPropagation()}>
              <StarRating value={m.personal_rating} onChange={r => onUpdateRating(m.id, r)} size="sm" />
            </div>
          </div>
          <span className="font-display text-xl text-film-accent">{m.personal_rating}★</span>
        </div>
      ))}
    </div>
  );
}

function PosterCard({ item }: { item: WatchedMovie | WatchlistItem }) {
  const [err, setErr] = useState(false);
  const poster = !err ? getImageUrl(item.poster_path, 'w185') : null;
  const title = getTitle(item);
  return (
    <div className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card">
      {poster
        ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-2xl text-film-subtle">
            {item.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-film-text text-xs line-clamp-2">{title}</p>
        <p className="text-film-muted text-xs">{formatYear(getReleaseDate(item))}</p>
        {'personal_rating' in item && item.personal_rating && (
          <p className="text-film-accent text-xs">{item.personal_rating}★</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-16 text-film-muted space-y-3">
      <div className="flex justify-center opacity-20">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
