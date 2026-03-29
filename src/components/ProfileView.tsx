/**
 * ProfileView — tre tab: Profilo, Visti, Watchlist
 * Le tab Visti e Watchlist montano i componenti originali completi.
 */
import { useState, useEffect } from 'react';
import { LogOut, Star, Heart, RotateCcw, Film, Tv, Bookmark, Check } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { WatchedMovie, WatchlistItem, TMDBMovieDetail } from '../types';
import type { PlaylistItem } from '../hooks/useNavigationStack';
import { cn } from '../utils';
import { WatchedView } from './WatchedView';
import { WatchlistView } from './WatchlistView';
import { UserProfileScreen } from './UserProfileScreen';
import { fetchFollowing, fetchFollowers, fetchUserPublicProfile, upsertUserPublicProfile } from '../services/firestore';
import type { UserPublicProfile } from '../services/firestore';

interface ProfileViewProps {
  user: User;
  watchedMovies: WatchedMovie[];
  watchlist: WatchlistItem[];
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds: Set<number>;
  getPersonalRating: (id: number) => number | null;
  onUpdateRating: (id: number, rating: number | null) => Promise<void>;
  favoriteProviderIds: number[];
  onUpdateProviders: (ids: number[]) => Promise<void>;
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
  favoriteProviderIds, onUpdateProviders,
  onToggleLiked, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenMovieGlobal, onSignOut,
}: ProfileViewProps) {
  const [tab, setTab] = useState<MainTab>('profilo');
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [followerUids, setFollowerUids] = useState<string[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<UserPublicProfile[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<UserPublicProfile[]>([]);
  const [openUserProfile, setOpenUserProfile] = useState<string | null>(null);
  const [openSocialPanel, setOpenSocialPanel] = useState<'following' | 'followers' | null>(null);

  useEffect(() => {
    // Ensure own public profile exists
    upsertUserPublicProfile(user.uid, {
      displayName: user.displayName ?? 'User',
      photoURL: user.photoURL ?? null,
      moviesWatchedCount: watchedMovies.length,
    }).catch(() => {});
    // Load following/followers
    fetchFollowing(user.uid).then(uids => {
      setFollowingUids(uids);
      Promise.all(uids.map(uid => fetchUserPublicProfile(uid)))
        .then(profiles => setFollowingProfiles(profiles.filter(Boolean) as UserPublicProfile[]));
    }).catch(() => {});
    fetchFollowers(user.uid).then(uids => {
      setFollowerUids(uids);
      Promise.all(uids.map(uid => fetchUserPublicProfile(uid)))
        .then(profiles => setFollowerProfiles(profiles.filter(Boolean) as UserPublicProfile[]));
    }).catch(() => {});
  }, [user.uid, watchedMovies.length]); // eslint-disable-line

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
    <div className="flex flex-col h-full">
      {/* ── Top tab bar ── */}
      <div className="flex border-b border-film-border mb-0">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 py-3.5 text-sm font-medium transition-all relative active:opacity-70',
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

      {/* Scrollable tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>

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

          {/* Provider selector */}
          <ProviderSelector
            selected={favoriteProviderIds}
            onChange={onUpdateProviders}
          />

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

          {/* Connessioni — following/followers inline */}
          <div className="border border-film-border rounded-2xl overflow-hidden">
            <div className="flex divide-x divide-film-border">
              <button
                onClick={() => setOpenSocialPanel('following')}
                className="flex-1 flex flex-col items-center py-3 active:bg-film-surface/60"
              >
                <span className="text-film-text font-bold text-lg">{followingUids.length}</span>
                <span className="text-film-subtle text-xs">Seguiti</span>
              </button>
              <button
                onClick={() => setOpenSocialPanel('followers')}
                className="flex-1 flex flex-col items-center py-3 active:bg-film-surface/60"
              >
                <span className="text-film-text font-bold text-lg">{followerUids.length}</span>
                <span className="text-film-subtle text-xs">Follower</span>
              </button>
            </div>
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
      {/* ── Social panel (following/followers) — bottom sheet ── */}
      {openSocialPanel && (
        <div className="absolute inset-0 z-20 flex flex-col bg-film-black/50 backdrop-blur-sm"
          onClick={() => setOpenSocialPanel(null)}>
          <div className="flex-1" />
          <div
            className="bg-film-black border-t border-film-border rounded-t-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-film-border shrink-0">
              <h3 className="text-film-text font-semibold">
                {openSocialPanel === 'following' ? `Seguiti (${followingUids.length})` : `Follower (${followerUids.length})`}
              </h3>
              <button onClick={() => setOpenSocialPanel(null)} className="text-film-subtle active:opacity-60">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
              {(openSocialPanel === 'following' ? followingProfiles : followerProfiles).length === 0 ? (
                <p className="text-film-muted text-sm text-center py-8">
                  {openSocialPanel === 'following' ? 'Non segui ancora nessuno' : 'Nessun follower ancora'}
                </p>
              ) : (openSocialPanel === 'following' ? followingProfiles : followerProfiles).map(p => (
                <UserRow key={p.uid} profile={p} onClick={() => { setOpenSocialPanel(null); setOpenUserProfile(p.uid); }} />
              ))}
            </div>
          </div>
        </div>
      )}

      </div>{/* end scroll wrapper */}

      {openUserProfile && (
        <UserProfileScreen
          targetUid={openUserProfile}
          currentUser={user as import('firebase/auth').User}
          onBack={() => setOpenUserProfile(null)}
          onOpenMovie={() => {}}
          onOpenReview={() => {}}
        />
      )}
    </div>
  );
}

function UserRow({ profile, onClick }: { profile: UserPublicProfile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 bg-film-surface border border-film-border rounded-xl active:opacity-60">
      {profile.photoURL ? (
        <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full object-cover border border-film-border shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-film-accent flex items-center justify-center text-film-black font-bold shrink-0">
          {profile.displayName[0]?.toUpperCase() ?? 'U'}
        </div>
      )}
      <div className="flex-1 text-left min-w-0">
        <p className="text-film-text text-sm font-semibold truncate">{profile.displayName}</p>
        <p className="text-film-subtle text-xs">{profile.moviesWatchedCount} film · {profile.reviewsCount} review</p>
      </div>
      <span className="text-film-accent text-xs shrink-0">Vedi →</span>
    </button>
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

// ── Provider Selector ────────────────────────────────────────────────

// Fallback SVG badges for providers whose TMDB logos may be broken
const PROVIDER_FALLBACK: Record<number, { bg: string; text: string; label: string }> = {
  8:    { bg: '#E50914', text: '#fff', label: 'NETFLIX' },
  119:  { bg: '#00A8E0', text: '#fff', label: 'prime' },
  337:  { bg: '#0C204D', text: '#fff', label: 'disney+' },
  35:   { bg: '#000',    text: '#fff', label: '▶ tv+' },
  1899: { bg: '#001C7A', text: '#fff', label: 'HBO Max' },
  531:  { bg: '#0064FF', text: '#fff', label: 'P+' },
  39:   { bg: '#00AEEF', text: '#fff', label: 'NOW' },
  222:  { bg: '#0072CE', text: '#fff', label: 'TIM' },
};

const PROVIDERS = [
  { id: 8,    name: 'Netflix',    logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  { id: 119,  name: 'Prime',      logo: '/dQeAar5H991VYporEjUspolDarG.jpg' },
  { id: 337,  name: 'Disney+',    logo: '/97yvRBw1GzX7fXprcF80er19ot.jpg' },
  { id: 35,   name: 'Apple TV+',  logo: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  { id: 1899, name: 'HBO Max',    logo: '/Ajqyt5aNxNx8rDHQEhTHcPnNpjw.jpg' },
  { id: 531,  name: 'Paramount+', logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  { id: 39,   name: 'NOW TV',     logo: '/ixVmHmFEKhxCG07LMnLBMZMFGlO.jpg' },
  { id: 222,  name: 'TIMvision',  logo: '/bZGFHCAPgdD44ByaHFLAlqJGvSl.jpg' },
];

function ProviderSelector({ selected, onChange }: {
  selected: number[];
  onChange: (ids: number[]) => Promise<void>;
}) {
  function toggle(id: number) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next);
  }

  return (
    <div className="bg-film-surface border border-film-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-film-text text-sm font-medium">Le mie piattaforme</p>
        <p className="text-film-subtle text-xs">{selected.length > 0 ? `${selected.length} selezionate` : 'Nessuna'}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PROVIDERS.map(p => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-90',
                active ? 'border-film-accent bg-film-accent/10' : 'border-film-border bg-film-card'
              )}
            >
              <img
                src={`https://image.tmdb.org/t/p/w92${p.logo}`}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const fb = PROVIDER_FALLBACK[p.id];
                  const parent = img.parentElement;
                  if (parent && fb) {
                    parent.style.background = fb.bg;
                    parent.style.display = 'flex';
                    parent.style.alignItems = 'center';
                    parent.style.justifyContent = 'center';
                    parent.innerHTML = `<span style="font-size:9px;font-weight:700;color:${fb.text};text-align:center;padding:2px 3px;line-height:1.1;letter-spacing:-.3px">${fb.label}</span>`;
                  }
                }}
                alt={p.name}
                className={cn('w-10 h-10 rounded-lg', !active && 'opacity-40 grayscale')}
              />
              <span className={cn('text-xs leading-tight text-center', active ? 'text-film-text' : 'text-film-subtle')}>
                {p.name}
              </span>
              {active && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-film-accent flex items-center justify-center">
                  <Check size={10} className="text-film-black" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-film-subtle text-xs mt-3 text-center">
          Nella sezione Stasera vedrai subito cosa puoi guardare gratis
        </p>
      )}
    </div>
  );
}