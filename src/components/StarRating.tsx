import { useState } from 'react';
import { cn } from '../utils';

interface StarRatingProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 14, md: 18, lg: 26 };

// Renders half-star ratings (0.5 increments)
export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const px = SIZE_MAP[size];
  const active = hovered ?? value ?? 0;

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    if (readonly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    setHovered(isLeft ? star - 0.5 : star);
  }

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, star: number) {
    if (readonly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    const rating = isLeft ? star - 0.5 : star;
    onChange(value === rating ? null : rating);
  }

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => !readonly && setHovered(null)}>
      {[1, 2, 3, 4, 5].map(star => {
        const full  = active >= star;
        const half  = !full && active >= star - 0.5;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseMove={e => handleMouseMove(e, star)}
            onClick={e => handleClick(e, star)}
            className={cn('relative transition-transform', !readonly && 'hover:scale-110 cursor-pointer', readonly && 'cursor-default')}
            style={{ width: px, height: px }}
          >
            {/* Background star (empty) */}
            <StarSVG size={px} fill="none" className="text-film-border absolute inset-0" />
            {/* Full fill */}
            {full && <StarSVG size={px} fill="full" className="text-film-accent absolute inset-0" />}
            {/* Half fill */}
            {half && <StarSVG size={px} fill="half" className="text-film-accent absolute inset-0" />}
          </button>
        );
      })}
      {!readonly && value !== null && (
        <span className="text-film-subtle text-xs ml-1.5 tabular-nums">{value}/5</span>
      )}
    </div>
  );
}

function StarSVG({ size, fill, className }: { size: number; fill: 'none' | 'half' | 'full'; className: string }) {
  const id = `half-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {fill === 'half' && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={
          fill === 'full' ? 'currentColor' :
          fill === 'half' ? `url(#${id})` :
          'none'
        }
      />
    </svg>
  );
}
