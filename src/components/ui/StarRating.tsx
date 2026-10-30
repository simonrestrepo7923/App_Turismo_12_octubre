import React from 'react';
import { Icon } from './Icon';

export const StarDisplay: React.FC<{ value: number; className?: string }> = ({ value, className = 'text-[16px]' }) => (
  <span className="inline-flex items-center text-on-tertiary-container" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Icon key={n} name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star_half' : 'star'} fill={value >= n - 0.75} className={`${className} ${value >= n - 0.75 ? '' : 'text-outline-variant'}`} />
    ))}
  </span>
);

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
}

const LABELS = ['', 'Muy mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

/** Selector de calificación de 1 a 5 estrellas (VAL-001). */
export const StarInput: React.FC<StarInputProps> = ({ value, onChange, invalid }) => (
  <div className="flex items-center gap-2">
    <div
      role="radiogroup"
      aria-label="Calificación de 1 a 5 estrellas"
      className={`flex items-center gap-0.5 rounded-xl ${invalid ? 'ring-2 ring-error/60 px-1' : ''}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          onClick={() => onChange(n)}
          className="p-0.5 active:scale-90 transition-transform"
        >
          <Icon
            name="star"
            fill={n <= value}
            className={`text-[30px] ${n <= value ? 'text-on-tertiary-container' : 'text-outline-variant'}`}
          />
        </button>
      ))}
    </div>
    {value > 0 && <span className="text-xs font-semibold text-on-surface-variant">{LABELS[value]}</span>}
  </div>
);
