/**
 * StarRating — doppia modalità input:
 * 1. Click/tap diretto su ogni stella → voto intero o mezzo voto
 * 2. Swipe orizzontale touch → scorrimento fluido con mezzo voto
 *
 * Ogni stella è divisa in due zone cliccabili (sinistra = N-0.5, destra = N).
 * Lo swipe usa lo stesso calcolo con ratingFromX.
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
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const isDragging = useRef(false);
  // Track if the touch was a swipe (moved more than threshold) vs a tap
  const touchStartX = useRef<number>(0);
  const hasMoved = useRef(false);

  const displayed = hoverValue ?? value ?? 0;

  // Calcola rating dalla posizione X assoluta rispetto al container
  const ratingFromX = useCallback((clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const totalW = 5 * px + 4 * gap;
    const x = Math.max(0, Math.min(clientX - rect.left, totalW));
    const starW = px + gap;
    const starIdx = Math.min(4, Math.floor(x / starW));
    const offset = x - starIdx * starW;
    const isHalf = offset < px * 0.5;
    const raw = isHalf ? starIdx + 0.5 : starIdx + 1;
    return Math.max(0.5, Math.min(5, raw));
  }, [px, gap]);

  // ── Touch: swipe ────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (readonly) return;
    isDragging.current = true;
    hasMoved.current = false;
    touchStartX.current = e.touches[0].clientX;
    const r = ratingFromX(e.touches[0].clientX);
    setHoverValue(r);
  }, [readonly, ratingFromX]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || readonly) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (dx > 4) {
      hasMoved.current = true;
      e.preventDefault(); // blocca scroll solo se è uno swipe sulle stelle
    }
    const r = ratingFromX(e.touches[0].clientX);
    setHoverValue(r);
  }, [readonly, ratingFromX]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current || readonly) return;
    isDragging.current = false;
    const current = hoverValue;
    setHoverValue(null);
    if (current !== null) {
      // Tap (no movement) → se stessa stella già selezionata, deseleziona
      onChange(current === value ? null : current);
    }
  }, [readonly, hoverValue, value, onChange]);

  // ── Mouse hover + click (desktop) ──────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    setHoverValue(ratingFromX(e.clientX));
  }, [readonly, ratingFromX]);

  const onMouseLeave = useCallback(() => {
    if (!readonly) setHoverValue(null);
  }, [readonly]);

  const onMouseClick = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    const r = ratingFromX(e.clientX);
    onChange(r === value ? null : r);
    setHoverValue(null);
  }, [readonly, ratingFromX, value, onChange]);

  // ── Direct tap on star half (mobile backup) ────────────────────
  // Ogni stella ha due bottoni: metà sinistra (N-0.5) e metà destra (N)
  const onStarHalfTap = useCallback((rating: number, e: React.TouchEvent) => {
    if (readonly) return;
    e.stopPropagation();
    // Solo se non era uno swipe
    if (!hasMoved.current) {
      onChange(rating === value ? null : rating);
    }
  }, [readonly, value, onChange]);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center select-none', !readonly && 'touch-none')}
      style={{ gap }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onMouseClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const fullVal = star;
        const halfVal = star - 0.5;
        const isFull = displayed >= star;
        const isHalf = !isFull && displayed >= star - 0.5;

        return (
          <div
            key={star}
            className={cn('relative', !readonly && 'cursor-pointer')}
            style={{ width: px, height: px, flexShrink: 0 }}
          >
            {/* Star SVG */}
            <StarShape size={px} fill={isFull ? 'full' : isHalf ? 'half' : 'none'} />

            {/* Invisible touch targets: left half = N-0.5, right half = N */}
            {!readonly && (
              <>
                <span
                  className="absolute inset-y-0 left-0 w-1/2"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onTouchEnd={(e) => onStarHalfTap(halfVal, e)}
                />
                <span
                  className="absolute inset-y-0 right-0 w-1/2"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onTouchEnd={(e) => onStarHalfTap(fullVal, e)}
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
  // Usiamo un id stabile basato su size+fill per evitare flicker
  const id = `sg-${size}-${fill}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        flexShrink: 0,
        transition: 'transform 0.08s ease',
        transform: fill !== 'none' ? 'scale(1.08)' : 'scale(1)',
      }}
    >
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
        fill={
          fill === 'full' ? '#E8C547' :
          fill === 'half' ? `url(#${id})` :
          'none'
        }
      />
    </svg>
  );
}
