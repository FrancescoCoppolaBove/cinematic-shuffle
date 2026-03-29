/**
 * AllReviewsScreen — lista completa recensioni con filtri.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import type { Review, ReviewSortMode } from '../services/firestore';
import { fetchReviewsForMovie, voteReview, fetchUserVote } from '../services/firestore';
import { ReviewCard } from './ReviewCard';
import type { User } from 'firebase/auth';

interface AllReviewsScreenProps {
  movieId: number;
  movieTitle: string;
  currentUser: User | null;
  onBack: () => void;
  onOpenReview: (review: Review) => void;
  onOpenUser: (userId: string) => void;
}

const SORT_OPTIONS: { value: ReviewSortMode; label: string }[] = [
  { value: 'popular',  label: 'Più popolari' },
  { value: 'highest',  label: 'Voto più alto' },
  { value: 'lowest',   label: 'Voto più basso' },
  { value: 'newest',   label: 'Più recenti' },
  { value: 'friends',  label: 'Amici prima' },
];

export function AllReviewsScreen({
  movieId, movieTitle, currentUser, onBack, onOpenReview, onOpenUser,
}: AllReviewsScreenProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<ReviewSortMode>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [myVotes, setMyVotes] = useState<Map<string, 'like' | 'dislike'>>(new Map());

  useEffect(() => {
    setLoading(true);
    fetchReviewsForMovie(movieId, sortMode === 'friends' ? 'popular' : sortMode, 100)
      .then(setReviews)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [movieId, sortMode]);

  useEffect(() => {
    if (!currentUser || reviews.length === 0) return;
    // Load votes for visible reviews
    Promise.all(
      reviews.map(r => fetchUserVote(r.id, currentUser.uid).then(v => ({ id: r.id, v })))
    ).then(results => {
      const map = new Map<string, 'like' | 'dislike'>();
      results.forEach(({ id, v }) => { if (v) map.set(id, v); });
      setMyVotes(map);
    }).catch(() => {});
  }, [reviews, currentUser]);

  async function handleVote(reviewId: string, type: 'like' | 'dislike') {
    if (!currentUser) return;
    const prev = myVotes.get(reviewId) ?? null;
    const next = new Map(myVotes);
    if (prev === type) {
      next.delete(reviewId);
      setReviews(rs => rs.map(r => r.id === reviewId
        ? { ...r, likes: type === 'like' ? r.likes - 1 : r.likes, dislikes: type === 'dislike' ? r.dislikes - 1 : r.dislikes }
        : r));
    } else {
      next.set(reviewId, type);
      setReviews(rs => rs.map(r => r.id === reviewId ? {
        ...r,
        likes: type === 'like' ? r.likes + 1 : (prev === 'like' ? r.likes - 1 : r.likes),
        dislikes: type === 'dislike' ? r.dislikes + 1 : (prev === 'dislike' ? r.dislikes - 1 : r.dislikes),
      } : r));
    }
    setMyVotes(next);
    await voteReview(reviewId, currentUser.uid, prev === type ? null : type);
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortMode)?.label ?? 'Più popolari';

  return (
    <div
      className="fixed left-0 right-0 z-[115] bg-film-black flex flex-col"
      style={{ top: 0, bottom: 'var(--nav-h, 60px)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-film-border">
        <button onClick={onBack} className="active:opacity-60">
          <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
            <ChevronLeft size={18} className="text-film-text" />
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-film-text font-semibold truncate">Recensioni</p>
          <p className="text-film-subtle text-xs truncate">{movieTitle}</p>
        </div>
        {/* Sort button */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(v => !v)}
            className="flex items-center gap-1 text-film-accent text-xs active:opacity-60"
          >
            {currentSortLabel} <ChevronDown size={12} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-film-surface border border-film-border rounded-xl overflow-hidden z-10 min-w-40">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSortMode(opt.value); setShowSortMenu(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm border-b border-film-border/40 last:border-0 active:bg-film-card',
                    sortMode === opt.value ? 'text-film-accent' : 'text-film-text'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-film-muted">
            <p className="text-sm">Nessuna recensione ancora</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {reviews.map(r => (
              <ReviewCard
                key={r.id}
                review={r}
                myVote={myVotes.get(r.id) ?? null}
                onVote={type => handleVote(r.id, type)}
                onClick={() => onOpenReview(r)}
                onUserClick={() => onOpenUser(r.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
