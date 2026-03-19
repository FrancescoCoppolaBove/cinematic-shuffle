/**
 * StarRating — supporta swipe orizzontale touch per mobile.
 * Il dito scorre sulle stelle e il rating si aggiorna in tempo reale.
 * Mezzo voto: la prima metà della stella vale N-0.5, la seconda N.
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
  const [liveValue, setLiveValue] = useState<number | null>(null);
  const isDragging = useRef(false);

  const displayed = liveValue ?? value ?? 0;

  // Calcola il rating (0.5 step) dalla posizione X relativa al container
  const ratingFromX = useCallback((clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const totalW = 5 * px + 4 * gap;
    const x = Math.max(0, Math.min(clientX - rect.left, totalW));
    const starW = px + gap;
    const starIndex = Math.floor(x / starW);        // 0-4
    const starOffset = x - starIndex * starW;       // 0..px+gap
    const half = starOffset < px / 2;
    const raw = half ? starIndex + 0.5 : starIndex + 1;
    return Math.max(0.5, Math.min(5, raw));
  }, [px, gap]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (readonly) return;
    isDragging.current = true;
    const r = ratingFromX(e.touches[0].clientX);
    setLiveValue(r);
  }, [readonly, ratingFromX]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || readonly) return;
    e.preventDefault();
    const r = ratingFromX(e.touches[0].clientX);
    setLiveValue(r);
  }, [readonly, ratingFromX]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current || readonly) return;
    isDragging.current = false;
    if (liveValue !== null) {
      // Tap sulla stessa stella = deseleziona
      onChange(liveValue === value ? null : liveValue);
    }
    setLiveValue(null);
  }, [readonly, liveValue, value, onChange]);

  // Mouse fallback for desktop
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    const r = ratingFromX(e.clientX);
    setLiveValue(r);
  }, [readonly, ratingFromX]);

  const onMouseLeave = useCallback(() => {
    if (!readonly) setLiveValue(null);
  }, [readonly]);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (readonly) return;
    const r = ratingFromX(e.clientX);
    onChange(r === value ? null : r);
    setLiveValue(null);
  }, [readonly, ratingFromX, value, onChange]);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center select-none', !readonly && 'cursor-pointer touch-none')}
      style={{ gap }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const full = displayed >= star;
        const half = !full && displayed >= star - 0.5;
        return (
          <StarShape key={star} size={px} fill={full ? 'full' : half ? 'half' : 'none'} />
        );
      })}
    </div>
  );
}

function StarShape({ size, fill }: { size: number; fill: 'none' | 'half' | 'full' }) {
  const id = `h${size}${fill}${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, transition: 'transform 0.05s', transform: fill !== 'none' ? 'scale(1.05)' : 'scale(1)' }}
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
        fill={fill === 'full' ? '#E8C547' : fill === 'half' ? `url(#${id})` : 'none'}
      />
    </svg>
  );
}
