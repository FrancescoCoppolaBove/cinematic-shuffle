/**
 * TonightView — "Stasera cosa guardo?"
 * Tre pick dalla watchlist con scoring contestuale e motivazioni.
 */
import { useState } from 'react';
import { RefreshCw, Clock, Star, Bookmark, Play, ChevronRight } from 'lucide-react';
import type { WatchedMovie, WatchlistItem } from '../types';
import { useTonightPick, type TonightPick } from '../hooks/useTonightPick';
import { getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';

interface TonightViewProps {
  watchlist: WatchlistItem[];
  watchedMovies: WatchedMovie[];
  watchedIds: Set<number>;
  onOpenMovie: (id: number, mediaType: 'movie' | 'tv') => void;
}

function getGreeting(hour: number): string {
  if (hour < 6) return 'Notte fonda';
  if (hour < 12) return 'Buongiorno';
  if (hour < 14) return 'Buon pranzo';
  if (hour < 18) return 'Buon pomeriggio';
  if (hour < 22) return 'Buonasera';
  return 'Buonanotte';
}

function getContextLabel(isWeekend: boolean, hour: number): string {
  if (isWeekend) {
    if (hour < 14) return 'Sabato mattina — hai tempo';
    if (hour < 22) return 'Weekend — nessun limite di durata';
    return 'Notte del weekend';
  }
  if (hour >= 22) return 'Tardi — meglio qualcosa di breve';
  if (hour >= 18) return 'Serata infrasettimanale';
  return 'Pomeriggio';
}

const SLOT_LABELS: Record<TonightPick['slot'], { label: string; color: string; bg: string }> = {
  tonight:  { label: 'Perfetto per stasera', color: 'text-film-accent',  bg: 'bg-film-accent/10 border-film-accent/30' },
  acclaimed: { label: 'Il più acclamato',    color: 'text-yellow-400',   bg: 'bg-yellow-400/10 border-yellow-400/30' },
  waiting:  { label: 'Aspetti da più tempo', color: 'text-purple-400',  bg: 'bg-purple-400/10 border-purple-400/30' },
};

export function TonightView({ watchlist, watchedMovies, watchedIds, onOpenMovie }: TonightViewProps) {
  const [seed, setSeed] = useState(0);
  const { picks, ctx, taste, hasPicks } = useTonightPick(watchlist, watchedMovies, watchedIds, seed);

  const hour = ctx.hour;
  const greeting = getGreeting(hour);
  const contextLabel = getContextLabel(ctx.isWeekend, hour);

  // Empty states
  if (watchlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
        <div className="text-6xl opacity-20">🎬</div>
        <h2 className="font-display text-2xl text-film-text tracking-wide">Watchlist vuota</h2>
        <p className="text-film-muted text-sm leading-relaxed">
          Aggiungi film alla tua watchlist per ricevere consigli personalizzati su cosa guardare stasera.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-film-surface border border-film-border rounded-xl">
          <Bookmark size={14} className="text-film-accent" />
          <span className="text-film-muted text-sm">Cerca un film e premi Watchlist</span>
        </div>
      </div>
    );
  }

  if (!hasPicks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
        <div className="text-6xl opacity-20">✅</div>
        <h2 className="font-display text-2xl text-film-text tracking-wide">Tutto visto!</h2>
        <p className="text-film-muted text-sm">Hai visto tutti i film della tua watchlist. Aggiungine altri!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header contestuale */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-wide text-film-text">{greeting} 👋</h1>
            <p className="text-film-muted text-sm mt-0.5">{contextLabel}</p>
          </div>
          <button
            onClick={() => setSeed(s => s + 1)}
            className="p-2.5 rounded-xl bg-film-surface border border-film-border text-film-muted active:scale-90 transition-transform"
            title="Rigenera"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Taste summary — solo se abbiamo dati */}
        {taste.hasData && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-film-surface/50 rounded-xl border border-film-accent/15 mt-2">
            <span className="text-film-accent text-xs">✦</span>
            <p className="text-film-subtle text-xs">
              Calibrato su {watchedMovies.length} film visti · voto medio {taste.avgPersonalRating.toFixed(1)}★
            </p>
          </div>
        )}
      </div>

      {/* I tre pick */}
      {picks.map((pick, i) => (
        <PickCard
          key={`${pick.item.id}-${i}`}
          pick={pick}
          onOpen={() => onOpenMovie(pick.item.id, pick.item.media_type)}
          isFirst={i === 0}
        />
      ))}

      {/* Footer: quanti film in watchlist non ancora visti */}
      <div className="text-center pt-2">
        <p className="text-film-subtle text-xs">
          {watchlist.filter(i => !watchedIds.has(i.id)).length} film in watchlist da vedere
        </p>
      </div>
    </div>
  );
}

// ── PickCard ──────────────────────────────────────────────────────

function PickCard({ pick, onOpen, isFirst }: {
  pick: TonightPick;
  onOpen: () => void;
  isFirst: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const { item, slot, reason, reasonEmoji } = pick;
  const slotStyle = SLOT_LABELS[slot];
  const poster = !imgErr ? getImageUrl(item.poster_path, 'w342') : null;
  const title = getTitle(item);
  const year = formatYear(getReleaseDate(item));

  if (isFirst) {
    // Prima card — più grande con backdrop
    return (
      <button
        onClick={onOpen}
        className="w-full rounded-3xl overflow-hidden border border-film-border bg-film-card active:scale-[0.98] transition-transform text-left relative"
      >
        {/* Backdrop con gradient */}
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          {poster ? (
            <img
              src={getImageUrl(item.poster_path, 'w780') || ''}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-full h-full bg-film-surface flex items-center justify-center text-5xl opacity-30">🎬</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-film-black via-film-black/30 to-transparent" />

          {/* Slot badge in alto a sinistra */}
          <div className={cn('absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium backdrop-blur-sm', slotStyle.bg, slotStyle.color)}>
            <span>{reasonEmoji}</span>
            <span>{slotStyle.label}</span>
          </div>

          {/* Play button */}
          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-film-accent flex items-center justify-center shadow-lg">
            <Play size={16} className="text-film-black ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Info sotto */}
        <div className="px-4 py-3 space-y-1">
          <h3 className="font-display text-xl text-film-text tracking-wide leading-tight">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-film-subtle text-sm">{year}</span>
            {item.vote_average > 0 && (
              <>
                <span className="text-film-border text-xs">·</span>
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-film-accent" fill="currentColor" />
                  <span className="text-film-accent text-sm font-mono">{formatRating(item.vote_average)}</span>
                </div>
              </>
            )}
            {item.runtime && (
              <>
                <span className="text-film-border text-xs">·</span>
                <div className="flex items-center gap-1 text-film-subtle">
                  <Clock size={11} />
                  <span className="text-sm">{item.runtime} min</span>
                </div>
              </>
            )}
          </div>
          <p className="text-film-muted text-xs">{reason}</p>
        </div>
      </button>
    );
  }

  // Card compatta per slot 2 e 3
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-film-border bg-film-card active:scale-[0.98] transition-transform text-left"
    >
      {/* Mini poster */}
      <div className="shrink-0 w-16 aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-surface">
        {poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl opacity-30">🎬</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Slot badge */}
        <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs', slotStyle.bg, slotStyle.color)}>
          <span>{reasonEmoji}</span>
          <span>{slotStyle.label}</span>
        </div>

        <h3 className="font-display text-base text-film-text tracking-wide leading-tight line-clamp-2">{title}</h3>

        <div className="flex items-center gap-2 flex-wrap">
          {year && <span className="text-film-subtle text-xs">{year}</span>}
          {item.vote_average > 0 && (
            <div className="flex items-center gap-1">
              <Star size={10} className="text-film-accent" fill="currentColor" />
              <span className="text-film-accent text-xs font-mono">{formatRating(item.vote_average)}</span>
            </div>
          )}
          {item.runtime && (
            <div className="flex items-center gap-1 text-film-subtle">
              <Clock size={10} />
              <span className="text-xs">{item.runtime} min</span>
            </div>
          )}
        </div>

        <p className="text-film-subtle text-xs leading-tight">{reason}</p>
      </div>

      <ChevronRight size={16} className="text-film-subtle shrink-0" />
    </button>
  );
}
