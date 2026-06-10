/**
 * sharePortrait — builds a 9:16 "cinephile portrait" image and shares it via
 * the native share sheet (Web Share API, files). Fallback: PNG download.
 * Full-bleed cinematic background (no black bars in Stories). No user name,
 * no logo image — just the data and a "CINETECA" wordmark at the bottom.
 */
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES, type WatchedMovie } from '../types';
import { cinephileName } from './cinephileName';

export interface PortraitData {
  cinephileName: string;
  subtitle: string;
  watchedCount: number;
  totalHours: number;
  topDecade?: string;
  topGenres: { name: string; count: number }[];
  directors: string[];
  actors: string[];
}

const GENRE_NAME = new Map<number, string>(
  [...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].map(g => [g.id, g.name])
);

// Compute everything the portrait needs from the watched library + credits.
export function buildPortraitData(
  watchedMovies: WatchedMovie[],
  directors: string[],
  actors: string[],
): PortraitData {
  const genreCount = new Map<number, number>();
  const decadeCount = new Map<string, number>();
  const langCount = new Map<string, number>();
  let minutes = 0;

  for (const m of watchedMovies) {
    for (const g of m.genre_ids ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    const year = parseInt(m.release_date?.slice(0, 4) ?? '0');
    if (year >= 1920) {
      const d = `${Math.floor(year / 10) * 10}s`;
      decadeCount.set(d, (decadeCount.get(d) ?? 0) + 1);
    }
    if (m.original_language) langCount.set(m.original_language, (langCount.get(m.original_language) ?? 0) + 1);
    minutes += m.runtime ?? 0;
  }

  const sortedGenreIds = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const topGenres = sortedGenreIds
    .filter(id => GENRE_NAME.has(id))
    .slice(0, 5)
    .map(id => ({ name: GENRE_NAME.get(id)!, count: genreCount.get(id)! }));
  const topDecade = [...decadeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topLangCode = [...langCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const cine = cinephileName({
    topGenreIds: sortedGenreIds,
    topDecade,
    topLangCode,
    watchedCount: watchedMovies.length,
  });

  return {
    cinephileName: cine.name,
    subtitle: cine.subtitle,
    watchedCount: watchedMovies.length,
    totalHours: Math.round(minutes / 60),
    topDecade,
    topGenres,
    directors: directors.slice(0, 4),
    actors: actors.slice(0, 4),
  };
}

const BG = '#08070C';
const SURFACE = '#1C1C26';
const ACCENT = '#EDC332';
const TEXT = '#F7F3EA';
const MUTED = '#8A8A99';

export async function sharePortrait(d: PortraitData): Promise<void> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Full-bleed cinematic background: vertical gradient + accent glows
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, '#0E0C14');
  vg.addColorStop(0.5, BG);
  vg.addColorStop(1, '#0E0C14');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const glow = (cx: number, cy: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(237,195,50,${a})`);
    g.addColorStop(1, 'rgba(237,195,50,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  glow(W / 2, 360, 760, 0.18);
  glow(W / 2, H - 120, 620, 0.08);

  const PAD = 96;
  const CW = W - PAD * 2;
  let y = 300; // below Instagram's top safe zone

  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = '500 36px sans-serif';
  ctx.fillText('MY CINEPHILE PORTRAIT', W / 2, y);
  y += 110;

  // Hero — cinephile name (adaptive, never clipped)
  ctx.fillStyle = ACCENT;
  const hero = fitText(ctx, d.cinephileName, CW, 2, [108, 94, 80, 68, 58]);
  const lh = hero.size * 1.06;
  for (const line of hero.lines) { y += lh * 0.78; ctx.fillText(line, W / 2, y); y += lh * 0.22; }
  y += 50;
  ctx.fillStyle = TEXT;
  ctx.font = '600 46px sans-serif';
  ctx.fillText(d.subtitle, W / 2, y);
  y += 120;

  // Stats row
  const stats: [string, string][] = [
    [String(d.watchedCount), 'titles'],
    [d.totalHours > 0 ? `${d.totalHours}h` : '—', 'hours'],
    [d.topDecade ? decadeShort(d.topDecade) : '—', 'decade'],
  ];
  const colW = CW / 3;
  stats.forEach(([val, label], i) => {
    const cx = PAD + colW * i + colW / 2;
    ctx.fillStyle = ACCENT; ctx.font = '800 82px sans-serif';
    ctx.fillText(val, cx, y + 60);
    ctx.fillStyle = MUTED; ctx.font = '400 30px sans-serif';
    ctx.fillText(label, cx, y + 110);
  });
  y += 210;

  // Top genres (5) with bars
  ctx.textAlign = 'left';
  section(ctx, 'TOP GENRES', PAD, y); y += 52;
  const maxG = d.topGenres[0]?.count ?? 1;
  for (const g of d.topGenres) {
    ctx.fillStyle = TEXT; ctx.font = '600 40px sans-serif';
    ctx.fillText(truncate(ctx, g.name, CW, '600 40px sans-serif'), PAD, y);
    const by = y + 24;
    ctx.fillStyle = SURFACE; roundRect(ctx, PAD, by, CW, 14, 7); ctx.fill();
    ctx.fillStyle = ACCENT; roundRect(ctx, PAD, by, Math.max(40, CW * (g.count / maxG)), 14, 7); ctx.fill();
    y += 84;
  }
  y += 28;

  // Directors (4) + Actors (4), two columns
  const half = CW / 2;
  const startY = y;
  const people = (title: string, names: string[], x: number) => {
    section(ctx, title, x, startY);
    let yy = startY + 54;
    for (const n of names.slice(0, 4)) {
      ctx.fillStyle = TEXT; ctx.font = '600 38px sans-serif';
      ctx.fillText(truncate(ctx, n, half - 24, '600 38px sans-serif'), x, yy);
      yy += 60;
    }
  };
  if (d.directors.length) people('DIRECTORS', d.directors, PAD);
  if (d.actors.length) people('ACTORS', d.actors, PAD + half);

  // Bottom wordmark — text only
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.font = '800 64px sans-serif';
  ctx.fillText('CINETECA', W / 2, H - 170);

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.92));
  if (!blob) return;
  const file = new File([blob], 'cineteca-cinephile-portrait.png', { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'My cinephile portrait', text: 'My cinephile portrait — CINETECA' });
      return;
    } catch { /* cancelled → fallback */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cineteca-cinephile-portrait.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function section(ctx: CanvasRenderingContext2D, t: string, x: number, y: number) {
  ctx.fillStyle = MUTED; ctx.font = '600 30px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(t, x, y);
}
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function greedyWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW) cur = t; else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, sizes: number[]): { lines: string[]; size: number } {
  for (const size of sizes) {
    ctx.font = `800 ${size}px sans-serif`;
    const lines = greedyWrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { lines, size };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `800 ${size}px sans-serif`;
  let lines = greedyWrap(ctx, text, maxW);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = truncate(ctx, lines[maxLines - 1], maxW, ctx.font); }
  return { lines, size };
}
function decadeShort(decade: string): string {
  const start = parseInt(decade);
  return Number.isNaN(start) ? decade : `${start}s`;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
