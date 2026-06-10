/**
 * sharePortrait — genera una "carta da Storia" (9:16, 1080×1920) del ritratto
 * cinefilo e la condivide con la Web Share API (file). Fallback: download PNG.
 * Pensata per le Stories di Instagram: contenuto chiave nella fascia centrale
 * (le UI di IG coprono ~250px sopra e sotto).
 */
export interface PortraitData {
  name: string;            // @nome utente
  cinephileName: string;   // titolo derivato (hero)
  cinephileSubtitle?: string;
  watchedCount: number;
  totalHours: number;
  topDecade?: string;
  topLang?: string | null;
  topGenres: { name: string; count: number }[];
  directors: string[];
  actors: string[];
}

const BG = '#0A0A0F';
const SURFACE = '#1C1C26';
const ACCENT = '#E8C547';
const TEXT = '#EDEDF0';
const MUTED = '#8A8A99';

export async function sharePortrait(d: PortraitData): Promise<void> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Sfondo + bagliori
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createRadialGradient(W / 2, 250, 0, W / 2, 250, 900);
  top.addColorStop(0, 'rgba(232,197,71,0.20)');
  top.addColorStop(1, 'rgba(232,197,71,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 1100);
  const bot = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 700);
  bot.addColorStop(0, 'rgba(232,197,71,0.10)');
  bot.addColorStop(1, 'rgba(232,197,71,0)');
  ctx.fillStyle = bot; ctx.fillRect(0, 800, W, H - 800);

  const PAD = 96;
  const CW = W - PAD * 2;
  let y = 300; // inizia sotto la safe zone superiore di IG

  ctx.textAlign = 'center';

  // Brand + etichetta
  ctx.fillStyle = MUTED;
  ctx.font = '600 32px sans-serif';
  ctx.fillText('CINEMATIC SHUFFLE', W / 2, y);
  y += 64;
  ctx.fillStyle = MUTED;
  ctx.font = '400 34px sans-serif';
  ctx.fillText('IL MIO RITRATTO CINEFILO', W / 2, y);
  y += 110;

  // HERO: nome cinefilo (eventualmente su due righe)
  ctx.fillStyle = ACCENT;
  const heroLines = wrap(ctx, d.cinephileName, CW, '800 96px sans-serif', 2);
  ctx.font = '800 96px sans-serif';
  for (const line of heroLines) { ctx.fillText(line, W / 2, y); y += 104; }
  y += 8;
  if (d.cinephileSubtitle) {
    ctx.fillStyle = TEXT;
    ctx.font = '500 40px sans-serif';
    ctx.fillText(d.cinephileSubtitle, W / 2, y);
    y += 40;
  }
  // @nome
  ctx.fillStyle = MUTED;
  ctx.font = '400 34px sans-serif';
  ctx.fillText(truncate(ctx, d.name, CW, '400 34px sans-serif'), W / 2, y + 18);
  y += 90;

  // Statistiche (3 colonne)
  const stats: [string, string][] = [
    [String(d.watchedCount), 'titoli'],
    [d.totalHours > 0 ? `${d.totalHours}h` : '—', 'ore'],
    [d.topDecade ? decadeShort(d.topDecade) : '—', 'decade'],
  ];
  const colW = CW / 3;
  stats.forEach(([val, label], i) => {
    const cx = PAD + colW * i + colW / 2;
    ctx.fillStyle = ACCENT;
    ctx.font = '800 80px sans-serif';
    ctx.fillText(val, cx, y + 60);
    ctx.fillStyle = MUTED;
    ctx.font = '400 30px sans-serif';
    ctx.fillText(label, cx, y + 108);
  });
  y += 190;

  // GENERI con barre
  ctx.textAlign = 'left';
  sectionTitle(ctx, 'GENERI PIÙ VISTI', PAD, y); y += 56;
  const top5 = d.topGenres.slice(0, 5);
  const maxG = top5[0]?.count ?? 1;
  for (const g of top5) {
    ctx.fillStyle = TEXT;
    ctx.font = '600 40px sans-serif';
    ctx.fillText(g.name, PAD, y);
    const by = y + 24;
    ctx.fillStyle = SURFACE; roundRect(ctx, PAD, by, CW, 16, 8); ctx.fill();
    ctx.fillStyle = ACCENT; roundRect(ctx, PAD, by, Math.max(44, CW * (g.count / maxG)), 16, 8); ctx.fill();
    y += 92;
  }
  y += 24;

  // REGISTI e ATTORI (due colonne)
  const half = CW / 2;
  const startY = y;
  if (d.directors.length) {
    sectionTitle(ctx, 'REGISTI', PAD, y);
    let yy = y + 56;
    for (const name of d.directors.slice(0, 3)) {
      ctx.fillStyle = TEXT; ctx.font = '600 38px sans-serif';
      ctx.fillText(truncate(ctx, name, half - 30, '600 38px sans-serif'), PAD, yy);
      yy += 58;
    }
  }
  if (d.actors.length) {
    let yy = startY + 56;
    sectionTitle(ctx, 'ATTORI', PAD + half, startY);
    for (const name of d.actors.slice(0, 3)) {
      ctx.fillStyle = TEXT; ctx.font = '600 38px sans-serif';
      ctx.fillText(truncate(ctx, name, half - 30, '600 38px sans-serif'), PAD + half, yy);
      yy += 58;
    }
  }

  // Footer (sopra la safe zone inferiore di IG)
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.font = '700 38px sans-serif';
  ctx.fillText('🎬 Cinematic Shuffle', W / 2, H - 230);
  ctx.fillStyle = MUTED;
  ctx.font = '400 30px sans-serif';
  ctx.fillText('Crea il tuo ritratto cinefilo', W / 2, H - 185);

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.92));
  if (!blob) return;
  const file = new File([blob], 'ritratto-cinefilo.png', { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'Il mio ritratto cinefilo', text: 'Il mio ritratto cinefilo 🎬' });
      return;
    } catch { /* annullato → fallback */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ritratto-cinefilo.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function sectionTitle(ctx: CanvasRenderingContext2D, t: string, x: number, y: number) {
  ctx.fillStyle = MUTED;
  ctx.font = '600 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t, x, y);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// Manda a capo su più righe (max righe), troncando l'ultima.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string, maxLines: number): string[] {
  ctx.font = font;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) { cur = test; }
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) lines[maxLines - 1] = truncate(ctx, lines[maxLines - 1], maxW, font);
  return lines.length ? lines : [text];
}

function decadeShort(decade: string): string {
  const start = parseInt(decade);
  if (Number.isNaN(start)) return decade;
  return start >= 2000 ? `${start}` : `'${String(start).slice(2)}`;
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
