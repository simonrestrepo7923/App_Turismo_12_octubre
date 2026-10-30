import type { CategoryId } from '../types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  /** Nombre corto para chips y filtros. */
  shortLabel: string;
  icon: string;
  emoji: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'historico', label: 'Histórico & Memoria', shortLabel: 'Históricos', icon: 'history_edu', emoji: '🏛️' },
  { id: 'recreacion', label: 'Parques & Recreación', shortLabel: 'Recreativos', icon: 'park', emoji: '🌳' },
  { id: 'gastronomia', label: 'Gastronomía Viva', shortLabel: 'Gastronómicos', icon: 'restaurant', emoji: '🍽️' },
  { id: 'musica', label: 'Música & Cultura', shortLabel: 'Culturales', icon: 'music_note', emoji: '🎵' },
  { id: 'miradores', label: 'Miradores Naturales', shortLabel: 'Miradores', icon: 'landscape', emoji: '🌿' },
];

export const CATEGORY_BY_ID: Record<CategoryId, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;

export const isCategoryId = (value: string | null | undefined): value is CategoryId =>
  !!value && value in CATEGORY_BY_ID;
