import React from 'react';
import type { Tour } from '../types';
import { CATEGORY_BY_ID } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { formatRating, getRating } from '../store/selectors';
import { useAuthPrompt } from '../hooks/useAuthPrompt';
import { formatDuration, stopsLabel } from '../lib/format';
import { navigate } from '../lib/router';
import { SafeImage } from './ui/SafeImage';
import { Icon } from './ui/Icon';

/** Botón de favorito reutilizable (requiere sesión). */
export const FavoriteButton: React.FC<{ tourId: string; className?: string; variant?: 'heart' | 'bookmark' }> = ({
  tourId,
  className = '',
  variant = 'heart',
}) => {
  const { favoriteTourIds, toggleFavorite } = useAppStore();
  const promptLogin = useAuthPrompt();
  const saved = favoriteTourIds.includes(tourId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const r = toggleFavorite(tourId);
        if (!r.ok) promptLogin('Crea una cuenta o inicia sesión para guardar tus recorridos favoritos.');
      }}
      aria-label={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      aria-pressed={saved}
      className={`rounded-full bg-surface-container-lowest/90 backdrop-blur-xs flex items-center justify-center shadow-xs active:scale-90 transition-all ${className}`}
    >
      <Icon
        name={variant === 'heart' ? 'favorite' : 'bookmark'}
        fill={saved}
        className={`text-[20px] ${saved ? (variant === 'heart' ? 'text-error' : 'text-secondary') : 'text-primary'}`}
      />
    </button>
  );
};

/** Tarjeta vertical de recorrido (Explorar y Favoritos). */
export const TourCard: React.FC<{ tour: Tour }> = ({ tour }) => {
  const { ratings } = useAppStore();
  const rating = getRating(ratings, 'tour', tour.id);
  const cat = CATEGORY_BY_ID[tour.category];
  const open = () => navigate(`/recorrido/${tour.id}`);

  return (
    <article className="bg-surface-container-lowest rounded-2xl border border-outline-variant/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row lg:flex-col group h-full">
      <div onClick={open} className="relative md:w-5/12 lg:w-full h-52 md:h-auto lg:h-52 shrink-0 overflow-hidden bg-surface-container cursor-pointer">
        <SafeImage src={tour.coverImage} alt={tour.coverAlt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/95 text-secondary text-xs font-bold shadow-xs">
          <Icon name={cat.icon} className="text-[14px]" />
          {cat.label}
        </span>
        <FavoriteButton tourId={tour.id} className="absolute top-3 right-3 w-10 h-10" />
      </div>

      <div className="p-4 sm:p-5 flex flex-col justify-between flex-grow">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 onClick={open} className="font-serif font-bold text-xl text-primary leading-snug tracking-tight hover:text-secondary cursor-pointer transition-colors">
              {tour.title}
            </h2>
            <span className="flex items-center gap-1 bg-tertiary-fixed/40 px-2 py-0.5 rounded-md shrink-0">
              <Icon name="star" fill className="text-on-tertiary-container text-[16px]" />
              <span className="text-xs font-bold text-on-surface">{formatRating(rating.average)}</span>
              <span className="text-[11px] text-outline">({rating.count})</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-on-surface-variant text-xs mb-3 pb-2 border-b border-outline-variant/40">
            <span className="flex items-center gap-1"><Icon name="distance" className="text-[16px] text-primary" />{tour.distanceKm} km</span>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1"><Icon name="schedule" className="text-[16px] text-primary" />{formatDuration(tour.durationMin)}</span>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1"><Icon name="location_on" className="text-[16px] text-primary" />{stopsLabel(tour)}</span>
            <span className="text-outline">·</span>
            <span className="flex items-center gap-1"><Icon name="hiking" className="text-[16px] text-primary" />{tour.difficulty}</span>
          </div>
          <p className="text-sm text-on-surface-variant mb-4 leading-relaxed line-clamp-3">{tour.shortDescription}</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
          <span className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-fixed text-primary shrink-0">
              <Icon name={tour.specialFeature?.icon ?? 'headphones'} className="text-[16px]" />
            </span>
            <span className="text-xs text-primary font-semibold truncate">{tour.specialFeature?.label ?? 'Audioguía comunitaria'}</span>
          </span>
          <button
            type="button"
            onClick={open}
            className="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container active:scale-95 transition-all flex items-center gap-1.5 shadow-xs shrink-0"
          >
            Ver detalles <Icon name="arrow_forward" className="text-[16px]" />
          </button>
        </div>
      </div>
    </article>
  );
};
