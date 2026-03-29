/**
 * ReviewDetailScreen — schermata dettaglio recensione con replies.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, ThumbsUp, ThumbsDown, Send, Heart, AlertTriangle, Film } from 'lucide-react';
import type { Review, ReviewReply } from '../services/firestore';
import { fetchReplies, addReply, voteReview, fetchUserVote } from '../services/firestore';
import { getImageUrl } from '../services/tmdb';
import { cn } from '../utils';
import type { User } from 'firebase/auth';

interface ReviewDetailScreenProps {
  review: Review;
  currentUser: User | null;
  onBack: () => void;
  onOpenMovie: (movieId: number, mediaType: 'movie' | 'tv') => void;
  onOpenUser: (userId: string) => void;
}

export function ReviewDetailScreen({
  review, currentUser, onBack, onOpenMovie, onOpenUser,
}: ReviewDetailScreenProps) {
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [myVote, setMyVote] = useState<'like' | 'dislike' | null>(null);
  const [localLikes, setLocalLikes] = useState(review.likes);
  const [localDislikes, setLocalDislikes] = useState(review.dislikes);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  const canReply = review.repliesAllowed === 'all' ||
    (review.repliesAllowed === 'none' ? false : true); // simplified — full impl needs following check
  const poster = getImageUrl(review.moviePosterPath, 'w185');

  useEffect(() => {
    setLoadingReplies(true);
    fetchReplies(review.id).then(setReplies).catch(() => {}).finally(() => setLoadingReplies(false));
    if (currentUser) {
      fetchUserVote(review.id, currentUser.uid).then(setMyVote).catch(() => {});
    }
  }, [review.id, currentUser]);

  async function handleVote(type: 'like' | 'dislike') {
    if (!currentUser) return;
    const prev = myVote;
    // Optimistic update
    if (prev === type) {
      setMyVote(null);
      type === 'like' ? setLocalLikes(v => v - 1) : setLocalDislikes(v => v - 1);
    } else {
      if (prev === 'like') setLocalLikes(v => v - 1);
      if (prev === 'dislike') setLocalDislikes(v => v - 1);
      setMyVote(type);
      type === 'like' ? setLocalLikes(v => v + 1) : setLocalDislikes(v => v + 1);
    }
    await voteReview(review.id, currentUser.uid, prev === type ? null : type);
  }

  async function handleReply() {
    if (!currentUser || !replyText.trim()) return;
    setSending(true);
    try {
      const reply = await addReply(
        review.id, currentUser.uid,
        currentUser.displayName ?? 'User',
        currentUser.photoURL ?? null,
        replyText.trim()
      );
      setReplies(prev => [...prev, reply]);
      setReplyText('');
    } finally { setSending(false); }
  }

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
        <span className="text-film-text font-semibold">Recensione</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* User + movie info */}
        <div className="px-4 pt-4 pb-3 border-b border-film-border/40">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <button onClick={() => onOpenUser(review.userId)} className="shrink-0 active:opacity-60">
              {review.userPhotoURL ? (
                <img src={review.userPhotoURL} alt="" className="w-12 h-12 rounded-full object-cover border border-film-border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-film-accent flex items-center justify-center text-film-black font-bold">
                  {review.userName[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => onOpenUser(review.userId)} className="active:opacity-60">
                <p className="text-film-text font-bold">{review.userName}</p>
              </button>
              <p className="text-film-subtle text-xs mt-0.5">
                {new Date(review.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                {review.watchedOn && ` · Visto il ${new Date(review.watchedOn).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
          </div>

          {/* Movie info */}
          <button
            onClick={() => onOpenMovie(review.movieId, review.mediaType)}
            className="mt-3 flex items-center gap-3 p-3 bg-film-surface rounded-xl border border-film-border active:opacity-60 w-full"
          >
            {poster && <img src={poster} alt="" className="w-10 h-15 rounded object-cover shrink-0" style={{ height: 56 }} />}
            <div className="min-w-0 text-left">
              <p className="text-film-text text-sm font-semibold truncate">{review.movieTitle}</p>
              <p className="text-film-subtle text-xs">{new Date(review.movieReleaseDate).getFullYear() || ''}</p>
            </div>
            <Film size={14} className="text-film-accent ml-auto shrink-0" />
          </button>

          {/* Rating + Liked */}
          <div className="flex items-center gap-3 mt-3">
            {review.rating !== null && (
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={cn('text-base', i < (review.rating ?? 0) ? 'text-yellow-400' : 'text-film-border')}>★</span>
                ))}
              </div>
            )}
            {review.liked && <Heart size={16} className="text-red-400 fill-red-400" />}
            {review.firstView && <span className="text-xs bg-film-surface border border-film-border px-2 py-0.5 rounded-full text-film-subtle">Prima visione 🎬</span>}
            {review.hasSpoilers && <span className="text-xs bg-yellow-900/30 border border-yellow-500/20 px-2 py-0.5 rounded-full text-yellow-400 flex items-center gap-1"><AlertTriangle size={10} />Spoiler</span>}
          </div>
        </div>

        {/* Review text */}
        {review.text.trim().length > 0 && (
          <div className="px-4 py-4 border-b border-film-border/40">
            {review.hasSpoilers && !spoilerRevealed ? (
              <button onClick={() => setSpoilerRevealed(true)} className="w-full p-3 rounded-xl bg-yellow-900/20 border border-yellow-500/20 active:opacity-60">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> Questa recensione contiene spoiler. Tocca per leggere.
                </p>
              </button>
            ) : (
              <p className="text-film-text/90 text-sm leading-relaxed">{review.text}</p>
            )}
          </div>
        )}

        {/* Vote CTA */}
        <div className="px-4 py-3 flex items-center gap-6 border-b border-film-border/40">
          <button onClick={() => handleVote('like')} className={cn('flex items-center gap-2 active:opacity-60', myVote === 'like' ? 'text-green-400' : 'text-film-muted')}>
            <ThumbsUp size={18} />
            <span className="text-sm font-medium">{localLikes}</span>
          </button>
          <button onClick={() => handleVote('dislike')} className={cn('flex items-center gap-2 active:opacity-60', myVote === 'dislike' ? 'text-red-400' : 'text-film-muted')}>
            <ThumbsDown size={18} />
            <span className="text-sm font-medium">{localDislikes}</span>
          </button>
          <span className="text-film-subtle text-xs ml-auto">
            {review.repliesAllowed === 'none' ? 'Risposte disabilitate' : `${replies.length} risposte`}
          </span>
        </div>

        {/* Replies */}
        {!loadingReplies && replies.length > 0 && (
          <div className="px-4 py-3 space-y-4">
            {replies.map(r => (
              <div key={r.id} className="flex gap-3">
                <button onClick={() => onOpenUser(r.userId)} className="shrink-0 active:opacity-60">
                  {r.userPhotoURL ? (
                    <img src={r.userPhotoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-film-border" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center text-film-text text-xs font-bold">
                      {r.userName[0]?.toUpperCase() ?? 'U'}
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0 bg-film-surface rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => onOpenUser(r.userId)} className="active:opacity-60">
                      <span className="text-film-text text-xs font-semibold">{r.userName}</span>
                    </button>
                    <span className="text-film-subtle text-xs">
                      {new Date(r.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-film-text/80 text-sm leading-relaxed">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="h-4" />
      </div>

      {/* Reply input */}
      {canReply && currentUser && review.userId !== currentUser.uid && review.repliesAllowed !== 'none' && (
        <div className="shrink-0 border-t border-film-border px-4 py-3 flex gap-3 items-end">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-film-accent flex items-center justify-center text-film-black text-xs font-bold shrink-0">
              {currentUser.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Scrivi una risposta..."
            className="flex-1 bg-film-surface border border-film-border rounded-xl px-3 py-2 text-film-text text-sm resize-none focus:outline-none focus:border-film-accent/50 max-h-24"
            rows={2}
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={handleReply}
            disabled={!replyText.trim() || sending}
            className="w-9 h-9 bg-film-accent rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 active:opacity-60"
          >
            <Send size={14} className="text-film-black" />
          </button>
        </div>
      )}
    </div>
  );
}
