/**
 * UserProfileScreen — pagina profilo pubblico di un utente.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, Film, Star, MessageSquare } from 'lucide-react';
import type { UserPublicProfile, Review } from '../services/firestore';
import {
  fetchUserPublicProfile, fetchUserReviews, isFollowing, followUser, unfollowUser, upsertUserPublicProfile,
} from '../services/firestore';
import { fetchWatchedMovies } from '../services/firestore';
import { getImageUrl } from '../services/tmdb';
import { cn } from '../utils';
import type { User } from 'firebase/auth';

type ProfileTab = 'activity' | 'watched' | 'reviews' | 'likes';

interface UserProfileScreenProps {
  targetUid: string;
  currentUser: User | null;
  onBack: () => void;
  onOpenMovie: (movieId: number, mediaType: 'movie' | 'tv') => void;
  onOpenReview: (review: Review) => void;
}

export function UserProfileScreen({
  targetUid, currentUser, onBack, onOpenMovie, onOpenReview,
}: UserProfileScreenProps) {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<import('../types').WatchedMovie[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('activity');
  const [loading, setLoading] = useState(true);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const isSelf = currentUser?.uid === targetUid;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchUserPublicProfile(targetUid),
      fetchUserReviews(targetUid, 20),
      fetchWatchedMovies(targetUid).catch(() => []),
      currentUser && !isSelf ? isFollowing(currentUser.uid, targetUid) : Promise.resolve(false),
    ]).then(([prof, revs, watched, isF]) => {
      // If no public profile, create a minimal one from reviews
      if (!prof && revs.length > 0) {
        setProfile({
          uid: targetUid,
          displayName: revs[0].userName,
          photoURL: revs[0].userPhotoURL,
          bio: '',
          followersCount: 0,
          followingCount: 0,
          moviesWatchedCount: watched.length,
          reviewsCount: revs.length,
        });
      } else {
        setProfile(prof);
      }
      setReviews(revs);
      setWatchedMovies(watched);
      setFollowing(isF as boolean);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [targetUid, currentUser, isSelf]);

  async function handleFollow() {
    if (!currentUser || isSelf) return;
    if (following) {
      await unfollowUser(currentUser.uid, targetUid);
      setFollowing(false);
      setProfile(p => p ? { ...p, followersCount: Math.max(0, p.followersCount - 1) } : p);
    } else {
      // Ensure own public profile exists
      await upsertUserPublicProfile(currentUser.uid, {
        displayName: currentUser.displayName ?? 'User',
        photoURL: currentUser.photoURL ?? null,
      });
      await followUser(currentUser.uid, targetUid);
      setFollowing(true);
      setProfile(p => p ? { ...p, followersCount: p.followersCount + 1 } : p);
    }
  }

  const likedMovies = watchedMovies.filter(m => m.liked);
  const recentActivity = [...watchedMovies]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, 10);

  if (loading) return (
    <div className="fixed left-0 right-0 z-[115] bg-film-black flex flex-col items-center justify-center"
      style={{ top: 0, bottom: 'var(--nav-h, 60px)', paddingTop: 'env(safe-area-inset-top)', isolation: 'isolate' }}>
      <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="fixed left-0 right-0 z-[115] bg-film-black flex flex-col"
      style={{ top: 0, bottom: 'var(--nav-h, 60px)', paddingTop: 'env(safe-area-inset-top)', isolation: 'isolate' }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-film-border">
        <button onClick={onBack} className="active:opacity-60">
          <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
            <ChevronLeft size={18} className="text-film-text" />
          </div>
        </button>
        <span className="text-film-text font-semibold flex-1 truncate">{profile?.displayName ?? 'Profilo'}</span>
        {!isSelf && currentUser && (
          <button
            onClick={handleFollow}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border active:opacity-60',
              following
                ? 'border-film-border text-film-muted'
                : 'border-film-accent bg-film-accent text-film-black'
            )}
          >
            {following ? 'Seguito' : 'Segui'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="px-4 pt-6 pb-4 flex items-start gap-4 border-b border-film-border/40">
          <button onClick={() => setPhotoZoomed(true)} className="shrink-0 active:opacity-60">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-film-border" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-film-accent flex items-center justify-center text-film-black text-3xl font-bold">
                {profile?.displayName?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-bold text-lg">{profile?.displayName}</p>
            {profile?.bio && <p className="text-film-muted text-sm mt-1 leading-relaxed">{profile.bio}</p>}
            <div className="flex gap-4 mt-3">
              <div className="text-center">
                <p className="text-film-text font-bold text-sm">{watchedMovies.length}</p>
                <p className="text-film-subtle text-xs">Visti</p>
              </div>
              <div className="text-center">
                <p className="text-film-text font-bold text-sm">{reviews.length}</p>
                <p className="text-film-subtle text-xs">Review</p>
              </div>
              <div className="text-center">
                <p className="text-film-text font-bold text-sm">{profile?.followersCount ?? 0}</p>
                <p className="text-film-subtle text-xs">Follower</p>
              </div>
              <div className="text-center">
                <p className="text-film-text font-bold text-sm">{profile?.followingCount ?? 0}</p>
                <p className="text-film-subtle text-xs">Seguiti</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-film-border sticky top-0 bg-film-black z-10">
          {([
            { key: 'activity', label: 'Attività', icon: Film },
            { key: 'watched', label: 'Visti', icon: Film },
            { key: 'reviews', label: 'Review', icon: MessageSquare },
            { key: 'likes', label: 'Like', icon: Star },
          ] as { key: ProfileTab; label: string; icon: typeof Film }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-3 text-xs font-medium transition-colors relative',
                tab === key ? 'text-film-text' : 'text-film-subtle'
              )}
            >
              {label}
              {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-film-accent" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 py-4">
          {tab === 'activity' && (
            <div>
              <p className="text-film-subtle text-xs uppercase tracking-widest mb-3">Attività recente</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {recentActivity.slice(0, 3).map(m => (
                  <button key={m.id} onClick={() => onOpenMovie(m.id, m.media_type)} className="active:opacity-60">
                    {m.poster_path
                      ? <img src={getImageUrl(m.poster_path, 'w185') ?? ''} alt={m.title} className="w-full aspect-[2/3] object-cover rounded-xl border border-film-border" />
                      : <div className="w-full aspect-[2/3] bg-film-surface rounded-xl border border-film-border flex items-center justify-center text-2xl">{m.media_type === 'tv' ? '📺' : '🎬'}</div>
                    }
                  </button>
                ))}
              </div>
              {recentActivity.length > 3 && (
                <div className="space-y-2">
                  {recentActivity.slice(3).map(m => (
                    <button key={m.id} onClick={() => onOpenMovie(m.id, m.media_type)}
                      className="w-full flex items-center gap-3 py-2 active:opacity-60 text-left">
                      {m.poster_path && <img src={getImageUrl(m.poster_path, 'w92') ?? ''} alt="" className="w-9 h-[54px] rounded-lg object-cover border border-film-border shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-film-text text-sm font-medium truncate">{m.title}</p>
                        <p className="text-film-subtle text-xs">{new Date(m.addedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      {m.personal_rating && <span className="ml-auto text-yellow-400 text-xs">★ {m.personal_rating}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'watched' && (
            <div className="grid grid-cols-3 gap-2">
              {watchedMovies.map(m => (
                <button key={m.id} onClick={() => onOpenMovie(m.id, m.media_type)} className="active:opacity-60">
                  {m.poster_path
                    ? <img src={getImageUrl(m.poster_path, 'w185') ?? ''} alt={m.title} className="w-full aspect-[2/3] object-cover rounded-xl border border-film-border" />
                    : <div className="w-full aspect-[2/3] bg-film-surface rounded-xl border border-film-border flex items-center justify-center text-2xl">{m.media_type === 'tv' ? '📺' : '🎬'}</div>
                  }
                </button>
              ))}
              {watchedMovies.length === 0 && <p className="col-span-3 text-film-muted text-sm text-center py-8">Nessun film ancora</p>}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="space-y-4">
              {reviews.map(r => (
                <button key={r.id} onClick={() => onOpenReview(r)} className="w-full text-left active:opacity-60">
                  <div className="bg-film-surface border border-film-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-film-text text-sm font-semibold truncate flex-1">{r.movieTitle}</p>
                      {r.rating && (
                        <div className="flex gap-0.5 shrink-0">
                          {Array.from({ length: r.rating }).map((_, i) => <span key={i} className="text-yellow-400 text-xs">★</span>)}
                        </div>
                      )}
                    </div>
                    {r.text && <p className="text-film-text/70 text-xs line-clamp-2 leading-relaxed">{r.text}</p>}
                    <p className="text-film-subtle text-xs mt-2">{new Date(r.createdAt).toLocaleDateString('it-IT')}</p>
                  </div>
                </button>
              ))}
              {reviews.length === 0 && <p className="text-film-muted text-sm text-center py-8">Nessuna recensione ancora</p>}
            </div>
          )}

          {tab === 'likes' && (
            <div className="grid grid-cols-3 gap-2">
              {likedMovies.map(m => (
                <button key={m.id} onClick={() => onOpenMovie(m.id, m.media_type)} className="active:opacity-60">
                  {m.poster_path
                    ? <img src={getImageUrl(m.poster_path, 'w185') ?? ''} alt={m.title} className="w-full aspect-[2/3] object-cover rounded-xl border border-film-border" />
                    : <div className="w-full aspect-[2/3] bg-film-surface rounded-xl border border-film-border flex items-center justify-center text-2xl">❤️</div>
                  }
                </button>
              ))}
              {likedMovies.length === 0 && <p className="col-span-3 text-film-muted text-sm text-center py-8">Nessun like ancora</p>}
            </div>
          )}
        </div>
      </div>

      {/* Photo zoom overlay */}
      {photoZoomed && profile?.photoURL && (
        <button
          onClick={() => setPhotoZoomed(false)}
          className="absolute inset-0 bg-black/90 flex items-center justify-center z-10"
        >
          <img src={profile.photoURL} alt="" className="w-64 h-64 rounded-2xl object-cover" />
        </button>
      )}
    </div>
  );
}
