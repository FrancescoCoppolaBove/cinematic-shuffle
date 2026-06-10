import { useMemo, useState } from 'react';
import type React from 'react';
import { Download, MessageCircle, Send, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { WatchedMovie } from '../types';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '../types';
import { APP_NAME, APP_TAGLINE, BRAND_LOGO_SRC, BRAND_WORDMARK_SRC } from '../constants/brand';
import { cn } from '../utils';

type ShareFormat = 'story' | 'post' | 'reel' | 'message';

interface CinephileProfileShareProps {
  user: User;
  watchedMovies: WatchedMovie[];
  onClose: () => void;
}

interface PortraitData {
  name: string;
  archetype: string;
  rank: string;
  totalTitles: number;
  totalHours: number;
  topDecade: string;
  topGenres: { name: string; count: number; ratio: number }[];
  favoriteTitles: string[];
}

const FORMAT_META: Record<ShareFormat, { label: string; size: string; width: number; height: number; icon: React.ReactNode }> = {
  story: { label: 'Story', size: '9:16', width: 1080, height: 1920, icon: <Send size={16} /> },
  post: { label: 'Post', size: '4:5', width: 1080, height: 1350, icon: <Download size={16} /> },
  reel: { label: 'Reel cover', size: '9:16', width: 1080, height: 1920, icon: <Download size={16} /> },
  message: { label: 'Message', size: '1:1', width: 1080, height: 1080, icon: <MessageCircle size={16} /> },
};

const GENRE_NAMES = new Map([...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].map(g => [g.id, g.name]));

function getDecade(date: string): string | null {
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year) || year < 1800) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

function buildPortraitData(user: User, watchedMovies: WatchedMovie[]): PortraitData {
  const genreCounts = new Map<number, number>();
  const decadeCounts = new Map<string, number>();
  let runtime = 0;

  for (const movie of watchedMovies) {
    for (const id of movie.genre_ids ?? []) genreCounts.set(id, (genreCounts.get(id) ?? 0) + 1);
    const decade = getDecade(movie.release_date);
    if (decade) decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    runtime += movie.runtime ?? 0;
  }

  const topGenreEntries = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCount = Math.max(1, topGenreEntries[0]?.[1] ?? 1);
  const topGenres = topGenreEntries.map(([id, count]) => ({
    name: GENRE_NAMES.get(id) ?? 'Cinema',
    count,
    ratio: count / topCount,
  }));
  const topDecade = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'timeless';
  const topGenre = topGenres[0]?.name ?? 'Cinema';
  const rank = watchedMovies.length >= 900
    ? 'Legendary Cinephile'
    : watchedMovies.length >= 400
      ? 'Seasoned Cinephile'
      : watchedMovies.length >= 100
        ? 'Rising Cinephile'
        : 'New Cinephile';
  const favoriteTitles = watchedMovies
    .filter(m => m.liked || (m.personal_rating ?? 0) >= 4)
    .sort((a, b) => (b.personal_rating ?? b.vote_average / 2) - (a.personal_rating ?? a.vote_average / 2))
    .slice(0, 3)
    .map(m => m.title);

  return {
    name: user.displayName || user.email || 'Cinephile',
    archetype: `${topDecade} ${topGenre} Heart`,
    rank,
    totalTitles: watchedMovies.length,
    totalHours: Math.round(runtime / 60),
    topDecade,
    topGenres,
    favoriteTitles,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCenteredWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = wrapText(ctx, text, maxWidth);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

async function generatePortraitImage(data: PortraitData, format: ShareFormat): Promise<Blob> {
  await document.fonts?.ready;
  const meta = FORMAT_META[format];
  const canvas = document.createElement('canvas');
  canvas.width = meta.width;
  canvas.height = meta.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const accent = '#F2CB4C';
  const text = '#F7F4EA';
  const muted = '#AAA7B4';
  const bg = ctx.createLinearGradient(0, 0, meta.width, meta.height);
  bg.addColorStop(0, '#18170F');
  bg.addColorStop(0.45, '#08080D');
  bg.addColorStop(1, '#101013');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, meta.width, meta.height);

  const glow = ctx.createRadialGradient(meta.width / 2, meta.height * 0.28, 0, meta.width / 2, meta.height * 0.28, meta.width * 0.68);
  glow.addColorStop(0, 'rgba(242,203,76,0.22)');
  glow.addColorStop(1, 'rgba(242,203,76,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, meta.width, meta.height);

  const compact = format === 'message';
  const top = compact ? 94 : 150;
  const logo = await loadImage(BRAND_LOGO_SRC).catch(() => null);
  if (logo) {
    const logoSize = compact ? 104 : 132;
    ctx.drawImage(logo, meta.width / 2 - logoSize / 2, top - logoSize / 2, logoSize, logoSize);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = muted;
  ctx.font = `${compact ? 27 : 34}px "DM Sans", sans-serif`;
  ctx.fillText('MY CINEPHILE PORTRAIT', meta.width / 2, top + (compact ? 96 : 140));

  ctx.fillStyle = accent;
  ctx.font = `${compact ? 76 : 104}px "Bebas Neue", "Arial Narrow", sans-serif`;
  const archetypeBottom = drawCenteredWrapped(
    ctx,
    data.archetype.toUpperCase(),
    meta.width / 2,
    top + (compact ? 205 : 300),
    meta.width - 150,
    compact ? 78 : 106
  );

  ctx.fillStyle = text;
  ctx.font = `${compact ? 38 : 48}px "DM Sans", sans-serif`;
  ctx.fillText(data.rank, meta.width / 2, archetypeBottom + (compact ? 42 : 56));

  ctx.fillStyle = muted;
  ctx.font = `${compact ? 30 : 36}px "DM Sans", sans-serif`;
  ctx.fillText(data.name, meta.width / 2, archetypeBottom + (compact ? 90 : 112));

  const statsY = compact ? 545 : 760;
  const stats = [
    { value: String(data.totalTitles), label: 'titles' },
    { value: `${data.totalHours}h`, label: 'hours' },
    { value: data.topDecade, label: 'decade' },
  ];
  stats.forEach((stat, i) => {
    const x = meta.width * (0.22 + i * 0.28);
    ctx.fillStyle = accent;
    ctx.font = `${compact ? 62 : 78}px "Bebas Neue", "Arial Narrow", sans-serif`;
    ctx.fillText(stat.value, x, statsY);
    ctx.fillStyle = muted;
    ctx.font = `${compact ? 26 : 31}px "DM Sans", sans-serif`;
    ctx.fillText(stat.label, x, statsY + (compact ? 34 : 44));
  });

  const listStart = compact ? 650 : 900;
  ctx.textAlign = 'left';
  ctx.fillStyle = muted;
  ctx.font = `${compact ? 24 : 30}px "DM Sans", sans-serif`;
  ctx.fillText('MOST WATCHED GENRES', 95, listStart);

  const maxGenres = compact ? 4 : 5;
  data.topGenres.slice(0, maxGenres).forEach((genre, i) => {
    const y = listStart + 55 + i * (compact ? 70 : 78);
    ctx.fillStyle = text;
    ctx.font = `${compact ? 30 : 38}px "DM Sans", sans-serif`;
    ctx.fillText(genre.name, 95, y);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(95, y + 22, meta.width - 190, compact ? 11 : 14);
    ctx.fillStyle = accent;
    ctx.fillRect(95, y + 22, (meta.width - 190) * genre.ratio, compact ? 11 : 14);
  });

  if (!compact && data.favoriteTitles.length > 0) {
    const favY = meta.height - 390;
    ctx.fillStyle = muted;
    ctx.font = '30px "DM Sans", sans-serif';
    ctx.fillText('FAVORITE SIGNALS', 95, favY);
    ctx.fillStyle = text;
    ctx.font = '35px "DM Sans", sans-serif';
    data.favoriteTitles.forEach((title, i) => ctx.fillText(title, 95, favY + 58 + i * 48));
  }

  const footerY = meta.height - (compact ? 155 : 190);
  ctx.textAlign = 'center';
  ctx.fillStyle = muted;
  ctx.font = `${compact ? 25 : 32}px "DM Sans", sans-serif`;
  ctx.fillText('Create your cinephile portrait with', meta.width / 2, footerY);

  const wordmark = await loadImage(BRAND_WORDMARK_SRC).catch(() => null);
  if (wordmark) {
    const w = compact ? 330 : 420;
    const h = w / 2;
    ctx.drawImage(wordmark, meta.width / 2 - w / 2, footerY + 20, w, h);
  } else {
    ctx.fillStyle = accent;
    ctx.font = `${compact ? 42 : 56}px "Bebas Neue", "Arial Narrow", sans-serif`;
    ctx.fillText(APP_NAME, meta.width / 2, footerY + 75);
    ctx.fillStyle = muted;
    ctx.font = `${compact ? 18 : 22}px "DM Sans", sans-serif`;
    ctx.fillText(APP_TAGLINE, meta.width / 2, footerY + 106);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export image'));
    }, 'image/png', 0.95);
  });
}

async function shareBlob(blob: Blob, format: ShareFormat, data: PortraitData) {
  const filename = `cineteca-${format}-profile.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: `${APP_NAME} cinephile profile`,
      text: `My CINETECA cinephile profile: ${data.archetype} (${data.rank}).`,
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CinephileProfileShare({ user, watchedMovies, onClose }: CinephileProfileShareProps) {
  const [busyFormat, setBusyFormat] = useState<ShareFormat | null>(null);
  const [messageCopied, setMessageCopied] = useState(false);
  const data = useMemo(() => buildPortraitData(user, watchedMovies), [user, watchedMovies]);

  async function handleExport(format: ShareFormat) {
    setBusyFormat(format);
    setMessageCopied(false);
    try {
      const blob = await generatePortraitImage(data, format);
      await shareBlob(blob, format, data);
    } finally {
      setBusyFormat(null);
    }
  }

  async function handleMessage() {
    setBusyFormat('message');
    try {
      const text = `My CINETECA cinephile profile: ${data.archetype} (${data.rank}). Create yours with ${APP_NAME}: ${APP_TAGLINE}`;
      await navigator.clipboard?.writeText(text);
      setMessageCopied(true);
      const blob = await generatePortraitImage(data, 'message');
      await shareBlob(blob, 'message', data);
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-film-black/70 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />
      <div className="bg-film-black border-t border-film-border rounded-t-2xl px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-film-text font-semibold">Share Cinephile Profile</p>
            <p className="text-film-subtle text-xs mt-1">Instagram-ready exports with the new CINETECA identity.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center active:opacity-60">
            <X size={16} className="text-film-muted" />
          </button>
        </div>

        <div className="rounded-2xl border border-film-border bg-film-surface/70 px-4 py-4">
          <p className="text-film-accent font-display text-2xl leading-none">{data.archetype}</p>
          <p className="text-film-text text-sm font-semibold mt-3">{data.rank}</p>
          <p className="text-film-subtle text-xs mt-1">{data.totalTitles} titles · {data.totalHours}h · {data.topDecade}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['story', 'post', 'reel'] as ShareFormat[]).map(format => {
            const meta = FORMAT_META[format];
            return (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={busyFormat !== null}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border border-film-border bg-film-surface px-3 py-3 text-left active:scale-[0.98] transition-transform disabled:opacity-60',
                  format === 'story' && 'col-span-2'
                )}
              >
                <span>
                  <span className="block text-film-text text-sm font-semibold">{meta.label}</span>
                  <span className="block text-film-subtle text-xs mt-0.5">{meta.size}</span>
                </span>
                <span className="text-film-accent">{busyFormat === format ? '...' : meta.icon}</span>
              </button>
            );
          })}
          <button
            onClick={handleMessage}
            disabled={busyFormat !== null}
            className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-film-accent/40 bg-film-accent/10 px-3 py-3 text-left active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <span>
              <span className="block text-film-text text-sm font-semibold">Message</span>
              <span className="block text-film-subtle text-xs mt-0.5">{messageCopied ? 'Caption copied' : 'Square image + share caption'}</span>
            </span>
            <span className="text-film-accent">{busyFormat === 'message' ? '...' : <MessageCircle size={16} />}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
