import React, { useState } from 'react';
import type { CategoryId, Difficulty, Tour } from '../../types';
import { CATEGORIES } from '../../data/categories';
import { IMG } from '../../data/images';
import { useAppStore } from '../../store/AppStore';
import { buildPath, goBack, navigate } from '../../lib/router';
import { SafeImage } from '../../components/ui/SafeImage';
import { useToast } from '../../components/ui/Toast';
import { Icon } from '../../components/ui/Icon';
import { FormField, MissingFieldsBanner, fieldInputCls } from './FormField';

/**
 * Crear o editar un recorrido temático (ADMIN-001).
 * Escenario 1: con nombre, categoría, descripción y puntos de interés se guarda y publica.
 * Escenario 2: si faltan campos obligatorios, se indican y no se permite guardar.
 */

interface Draft {
  title: string;
  category: CategoryId | '';
  shortDescription: string;
  longDescription: string;
  durationMin: string;
  distanceKm: string;
  difficulty: Difficulty;
  coverImage: string;
  curatorName: string;
  pointIds: string[];
}

type Field = 'title' | 'category' | 'shortDescription' | 'pointIds' | 'durationMin' | 'distanceKm';

const LABELS: Record<Field, string> = {
  title: 'Nombre del recorrido',
  category: 'Categoría',
  shortDescription: 'Descripción',
  pointIds: 'Puntos de interés (al menos uno)',
  durationMin: 'Duración estimada',
  distanceKm: 'Distancia',
};

function toDraft(tour?: Tour): Draft {
  return {
    title: tour?.title ?? '',
    category: tour?.category ?? '',
    shortDescription: tour?.shortDescription ?? '',
    longDescription: tour?.longDescription ?? '',
    durationMin: tour ? String(tour.durationMin) : '',
    distanceKm: tour ? String(tour.distanceKm) : '',
    difficulty: tour?.difficulty ?? 'Fácil',
    coverImage: tour?.coverImage ?? '',
    curatorName: tour?.curatorName ?? 'Mesa de Cultura Comunitaria',
    pointIds: tour?.pointIds ?? [],
  };
}

function validate(d: Draft): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (d.title.trim().length < 3) e.title = 'Escribe el nombre del recorrido.';
  if (!d.category) e.category = 'Selecciona una categoría.';
  if (d.shortDescription.trim().length < 10) e.shortDescription = 'Describe la experiencia (mínimo 10 caracteres).';
  if (d.pointIds.length === 0) e.pointIds = 'Selecciona al menos un punto de interés.';
  const dur = Number(d.durationMin);
  if (!d.durationMin || !Number.isFinite(dur) || dur < 10 || dur > 600) e.durationMin = 'Indica la duración en minutos (10 a 600).';
  const dist = Number(d.distanceKm.replace(',', '.'));
  if (!d.distanceKm || !Number.isFinite(dist) || dist <= 0 || dist > 30) e.distanceKm = 'Indica la distancia en km (por ejemplo 2.5).';
  return e;
}

export const TourFormView: React.FC<{ tourId: string | null }> = ({ tourId }) => {
  const { tours, points, saveTour } = useAppStore();
  const toast = useToast();
  const existing = tourId ? tours.find((t) => t.id === tourId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  if (tourId && !existing) {
    return (
      <div className="max-w-md mx-auto p-10 text-center">
        <p className="text-sm text-on-surface-variant mb-4">El recorrido que intentas editar no existe.</p>
        <button type="button" onClick={() => navigate('/admin')} className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold">Volver al panel</button>
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (submitted) setErrors(validate(next));
  };

  const togglePoint = (id: string) =>
    set('pointIds', draft.pointIds.includes(id) ? draft.pointIds.filter((p) => p !== id) : [...draft.pointIds, id]);

  const move = (index: number, dir: -1 | 1) => {
    const list = [...draft.pointIds];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    set('pointIds', list);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const v = validate(draft);
    setErrors(v);
    if (Object.keys(v).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const firstPoint = points.find((p) => p.id === draft.pointIds[0]);
    const saved = saveTour({
      ...(existing ?? {}),
      id: existing?.id,
      title: draft.title.trim(),
      category: draft.category as CategoryId,
      shortDescription: draft.shortDescription.trim(),
      longDescription: draft.longDescription.trim() || draft.shortDescription.trim(),
      durationMin: Math.round(Number(draft.durationMin)),
      distanceKm: Number(draft.distanceKm.replace(',', '.')),
      difficulty: draft.difficulty,
      coverImage: draft.coverImage.trim() || firstPoint?.images[0] || IMG.escalinatas,
      coverAlt: existing?.coverAlt ?? `Imagen del recorrido ${draft.title.trim()}`,
      curatorName: draft.curatorName.trim() || 'Mesa de Cultura Comunitaria',
      curatorRole: existing?.curatorRole ?? 'Curaduría comunitaria',
      pointIds: draft.pointIds,
      stopsNoun: existing?.stopsNoun ?? 'puntos de interés',
      badgeLabel: existing?.badgeLabel ?? 'Nuevo',
      hasAudioGuide: existing?.hasAudioGuide ?? true,
    });
    toast(existing ? 'Cambios guardados y publicados.' : `«${saved.title}» se publicó en la app.`, {
      tone: 'success',
      action: { label: 'Ver', onClick: () => navigate(`/recorrido/${saved.id}`) },
    });
    navigate(buildPath('/admin', { tab: 'recorridos' }), { replace: true });
  };

  const missing = (Object.keys(errors) as Field[]).map((k) => LABELS[k]);
  const selectedPoints = draft.pointIds.map((id) => points.find((p) => p.id === id)).filter(Boolean) as typeof points;

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => goBack('/admin')} aria-label="Volver" className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-primary">
          <Icon name="arrow_back" />
        </button>
        <h1 className="font-serif text-2xl font-bold text-primary">{existing ? 'Editar recorrido' : 'Crear recorrido'}</h1>
      </div>

      <MissingFieldsBanner labels={missing} />

      <FormField id="t-title" label={LABELS.title} required error={errors.title}>
        <input id="t-title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Sendero de la Memoria Obrera" className={fieldInputCls(!!errors.title)} aria-invalid={!!errors.title} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="t-cat" label={LABELS.category} required error={errors.category}>
          <select id="t-cat" value={draft.category} onChange={(e) => set('category', e.target.value as CategoryId)} className={fieldInputCls(!!errors.category)} aria-invalid={!!errors.category}>
            <option value="">Selecciona una categoría</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </FormField>
        <FormField id="t-dif" label="Dificultad">
          <select id="t-dif" value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)} className={fieldInputCls()}>
            <option>Fácil</option>
            <option>Moderado</option>
            <option>Exigente</option>
          </select>
        </FormField>
      </div>

      <FormField id="t-desc" label={LABELS.shortDescription} required error={errors.shortDescription} hint="Se muestra en el listado de recorridos.">
        <textarea id="t-desc" rows={3} value={draft.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="Describe la experiencia del recorrido…" className={`${fieldInputCls(!!errors.shortDescription)} resize-none`} aria-invalid={!!errors.shortDescription} />
      </FormField>

      <FormField id="t-long" label="Relato extendido" hint="Opcional. Se muestra en el detalle del recorrido.">
        <textarea id="t-long" rows={4} value={draft.longDescription} onChange={(e) => set('longDescription', e.target.value)} className={`${fieldInputCls()} resize-none`} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField id="t-dur" label={`${LABELS.durationMin} (min)`} required error={errors.durationMin}>
          <input id="t-dur" inputMode="numeric" value={draft.durationMin} onChange={(e) => set('durationMin', e.target.value.replace(/[^\d]/g, ''))} placeholder="90" className={fieldInputCls(!!errors.durationMin)} aria-invalid={!!errors.durationMin} />
        </FormField>
        <FormField id="t-dist" label={`${LABELS.distanceKm} (km)`} required error={errors.distanceKm}>
          <input id="t-dist" inputMode="decimal" value={draft.distanceKm} onChange={(e) => set('distanceKm', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="2.5" className={fieldInputCls(!!errors.distanceKm)} aria-invalid={!!errors.distanceKm} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="t-cover" label="Imagen de portada (URL)" hint="Si la dejas vacía se usa la foto del primer punto.">
          <input id="t-cover" type="url" value={draft.coverImage} onChange={(e) => set('coverImage', e.target.value)} placeholder="https://…" className={fieldInputCls()} />
        </FormField>
        <FormField id="t-cur" label="Curaduría a cargo">
          <input id="t-cur" value={draft.curatorName} onChange={(e) => set('curatorName', e.target.value)} className={fieldInputCls()} />
        </FormField>
      </div>

      <fieldset className={`p-4 rounded-2xl border ${errors.pointIds ? 'border-error' : 'border-outline-variant/70'}`} aria-invalid={!!errors.pointIds}>
        <legend className="px-1 text-xs font-bold text-on-surface">
          {LABELS.pointIds} <span className="text-error">*</span>
        </legend>
        {errors.pointIds && <p className="text-xs text-error font-semibold mb-2">{errors.pointIds}</p>}

        {selectedPoints.length > 0 && (
          <ol className="mb-4 space-y-1.5">
            {selectedPoints.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-primary-fixed/40">
                <span className="w-6 h-6 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="flex-1 text-xs font-semibold text-primary truncate">{p.title}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${p.title}`} className="w-7 h-7 rounded-full hover:bg-surface-container disabled:opacity-30 flex items-center justify-center"><Icon name="arrow_upward" className="text-[16px]" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === selectedPoints.length - 1} aria-label={`Bajar ${p.title}`} className="w-7 h-7 rounded-full hover:bg-surface-container disabled:opacity-30 flex items-center justify-center"><Icon name="arrow_downward" className="text-[16px]" /></button>
                <button type="button" onClick={() => togglePoint(p.id)} aria-label={`Quitar ${p.title}`} className="w-7 h-7 rounded-full hover:bg-error/10 text-error flex items-center justify-center"><Icon name="close" className="text-[16px]" /></button>
              </li>
            ))}
          </ol>
        )}

        <p className="text-[11px] text-on-surface-variant mb-2">Marca los puntos en el orden en que se recorren. Puedes crear puntos nuevos en la pestaña «Puntos de interés».</p>
        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
          {points.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-container cursor-pointer">
              <input type="checkbox" checked={draft.pointIds.includes(p.id)} onChange={() => togglePoint(p.id)} className="h-4 w-4 accent-primary" />
              <SafeImage src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-on-surface truncate">{p.title}</span>
                <span className="block text-[11px] text-on-surface-variant truncate">{p.kindLabel}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => goBack('/admin')} className="px-5 py-3 rounded-full border border-outline-variant text-sm font-bold text-on-surface-variant">
          Cancelar
        </button>
        <button type="submit" className="flex-1 py-3 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs">
          <Icon name="publish" className="text-[18px]" /> {existing ? 'Guardar cambios' : 'Guardar recorrido'}
        </button>
      </div>
    </form>
  );
};
