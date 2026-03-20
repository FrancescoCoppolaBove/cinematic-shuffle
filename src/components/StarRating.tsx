/**
 * StarRating — tap diretto su stella + swipe orizzontale.
 *
 * ARCHITETTURA:
 * - touchstart sul container: inizia tracking, mostra preview
 * - touchmove sul container: aggiorna preview (swipe)
 * - touchend sul container: se hasMoved → conferma swipe; se tap → ignora (gestito dagli span)
 * - onTouchEnd sugli span invisibili: gestisce il tap preciso (sinistra = N-0.5, destra = N)
 *
 * I due path si escludono via hasMoved.current.
 */
import { useState, useRef, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const hasMoved = useRef(false);
  const startX = useRef(0);

  const displayed = preview ?? value ?? 0;

  const ratingFromX = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const totalW = 5 * px + 4 * gap;
    const x = Math.max(0, Math.min(clientX - rect.left, totalW));
    const starW = px + gap;
    const starIdx = Math.min(4, Math.floor(x / starW));
    const offset = x - starIdx * starW;
    const half = offset < px * 0.5;
    return Math.max(0.5, Math.min(5, half ? starIdx + 0.5 : starIdx + 1));
  }, [px, gap]);

  // ── SWIPE path ────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (readonly) return;
    hasMoved.current = false;
    startX.current = e.touches[0].clientX;
    setPreview(ratingFromX(e.touches[0].clientX));
  }, [readonly, ratingFromX]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (readonly) return;
    if (Math.abs(e.touches[0].clientX - startX.current) > 6) {
      hasMoved.current = true;
      e.preventDefault();
    }
    setPreview(ratingFromX(e.touches[0].clientX));
  }, [readonly, ratingFromX]);

  // touchend sul container: solo per lo swipe
  const onTouchEnd = useCallback(() => {
    if (readonly) return;
    if (hasMoved.current) {
      // Era uno swipe → conferma il valore mostrato
      const r = preview;
      setPreview(null);
      if (r !== null) onChange(r === value ? null : r);
    } else {
      // Era un tap → lo gestiscono gli span, qui resettiamo solo il preview
      setPreview(null);
    }
    hasMoved.current = false;
  }, [readonly, preview, value, onChange]);

  // ── TAP path: span invisibili su ogni metà stella ─────────────
  const onHalfTap = useCallback((rating: number) => (e: React.TouchEvent) => {
    if (readonly) return;
    e.stopPropagation();
    // Solo se non era uno swipe
    if (!hasMoved.current) {
      onChange(rating === value ? null : rating);
    }
  }, [readonly, value, onChange]);

  // ── MOUSE (desktop) ───────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    setPreview(ratingFromX(e.clientX));
  }, [readonly, ratingFromX]);

  const onMouseLeave = useCallback(() => {
    if (!readonly) setPreview(null);
  }, [readonly]);

  const onMouseClick = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    const r = ratingFromX(e.clientX);
    onChange(r === value ? null : r);
    setPreview(null);
  }, [readonly, ratingFromX, value, onChange]);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center select-none', !readonly && 'cursor-pointer touch-none')}
      style={{ gap }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onMouseClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const isFull = displayed >= star;
        const isHalf = !isFull && displayed >= star - 0.5;
        return (
          <div
            key={star}
            className="relative"
            style={{ width: px, height: px, flexShrink: 0 }}
          >
            <StarShape size={px} fill={isFull ? 'full' : isHalf ? 'half' : 'none'} />
            {/* Touch targets: sinistra = mezzo voto, destra = voto intero */}
            {!readonly && (
              <>
                <span
                  className="absolute inset-y-0 left-0 w-1/2"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onTouchEnd={onHalfTap(star - 0.5)}
                />
                <span
                  className="absolute inset-y-0 right-0 w-1/2"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onTouchEnd={onHalfTap(star)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarShape({ size, fill }: { size: number; fill: 'none' | 'half' | 'full' }) {
  const id = `sgr-${size}-${fill}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      style={{ flexShrink: 0, transition: 'transform 0.07s', transform: fill !== 'none' ? 'scale(1.08)' : 'scale(1)' }}>
      {fill === 'half' && (
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
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
        fill={fill === 'full' ? '#E8C547' : fill === 'half' ? `url(#${id})` : 'none'}
      />
    </svg>
  );
}
