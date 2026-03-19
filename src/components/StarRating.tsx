import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../utils';

interface StarRatingProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 14, md: 18, lg: 24 };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const px = SIZE_MAP[size];

  const active = hovered ?? value ?? 0;

  function handleClick(star: number) {
    if (readonly) return;
    // Click sulla stessa stella → deseleziona (rimuove voto)
    onChange(value === star ? null : star);
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => !readonly && setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          className={cn(
            'transition-transform',
            !readonly && 'hover:scale-110 active:scale-95 cursor-pointer',
            readonly && 'cursor-default'
          )}
          title={readonly ? `${value ?? 0}/5` : `Voto ${star}/5`}
        >
          <Star
            size={px}
            className={cn(
              'transition-colors duration-100',
              star <= active
                ? 'text-film-accent'
                : 'text-film-border'
            )}
            fill={star <= active ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        </button>
      ))}
      {!readonly && value !== null && (
        <span className="text-film-subtle text-xs ml-1 tabular-nums">{value}/5</span>
      )}
    </div>
  );
}
