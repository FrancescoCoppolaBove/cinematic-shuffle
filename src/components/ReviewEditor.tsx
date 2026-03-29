/**
 * ReviewEditor — overlay fullscreen per scrivere/modificare una recensione.
 * Si apre dal RatingModal tramite CTA "Recensisci".
 */
import { useState, useRef } from 'react';
import { X, Star, Heart, Eye, AlertTriangle, MessageSquareOff, Users, User, ChevronDown } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn } from '../utils';
import type { Review } from '../services/firestore';

export interface ReviewDraft {
  text: string;
  rating: number | null;
  liked: boolean;
  watchedOn: string | null;
  firstView: boolean;
  hasSpoilers: boolean;
  repliesAllowed: 'all' | 'following' | 'none';
}

interface ReviewEditorProps {
  movie: TMDBMovieDetail;
  initialWatched: boolean;
  initialRating: number | null;
  initialLiked: boolean;
  existingReview?: Review | null;
  onSave: (draft: ReviewDraft) => Promise<void>;
  onCancel: () => void;
}

export function ReviewEditor({
  movie, initialRating, initialLiked, existingReview, onSave, onCancel,
}: ReviewEditorProps) {
  const [text, setText] = useState(existingReview?.text ?? '');
  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? initialRating);
  const [liked, setLiked] = useState(existingReview?.liked ?? initialLiked);
  const [watchedOn, setWatchedOn] = useState<string>(
    existingReview?.watchedOn ?? new Date().toISOString().split('T')[0]
  );
  const [firstView, setFirstView] = useState(existingReview?.firstView ?? true);
  const [hasSpoilers, setHasSpoilers] = useState(existingReview?.hasSpoilers ?? false);
  const [repliesAllowed, setRepliesAllowed] = useState<'all' | 'following' | 'none'>(
    existingReview?.repliesAllowed ?? 'all'
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showRepliesMenu, setShowRepliesMenu] = useState(false);
  const hasText = text.trim().length > 0;
  const textRef = useRef<HTMLTextAreaElement>(null);

  const poster = getImageUrl(movie.poster_path, 'w92');
  const title = getTitle(movie);
  const year = formatYear(getReleaseDate(movie));
  const today = new Date().toISOString().split('T')[0];

  const repliesLabel = { all: 'Tutti possono rispondere', following: 'Solo chi seguo', none: 'Nessuno' };

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ text, rating, liked, watchedOn: watchedOn || null, firstView, hasSpoilers, repliesAllowed });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Errore nel salvataggio');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-film-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-film-border">
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center rounded-full bg-film-surface active:opacity-60">
          <X size={18} className="text-film-text" />
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {poster && <img src={poster} alt="" className="w-8 h-12 rounded object-cover shrink-0" />}
          <div className="min-w-0">
            <p className="text-film-text font-semibold text-sm truncate">{title}</p>
            {year && <p className="text-film-subtle text-xs">{year}</p>}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 bg-film-accent text-film-black text-xs font-bold px-4 py-2 rounded-xl active:opacity-60 disabled:opacity-50"
        >
          {saving ? '...' : 'Salva'}
        </button>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="shrink-0 bg-red-900/30 border-b border-red-500/30 px-4 py-2 text-red-400 text-xs">
          ⚠️ {saveError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        
        {/* Rating + Liked */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-film-subtle text-xs uppercase tracking-widest mb-2">Rating</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(rating === s ? null : s)} className="active:scale-90">
                  <Star
                    size={28}
                    className={cn(rating !== null && s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-film-border')}
                  />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setLiked(v => !v)}
            className={cn('flex flex-col items-center gap-1 active:scale-90', liked ? 'text-red-400' : 'text-film-border')}
          >
            <Heart size={28} className={liked ? 'fill-red-400' : ''} />
            <span className="text-xs">Like</span>
          </button>
        </div>

        {/* Text */}
        <div>
          <p className="text-film-subtle text-xs uppercase tracking-widest mb-2">La tua recensione</p>
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Cosa ne pensi? (opzionale)"
            className="w-full bg-film-surface border border-film-border rounded-xl px-4 py-3 text-film-text text-sm resize-none leading-relaxed focus:outline-none focus:border-film-accent/50"
            rows={5}
            style={{ fontSize: '16px' }}
          />
          <p className="text-film-subtle text-xs mt-1 text-right">{text.length} caratteri</p>
        </div>

        {/* Watched On */}
        <div>
          <p className="text-film-subtle text-xs uppercase tracking-widest mb-2">Data visione</p>
          <input
            type="date"
            value={watchedOn}
            max={today}
            onChange={e => setWatchedOn(e.target.value)}
            className="bg-film-surface border border-film-border rounded-xl px-4 py-2.5 text-film-text text-sm focus:outline-none focus:border-film-accent/50"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <p className="text-film-subtle text-xs uppercase tracking-widest">Opzioni</p>

          <button
            onClick={() => setFirstView(v => !v)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors active:opacity-60',
              firstView ? 'border-film-accent/40 bg-film-accent/10' : 'border-film-border bg-film-surface'
            )}
          >
            <Eye size={16} className={firstView ? 'text-film-accent' : 'text-film-muted'} />
            <span className={cn('text-sm flex-1 text-left', firstView ? 'text-film-accent' : 'text-film-muted')}>
              {firstView ? 'Prima visione 🎬' : 'L\'ho già visto prima'}
            </span>
          </button>

          <button
            onClick={() => hasText && setHasSpoilers(v => !v)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
              !hasText ? 'opacity-30 cursor-not-allowed' : 'active:opacity-60',
              hasSpoilers && hasText ? 'border-yellow-500/40 bg-yellow-900/20' : 'border-film-border bg-film-surface'
            )}
          >
            <AlertTriangle size={16} className={hasSpoilers && hasText ? 'text-yellow-400' : 'text-film-muted'} />
            <span className={cn('text-sm flex-1 text-left', hasSpoilers && hasText ? 'text-yellow-400' : 'text-film-muted')}>
              {hasSpoilers && hasText ? 'Contiene spoiler ⚠️' : 'Segna come spoiler'}
              {!hasText && <span className="text-film-subtle text-xs ml-2">(scrivi prima del testo)</span>}
            </span>
          </button>

          {/* Replies allowed */}
          <div className="relative">
            <button
              onClick={() => hasText && setShowRepliesMenu(v => !v)}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-film-border bg-film-surface", !hasText ? "opacity-30 cursor-not-allowed" : "active:opacity-60")}
            >
              {repliesAllowed === 'all' && <Users size={16} className="text-film-muted" />}
              {repliesAllowed === 'following' && <User size={16} className="text-film-muted" />}
              {repliesAllowed === 'none' && <MessageSquareOff size={16} className="text-film-muted" />}
              <span className="text-sm text-film-muted flex-1 text-left">{repliesLabel[repliesAllowed]}</span>
              <ChevronDown size={14} className="text-film-subtle" />
            </button>
            {showRepliesMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-film-surface border border-film-border rounded-xl overflow-hidden z-10">
                {(['all', 'following', 'none'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setRepliesAllowed(opt); setShowRepliesMenu(false); }}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm border-b border-film-border/40 last:border-0 active:bg-film-card',
                      repliesAllowed === opt ? 'text-film-accent' : 'text-film-text'
                    )}
                  >
                    {repliesLabel[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
