/**
 * StarRating — completamente riscritto.
 *
 * PRINCIPIO: un solo path, nessuna doppia chiamata.
 *
 * Mobile (touch):
 *   - touchstart: salva posizione iniziale, mostra preview
 *   - touchmove: se si muove > 8px = è uno swipe, aggiorna preview
 *   - touchend: chiama onChange UNA sola volta, poi chiama e.preventDefault()
 *     per bloccare il click sintetico che iOS genera dopo touchend
 *
 * Desktop (mouse):
 *   - mousemove: preview
 *   - click: onChange
 *   - mouseleave: reset preview
 */
import { useState, useRef } from 'react';
import { cn } from '../utils';

interface StarRatingProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = { sm: 16, md: 22, lg: 32, xl: 48 };
const GAP_MAP  = { sm: 4,  md: 6,  lg: 8,  xl: 10 };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const px = SIZE_MAP[size];
  const gap = GAP_MAP[size];
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number | null>(null);

  // Track touch state in refs (no re-render needed)
  const touchActive = useRef(false);
  const touchMoved = useRef(false);
  const touchStartX = useRef(0);

  const displayed = preview ?? value ?? 0;

  function xToRating(clientX: number): number {
    const el = ref.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const starW = px + gap;
    const x = Math.max(0, Math.min(clientX - rect.left, 5 * px + 4 * gap - 0.1));
    const idx = Math.floor(x / starW);         // 0–4
    const off = x - idx * starW;               // posizione dentro la stella
    const half = off < px * 0.5;
    return half ? idx + 0.5 : idx + 1;
  }

  // ── Touch ──────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (readonly) return;
    touchActive.current = true;
    touchMoved.current = false;
    touchStartX.current = e.touches[0].clientX;
    setPreview(xToRating(e.touches[0].clientX));
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchActive.current || readonly) return;
    if (Math.abs(e.touches[0].clientX - touchStartX.current) > 8) {
      touchMoved.current = true;
    }
    setPreview(xToRating(e.touches[0].clientX));
    if (touchMoved.current) e.preventDefault();
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchActive.current || readonly) return;
    
    // CRITICO: preventDefault impedisce a iOS di generare il click sintetico
    // che altrimenti chiamerebbe onChange una seconda volta resettando il voto
    e.preventDefault();

    touchActive.current = false;
    const r = xToRating(e.changedTouches[0].clientX);
    setPreview(null);
    onChange(r === value ? null : r);
    touchMoved.current = false;
  }

  // ── Mouse ──────────────────────────────────────────────────────
  function handleMouseMove(e: React.MouseEvent) {
    if (readonly) return;
    setPreview(xToRating(e.clientX));
  }

  function handleMouseLeave() {
    if (!readonly) setPreview(null);
  }

  function handleClick(e: React.MouseEvent) {
    // Su mobile, dopo touchend arriva anche click — lo ignoriamo
    // se c'è stato un touch recente (touchActive è già false ma possiamo
    // controllare con un flag dedicato)
    if (readonly) return;
    const r = xToRating(e.clientX);
    onChange(r === value ? null : r);
    setPreview(null);
  }

  return (
    <div
      ref={ref}
      className={cn('flex items-center select-none', !readonly && 'cursor-pointer touch-none')}
      style={{ gap }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const full = displayed >= star;
        const half = !full && displayed >= star - 0.5;
        return (
          <StarSVG key={star} size={px} fill={full ? 'full' : half ? 'half' : 'none'} />
        );
      })}
    </div>
  );
}

function StarSVG({ size, fill }: { size: number; fill: 'none' | 'half' | 'full' }) {
  const gradId = `g${size}`;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      style={{ flexShrink: 0, transition: 'transform 0.07s', transform: fill !== 'none' ? 'scale(1.1)' : 'scale(1)' }}
    >
      {fill === 'half' && (
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="#E8C547" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        stroke={fill !== 'none' ? '#E8C547' : '#3A3A52'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={fill === 'full' ? '#E8C547' : fill === 'half' ? `url(#${gradId})` : 'none'}
      />
    </svg>
  );
}
