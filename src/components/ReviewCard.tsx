/**
 * ReviewCard — card singola recensione usata in lista e in Popular Reviews.
 */
import { useState } from 'react';
import { Heart, ThumbsUp, ThumbsDown, MessageSquare, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { Review } from '../services/firestore';
import { cn } from '../utils';

interface ReviewCardProps {
  review: Review;
  myVote: 'like' | 'dislike' | null;
  onVote: (type: 'like' | 'dislike') => void;
  onClick: () => void;
  onUserClick: () => void;
  compact?: boolean; // for Popular Reviews section (3 cards)
}

export function ReviewCard({ review, myVote, onVote, onClick, onUserClick, compact = false }: ReviewCardProps) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const hasText = review.text.trim().length > 0;
  const isSpoiler = review.hasSpoilers && hasText && !spoilerRevealed;

  return (
    <div
      className="bg-film-surface border border-film-border rounded-2xl overflow-hidden"
    >
      {/* Header row: avatar + name + rating + liked */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={onUserClick} className="shrink-0 active:opacity-60">
          {review.userPhotoURL ? (
            <img src={review.userPhotoURL} alt={review.userName} className="w-9 h-9 rounded-full object-cover border border-film-border" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-film-accent flex items-center justify-center text-film-black text-sm font-bold">
              {review.userName[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={onUserClick} className="active:opacity-60">
            <p className="text-film-text text-sm font-semibold truncate">{review.userName}</p>
          </button>
          <p className="text-film-subtle text-xs">
            {new Date(review.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {review.liked && <Heart size={14} className="text-red-400 fill-red-400" />}
          {review.rating !== null && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={cn('text-xs', i < (review.rating ?? 0) ? 'text-yellow-400' : 'text-film-border')}>★</span>
              ))}
            </div>
          )}
          {review.firstView && <span className="text-xs">🎬</span>}
        </div>
      </div>

      {/* Text / Spoiler */}
      {hasText && (
        <button onClick={isSpoiler ? () => setSpoilerRevealed(true) : onClick} className="w-full text-left px-4 pb-3 active:opacity-70">
          {isSpoiler ? (
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-yellow-900/20 border border-yellow-500/20">
              <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
              <p className="text-yellow-400 text-xs">Questa recensione contiene spoiler. Tocca per leggere.</p>
            </div>
          ) : (
            <p className={cn('text-film-text/80 text-sm leading-relaxed', compact && 'line-clamp-3')}>
              {review.text}
            </p>
          )}
        </button>
      )}

      {/* Footer: likes + dislikes + replies */}
      <div className="flex items-center gap-4 px-4 pb-3 border-t border-film-border/30 pt-2">
        <button
          onClick={() => onVote('like')}
          className={cn('flex items-center gap-1.5 active:opacity-60', myVote === 'like' ? 'text-green-400' : 'text-film-subtle')}
        >
          <ThumbsUp size={14} />
          <span className="text-xs font-medium">{review.likes}</span>
        </button>
        <button
          onClick={() => onVote('dislike')}
          className={cn('flex items-center gap-1.5 active:opacity-60', myVote === 'dislike' ? 'text-red-400' : 'text-film-subtle')}
        >
          <ThumbsDown size={14} />
          <span className="text-xs font-medium">{review.dislikes}</span>
        </button>
        <button onClick={onClick} className="flex items-center gap-1.5 text-film-subtle active:opacity-60">
          <MessageSquare size={14} />
          <span className="text-xs">{review.replyCount}</span>
        </button>
        <button onClick={onClick} className="ml-auto text-film-accent text-xs active:opacity-60">
          Leggi
        </button>
      </div>
    </div>
  );
}

// ─── Popular Reviews section (top 3 by likes) ─────────────────────
interface PopularReviewsProps {
  reviews: Review[];
  myVotes: Map<string, 'like' | 'dislike'>;
  onVote: (reviewId: string, type: 'like' | 'dislike') => void;
  onOpenReview: (review: Review) => void;
  onOpenUser: (userId: string) => void;
  onShowAll: () => void;
  totalCount: number;
}

export function PopularReviews({
  reviews, myVotes, onVote, onOpenReview, onOpenUser, onShowAll, totalCount,
}: PopularReviewsProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, 3);

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-film-subtle font-medium">Popular Reviews</h3>
        {totalCount > 3 && (
          <button onClick={onShowAll} className="text-film-accent text-xs active:opacity-60">
            Tutte ({totalCount})
          </button>
        )}
      </div>
      <div className="space-y-3">
        {visible.map(r => (
          <ReviewCard
            key={r.id}
            review={r}
            myVote={myVotes.get(r.id) ?? null}
            onVote={type => onVote(r.id, type)}
            onClick={() => onOpenReview(r)}
            onUserClick={() => onOpenUser(r.userId)}
            compact
          />
        ))}
      </div>
      {reviews.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1 py-2 text-film-subtle text-sm active:opacity-60"
        >
          {expanded ? <><ChevronUp size={14} /> Mostra meno</> : <><ChevronDown size={14} /> Mostra tutte le {reviews.length}</>}
        </button>
      )}
    </div>
  );
}
