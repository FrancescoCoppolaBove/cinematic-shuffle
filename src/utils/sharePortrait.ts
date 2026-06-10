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
  let y = 320; // inizia sotto la safe zone superiore di IG

  ctx.textAlign = 'center';

  // Etichetta (niente nome app qui: resta solo in basso)
  ctx.fillStyle = MUTED;
  ctx.font = '500 36px sans-serif';
  ctx.fillText('IL MIO RITRATTO CINEFILO', W / 2, y);
  y += 96;

  // HERO: nome cinefilo con font adattivo (mai tagliato, max 2 righe)
  ctx.fillStyle = ACCENT;
  const hero = fitText(ctx, d.cinephileName, CW, 2, [104, 92, 80, 68, 58]);
  const heroLH = hero.size * 1.06;
  for (const line of hero.lines) { y += heroLH * 0.78; ctx.fillText(line, W / 2, y); y += heroLH * 0.22; }
  y += 24;

  if (d.cinephileSubtitle) {
    ctx.fillStyle = TEXT;
    ctx.font = '600 44px sans-serif';
    ctx.fillText(d.cinephileSubtitle, W / 2, y);
    y += 52;
  }
  // @nome
  ctx.fillStyle = MUTED;
  ctx.font = '400 34px sans-serif';
  ctx.fillText(truncate(ctx, d.name, CW, '400 34px sans-serif'), W / 2, y);
  y += 80;

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
  sectionTitle(ctx, 'GENERI PIÙ VISTI', PAD, y); y += 50;
  const top5 = d.topGenres.slice(0, 5);
  const maxG = top5[0]?.count ?? 1;
  for (const g of top5) {
    ctx.fillStyle = TEXT;
    ctx.font = '600 38px sans-serif';
    ctx.fillText(truncate(ctx, g.name, CW, '600 38px sans-serif'), PAD, y);
    const by = y + 22;
    ctx.fillStyle = SURFACE; roundRect(ctx, PAD, by, CW, 14, 7); ctx.fill();
    ctx.fillStyle = ACCENT; roundRect(ctx, PAD, by, Math.max(40, CW * (g.count / maxG)), 14, 7); ctx.fill();
    y += 82;
  }
  y += 20;

  // REGISTI e ATTORI (due colonne)
  const half = CW / 2;
  const startY = y;
  const drawPeople = (title: string, names: string[], x: number) => {
    sectionTitle(ctx, title, x, startY);
    let yy = startY + 52;
    for (const name of names.slice(0, 3)) {
      ctx.fillStyle = TEXT; ctx.font = '600 36px sans-serif';
      ctx.fillText(truncate(ctx, name, half - 24, '600 36px sans-serif'), x, yy);
      yy += 56;
    }
  };
  if (d.directors.length) drawPeople('REGISTI', d.directors, PAD);
  if (d.actors.length) drawPeople('ATTORI', d.actors, PAD + half);

  // Footer: nome app SOLO qui (sopra la safe zone inferiore di IG)
  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = '400 32px sans-serif';
  ctx.fillText('Crea il tuo ritratto cinefilo con', W / 2, H - 250);
  ctx.fillStyle = ACCENT;
  ctx.font = '800 46px sans-serif';
  ctx.fillText('🎬 CINEMATIC SHUFFLE', W / 2, H - 196);

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

// Manda a capo (greedy) senza perdere parole.
function greedyWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

// Sceglie il font più grande (tra i candidati) per cui il testo sta in ≤ maxLines.
// Imposta ctx.font sul valore scelto. Garantisce che il testo non venga tagliato.
function fitText(
  ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, sizes: number[],
  weight = '800', family = 'sans-serif',
): { lines: string[]; size: number } {
  for (const size of sizes) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = greedyWrap(ctx, text, maxW);
    if (lines.length <= maxLines) return { lines, size };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `${weight} ${size}px ${family}`;
  let lines = greedyWrap(ctx, text, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = truncate(ctx, lines[maxLines - 1], maxW, ctx.font);
  }
  return { lines, size };
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
