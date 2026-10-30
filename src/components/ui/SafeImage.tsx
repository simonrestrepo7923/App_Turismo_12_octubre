import React, { useState } from 'react';
import { Icon } from './Icon';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: string;
}

/**
 * Imagen con respaldo: si la URL falla (sin conexión, enlace roto) muestra un
 * fondo ilustrado en vez de un ícono de imagen rota.
 */
export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '', fallbackIcon = 'landscape', ...rest }) => {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-fixed via-surface-container to-secondary-fixed text-primary/50`}
      >
        <Icon name={fallbackIcon} className="text-3xl" />
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailedSrc(src)} {...rest} />;
};
