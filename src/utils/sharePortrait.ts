/**
 * sharePortrait — genera un'immagine (canvas) del "ritratto cinefilo" e la
 * condivide con la Web Share API (file). Fallback: download del PNG.
 */
export interface PortraitData {
  name: string;
  tasteLabel: string | null;
  watchedCount: number;
  topGenres: { name: string; count: number }[];
  topDecade?: string;
  topLang?: string | null;
  totalHours: number;
  topDirector?: string | null;
  topActor?: string | null;
}

const BG = '#0A0A0F';
const SURFACE = '#16161F';
const ACCENT = '#E8C547';
const TEXT = '#EDEDF0';
const MUTED = '#8A8A99';

export async function sharePortrait(d: PortraitData): Promise<void> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Sfondo
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // Bagliore accent in alto
  const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 700);
  grad.addColorStop(0, 'rgba(232,197,71,0.18)');
  grad.addColorStop(1, 'rgba(232,197,71,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 700);

  const PAD = 80;
  let y = 130;

  // Header brand
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '600 30px sans-serif';
  ctx.fillText('CINEMATIC SHUFFLE', PAD, y);
  y += 70;

  // Nome + sottotitolo
  ctx.fillStyle = TEXT;
  ctx.font = '700 70px sans-serif';
  ctx.fillText(truncate(ctx, d.name || 'Il mio profilo', W - PAD * 2, '700 70px sans-serif'), PAD, y);
  y += 50;
  ctx.fillStyle = MUTED;
  ctx.font = '400 34px sans-serif';
  ctx.fillText('Ritratto cinefilo', PAD, y);
  y += 90;

  // Etichetta di gusto (badge grande)
  if (d.tasteLabel) {
    ctx.fillStyle = ACCENT;
    ctx.font = '800 88px sans-serif';
    ctx.fillText(truncate(ctx, d.tasteLabel, W - PAD * 2, '800 88px sans-serif'), PAD, y);
    y += 110;
  }

  // Tre numeri chiave
  y += 10;
  const stats: [string, string][] = [
    [String(d.watchedCount), 'titoli visti'],
    [d.totalHours > 0 ? `${d.totalHours}h` : '—', 'ore'],
    [d.topDecade ? decadeShort(d.topDecade) : '—', 'decade top'],
  ];
  const colW = (W - PAD * 2) / 3;
  stats.forEach(([val, label], i) => {
    const cx = PAD + colW * i;
    ctx.textAlign = 'left';
    ctx.fillStyle = ACCENT;
    ctx.font = '800 76px sans-serif';
    ctx.fillText(val, cx, y);
    ctx.fillStyle = MUTED;
    ctx.font = '400 28px sans-serif';
    ctx.fillText(label, cx, y + 42);
  });
  y += 130;

  // Generi preferiti con barre
  ctx.fillStyle = MUTED;
  ctx.font = '600 28px sans-serif';
  ctx.fillText('GENERI PREFERITI', PAD, y);
  y += 50;
  const top = d.topGenres.slice(0, 5);
  const maxG = top[0]?.count ?? 1;
  const barMaxW = W - PAD * 2;
  for (const g of top) {
    ctx.fillStyle = TEXT;
    ctx.font = '600 38px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(g.name, PAD, y);
    // barra
    const by = y + 22;
    ctx.fillStyle = SURFACE;
    roundRect(ctx, PAD, by, barMaxW, 16, 8); ctx.fill();
    ctx.fillStyle = ACCENT;
    roundRect(ctx, PAD, by, Math.max(40, barMaxW * (g.count / maxG)), 16, 8); ctx.fill();
    y += 86;
  }

  // Regista / attore / cinema
  y += 20;
  const lines: [string, string][] = [];
  if (d.topDirector) lines.push(['Regista più visto', d.topDirector]);
  if (d.topActor) lines.push(['Attore più visto', d.topActor]);
  if (d.topLang) lines.push(['Cinematografia', d.topLang]);
  for (const [label, val] of lines) {
    ctx.fillStyle = MUTED;
    ctx.font = '400 28px sans-serif';
    ctx.fillText(label, PAD, y);
    ctx.fillStyle = TEXT;
    ctx.font = '700 40px sans-serif';
    ctx.fillText(truncate(ctx, val, W - PAD * 2, '700 40px sans-serif'), PAD, y + 44);
    y += 96;
  }

  // Footer
  ctx.fillStyle = MUTED;
  ctx.font = '400 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎬 Crea il tuo su Cinematic Shuffle', W / 2, H - 70);

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.92));
  if (!blob) return;
  const file = new File([blob], 'ritratto-cinefilo.png', { type: 'image/png' });

  // Web Share con file, se supportato
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'Il mio ritratto cinefilo' });
      return;
    } catch { /* annullato o non riuscito → fallback download */ }
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ritratto-cinefilo.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
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
