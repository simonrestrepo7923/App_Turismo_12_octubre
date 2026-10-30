import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryId, Difficulty, DistanceRange, DurationRange } from '../types';
import { CATEGORIES, CATEGORY_BY_ID, isCategoryId } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { getRating } from '../store/selectors';
import { distanceRange, durationRange, normalizeText } from '../lib/format';
import { navigate } from '../lib/router';
import { TourCard } from '../components/TourCard';
import { SafeImage } from '../components/ui/SafeImage';
import { Icon } from '../components/ui/Icon';

/**
 * Explorador de recorridos.
 * CONS-001: listado por categoría temática.
 * BUSC-001: búsqueda y filtros por categoría, duración, distancia y dificultad,
 *           con mensaje y sugerencias cuando no hay resultados.
 */

type Sort = 'populares' | 'duracion' | 'distancia' | 'valorados';

const DURATIONS: { id: DurationRange; label: string }[] = [
  { id: '<1h', label: '< 1 h' },
  { id: '1h-2h', label: '1 – 2 h' },
  { id: '+2h', label: '+ 2 h' },
];
const DISTANCES: { id: DistanceRange; label: string }[] = [
  { id: '<2km', label: '< 2 km' },
  { id: '2-5km', label: '2 – 5 km' },
  { id: '+5km', label: '+ 5 km' },
];
const DIFFICULTIES: Difficulty[] = ['Fácil', 'Moderado', 'Exigente'];

interface ExploreViewProps {
  initialQuery: string;
  initialCategory: string | null;
  openFilters: boolean;
  focusSearch: boolean;
  onOpenProposeModal: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ initialQuery, initialCategory, openFilters, focusSearch, onOpenProposeModal }) => {
  const { tours, points, ratings } = useAppStore();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryId | 'todos'>(isCategoryId(initialCategory) ? initialCategory : 'todos');
  const [duration, setDuration] = useState<DurationRange | 'todos'>('todos');
  const [distance, setDistance] = useState<DistanceRange | 'todos'>('todos');
  const [difficulty, setDifficulty] = useState<Difficulty | 'todos'>('todos');
  const [sort, setSort] = useState<Sort>('populares');
  const [showFilters, setShowFilters] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openFilters) setShowFilters(true);
    if (focusSearch) searchRef.current?.focus();
  }, [openFilters, focusSearch]);

  const q = normalizeText(query.trim());

  const results = useMemo(() => {
    const list = tours.filter((t) => {
      if (category !== 'todos' && t.category !== category) return false;
      if (duration !== 'todos' && durationRange(t.durationMin) !== duration) return false;
      if (distance !== 'todos' && distanceRange(t.distanceKm) !== distance) return false;
      if (difficulty !== 'todos' && t.difficulty !== difficulty) return false;
      if (q) {
        const pointText = t.pointIds.map((id) => points.find((p) => p.id === id)?.title ?? '').join(' ');
        const haystack = normalizeText([t.title, t.shortDescription, CATEGORY_BY_ID[t.category].label, t.curatorName, pointText].join(' '));
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const rating = (id: string) => getRating(ratings, 'tour', id);
    return [...list].sort((a, b) => {
      if (sort === 'duracion') return a.durationMin - b.durationMin;
      if (sort === 'distancia') return a.distanceKm - b.distanceKm;
      if (sort === 'valorados') return rating(b.id).average - rating(a.id).average;
      return rating(b.id).count - rating(a.id).count;
    });
  }, [tours, points, ratings, category, duration, distance, difficulty, q, sort]);

  // Búsqueda manual de lugares (alternativa cuando un QR no se puede leer).
  const matchingPoints = useMemo(() => {
    if (!q) return [];
    return points
      .filter((p) => normalizeText([p.title, p.subtitle, p.kindLabel, p.address ?? '', p.tags.join(' ')].join(' ')).includes(q))
      .slice(0, 6);
  }, [points, q]);

  const activeFilters = [
    category !== 'todos' && { key: 'cat', label: CATEGORY_BY_ID[category].shortLabel, clear: () => setCategory('todos') },
    duration !== 'todos' && { key: 'dur', label: `Duración ${DURATIONS.find((d) => d.id === duration)?.label}`, clear: () => setDuration('todos') },
    distance !== 'todos' && { key: 'dist', label: `Distancia ${DISTANCES.find((d) => d.id === distance)?.label}`, clear: () => setDistance('todos') },
    difficulty !== 'todos' && { key: 'dif', label: difficulty, clear: () => setDifficulty('todos') },
    q && { key: 'q', label: `«${query.trim()}»`, clear: () => setQuery('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const resetAll = () => {
    setQuery('');
    setCategory('todos');
    setDuration('todos');
    setDistance('todos');
    setDifficulty('todos');
  };

  return (
    <div className="flex-grow w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 pt-4 lg:pt-8 pb-32 lg:pb-12">
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold tracking-wide">
            <Icon name="signpost" className="text-[14px]" />
            GUÍA COMUNITARIA
          </span>
          <span className="text-on-surface-variant text-xs font-semibold">Comuna 6, Medellín</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-primary font-bold tracking-tight mb-1.5 leading-tight">Explora el territorio</h1>
        <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Encuentra caminatas culturales guiadas por la memoria local, archivos vivos y senderos narrados por sus propios habitantes.
        </p>
      </section>

      <section className="mb-4 flex items-center gap-2" role="search">
        <div className="relative flex-grow">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none" />
          <label htmlFor="explore-search" className="sr-only">Buscar recorridos y lugares</label>
          <input
            id="explore-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por lugar, barrio o dirección…"
            className="w-full pl-10 pr-10 py-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-xs"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary">
              <Icon name="close" className="text-[20px]" />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((s) => !s)}
          className={`relative flex items-center justify-center w-12 h-12 rounded-xl border border-outline-variant/80 text-primary active:scale-95 transition-all shadow-xs shrink-0 ${
            showFilters ? 'bg-surface-container' : 'bg-surface-container-lowest'
          }`}
        >
          <Icon name="tune" className="text-[22px]" />
          {activeFilters.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary" />}
        </button>
      </section>

      <section className="mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto hide-scrollbar" aria-label="Categorías">
        <div className="flex items-center gap-2 min-w-max pb-1">
          <CategoryChip active={category === 'todos'} onClick={() => setCategory('todos')} label="Todos" count={tours.length} />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.shortLabel}
              emoji={c.emoji}
              count={tours.filter((t) => t.category === c.id).length}
            />
          ))}
        </div>
      </section>

      {showFilters && (
        <section className="mb-5 p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 animate-fade-in space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
          <Segmented label="Duración" icon="schedule" value={duration} onChange={setDuration} options={DURATIONS} />
          <Segmented label="Distancia" icon="straighten" value={distance} onChange={setDistance} options={DISTANCES} />
          <Segmented label="Dificultad" icon="hiking" value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((d) => ({ id: d, label: d }))} />
        </section>
      )}

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs sm:text-sm text-on-surface flex items-center gap-2" aria-live="polite">
          <span className="w-2 h-2 rounded-full bg-primary-container inline-block" />
          <span>
            <span className="font-bold text-primary">
              {results.length} {results.length === 1 ? 'recorrido comunitario' : 'recorridos comunitarios'}
            </span>{' '}
            {results.length === 1 ? 'encontrado' : 'encontrados'}
          </span>
        </p>
        <label className="flex items-center gap-1 text-on-surface-variant text-xs">
          <Icon name="swap_vert" className="text-[18px]" />
          <span className="sr-only sm:not-sr-only">Ordenar:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent border-none text-primary font-bold py-0 pl-1 pr-1 cursor-pointer text-xs focus:outline-none">
            <option value="populares">Más populares</option>
            <option value="valorados">Mejor valorados</option>
            <option value="duracion">Menor duración</option>
            <option value="distancia">Menor distancia</option>
          </select>
        </label>
      </div>

      {matchingPoints.length > 0 && (
        <section className="mb-6" aria-label="Lugares que coinciden">
          <h2 className="text-xs font-bold uppercase tracking-wider text-outline mb-2">Puntos de interés que coinciden</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {matchingPoints.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/punto/${p.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary text-left"
              >
                <SafeImage src={p.images[0]} alt={p.imageAlt} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-primary truncate">{p.title}</span>
                  <span className="block text-xs text-on-surface-variant truncate">{p.kindLabel}</span>
                </span>
                <Icon name="chevron_right" className="ml-auto text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={results.length === 0 ? '' : 'grid gap-6 lg:grid-cols-2 2xl:grid-cols-3'}>
        {results.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-surface-container rounded-2xl border border-outline-variant/60 flex flex-col items-center">
            <Icon name="travel_explore" className="text-4xl text-outline mb-2" />
            <h3 className="font-serif text-xl font-bold text-primary mb-1">No hay recorridos con estos criterios</h3>
            <p className="text-sm text-on-surface-variant mb-4 max-w-md">
              Ajusta los filtros para ver más opciones. Puedes quitar alguno de estos:
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {activeFilters.map((f) => (
                <button key={f.key} type="button" onClick={f.clear} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant text-xs font-semibold text-primary hover:border-error hover:text-error">
                  {f.label} <Icon name="close" className="text-[14px]" />
                </button>
              ))}
            </div>
            <button type="button" onClick={resetAll} className="px-5 py-2.5 rounded-full bg-primary text-white text-xs font-bold">
              Restablecer todos los filtros
            </button>
          </div>
        ) : (
          results.map((tour) => <TourCard key={tour.id} tour={tour} />)
        )}
      </div>

      <section className="mt-12 p-5 sm:p-6 rounded-2xl bg-surface-container border border-outline-variant/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
            <Icon name="record_voice_over" className="text-[28px]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-primary tracking-tight">¿Conoces una historia que deba ser contada?</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Postula una nueva parada de memoria para la próxima edición comunitaria.</p>
          </div>
        </div>
        <button type="button" onClick={onOpenProposeModal} className="px-5 py-2.5 rounded-full border border-secondary text-secondary hover:bg-secondary/10 active:scale-95 text-xs font-bold transition-all shrink-0">
          Proponer punto de interés
        </button>
      </section>
    </div>
  );
};

const CategoryChip: React.FC<{ active: boolean; onClick: () => void; label: string; count: number; emoji?: string }> = ({ active, onClick, label, count, emoji }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-4 py-2 rounded-full text-xs flex items-center gap-1.5 active:scale-95 transition-all ${
      active
        ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed ring-1 ring-tertiary-container shadow-xs font-bold'
        : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container font-semibold'
    }`}
  >
    {emoji && <span aria-hidden="true">{emoji}</span>}
    {label}
    <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold px-1.5 rounded-full">{count}</span>
  </button>
);

function Segmented<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: string;
  value: T | 'todos';
  onChange: (v: T | 'todos') => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2" role="group" aria-label={label}>
      <span className="text-[11px] font-bold text-outline flex items-center gap-1 uppercase">
        <Icon name={icon} className="text-[15px]" />
        {label}
      </span>
      <div className="flex sm:inline-flex rounded-lg bg-surface-container p-0.5 border border-outline-variant/40 text-xs">
        {[{ id: 'todos' as const, label: 'Todas' }, ...options].map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded whitespace-nowrap transition-all ${value === o.id ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'text-on-surface-variant hover:text-primary'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
