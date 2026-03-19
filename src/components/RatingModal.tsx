import { useState } from 'react';
import { X, Eye } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { getImageUrl } from '../services/tmdb';
import { formatYear } from '../utils';
import { StarRating } from './StarRating';

interface RatingModalProps {
  movie: TMDBMovieDetail;
  onConfirm: (rating: number | null) => void;
  onCancel: () => void;
}

export function RatingModal({ movie, onConfirm, onCancel }: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const poster = getImageUrl(movie.poster_path, 'w185');

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-film-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Modal */}
      <div className="w-full max-w-sm bg-film-surface border border-film-border rounded-2xl overflow-hidden animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-film-accent">
            <Eye size={16} />
            <span className="text-sm font-medium">Segna come visto</span>
          </div>
          <button onClick={onCancel} className="text-film-muted hover:text-film-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Film preview */}
        <div className="px-5 pb-4 flex items-center gap-3">
          <div className="w-10 h-14 rounded-lg overflow-hidden bg-film-card border border-film-border shrink-0">
            {poster ? (
              <img src={poster} alt={movie.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-film-text text-sm font-medium truncate">{movie.title}</p>
            <p className="text-film-muted text-xs">{formatYear(movie.release_date)}</p>
          </div>
        </div>

        {/* Rating section */}
        <div className="px-5 pb-5 space-y-3 border-t border-film-border pt-4">
          <div className="space-y-1">
            <p className="text-film-text text-sm font-medium">Il tuo voto personale</p>
            <p className="text-film-subtle text-xs">Opzionale — puoi aggiungerlo anche dopo</p>
          </div>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-film-border text-film-muted hover:text-film-text text-sm transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={() => onConfirm(rating)}
            className="flex-1 py-2.5 rounded-xl bg-film-accent hover:bg-film-accent-dim text-film-black text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
          >
            {rating !== null ? `Salva (${rating}★)` : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
