import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  fill?: boolean;
  style?: React.CSSProperties;
}

/** Ícono de Material Symbols (la fuente se carga en index.html). */
export const Icon: React.FC<IconProps> = ({ name, className = '', fill = false, style }) => (
  <span className={`material-symbols-outlined ${className}`} data-fill={fill ? '1' : '0'} aria-hidden="true" style={style}>
    {name}
  </span>
);
