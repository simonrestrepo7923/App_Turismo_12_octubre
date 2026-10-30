import React, { useEffect, useRef, useState } from 'react';
import type { CategoryId, LatLng, PointOfInterest } from '../../types';
import { CATEGORIES } from '../../data/categories';
import { useAppStore } from '../../store/AppStore';
import { getToursForPoint } from '../../store/selectors';
import { buildPath, goBack, navigate } from '../../lib/router';
import { LeafletMap, type LeafletMapHandle } from '../../components/map/LeafletMap';
import { useLocation } from '../../store/LocationContext';
import { isInsideBarrio, isValidLatLng } from '../../lib/geo';
import { SafeImage } from '../../components/ui/SafeImage';
import { useToast } from '../../components/ui/Toast';
import { Icon } from '../../components/ui/Icon';
import { FormField, MissingFieldsBanner, fieldInputCls } from './FormField';

/**
 * Crear o editar un punto de interés (ADMIN-002, escenario 1): descripción,
 * imágenes, relatos y ubicación. Los cambios se reflejan de inmediato en la app.
 */

interface Draft {
  title: string;
  kindLabel: string;
  category: CategoryId | '';
  subtitle: string;
  narrative: string;
  audioNarrator: string;
  audioMinutes: string;
  address: string;
  images: string[];
  tags: string;
  position: LatLng | null;
  tourIds: string[];
}

type Field = 'title' | 'kindLabel' | 'category' | 'subtitle' | 'narrative' | 'images' | 'position';

const LABELS: Record<Field, string> = {
  title: 'Nombre del punto',
  kindLabel: 'Tipo de lugar',
  category: 'Categoría',
  subtitle: 'Resumen',
  narrative: 'Relato',
  images: 'Imágenes (al menos una URL válida)',
  position: 'Ubicación en el mapa',
};

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

function toDraft(point: PointOfInterest | undefined, tourIds: string[]): Draft {
  return {
    title: point?.title ?? '',
    kindLabel: point?.kindLabel ?? '',
    category: point?.category ?? '',
    subtitle: point?.subtitle ?? '',
    narrative: point?.narrative ?? '',
    audioNarrator: point?.audioNarrator ?? '',
    audioMinutes: point ? (point.audioSeconds / 60).toFixed(1).replace(/\.0$/, '') : '2',
    address: point?.address ?? '',
    images: point?.images.length ? point.images : [''],
    tags: point?.tags.join(', ') ?? '',
    position: point?.coords ?? null,
    tourIds,
  };
}

function validate(d: Draft): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (d.title.trim().length < 3) e.title = 'Escribe el nombre del punto.';
  if (d.kindLabel.trim().length < 3) e.kindLabel = 'Indica el tipo de lugar (p. ej. «Mural histórico»).';
  if (!d.category) e.category = 'Selecciona una categoría.';
  if (d.subtitle.trim().length < 5) e.subtitle = 'Escribe un resumen de una línea.';
  if (d.narrative.trim().length < 20) e.narrative = 'El relato debe tener al menos 20 caracteres.';
  if (!d.images.some(isUrl)) e.images = 'Agrega al menos una imagen con una URL que empiece por http.';
  if (!d.position) e.position = 'Toca el mapa para ubicar el punto.';
  else if (!isInsideBarrio(d.position, 5000)) e.position = 'El punto debe estar en la Comuna 6 o sus alrededores (máximo 5 km del barrio).';
  return e;
}

export const PointFormView: React.FC<{ pointId: string | null }> = ({ pointId }) => {
  const { points, tours, savePoint } = useAppStore();
  const toast = useToast();
  const existing = pointId ? points.find((p) => p.id === pointId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing, existing ? getToursForPoint(existing.id, tours).map((t) => t.id) : []));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const mapRef = useRef<LeafletMapHandle>(null);
  const location = useLocation();

  // Encuadre inicial: el punto que se edita o todo el barrio.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (existing) mapRef.current?.centerOn(existing.coords, 18);
      else mapRef.current?.fitTo(points.map((p) => p.coords));
    });
    return () => window.cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (pointId && !existing) {
    return (
      <div className="max-w-md mx-auto p-10 text-center">
        <p className="text-sm text-on-surface-variant mb-4">El punto que intentas editar no existe.</p>
        <button type="button" onClick={() => navigate('/admin?tab=puntos')} className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold">Volver al panel</button>
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (submitted) setErrors(validate(next));
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
    const saved = savePoint(
      {
        id: existing?.id,
        title: draft.title.trim(),
        kindLabel: draft.kindLabel.trim(),
        category: draft.category as CategoryId,
        subtitle: draft.subtitle.trim(),
        narrative: draft.narrative.trim(),
        audioNarrator: draft.audioNarrator.trim() || 'Voces de la comunidad',
        audioSeconds: Math.max(30, Math.round(Number(draft.audioMinutes.replace(',', '.')) * 60) || 120),
        address: draft.address.trim() || undefined,
        images: draft.images.map((s) => s.trim()).filter(isUrl),
        imageAlt: existing?.imageAlt ?? `Fotografía de ${draft.title.trim()}`,
        tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
        qrCode: existing?.qrCode ?? null,
        coords: draft.position!,
      },
      draft.tourIds,
    );
    toast(existing ? 'Punto actualizado. Los cambios ya se ven en la app.' : `«${saved.title}» se agregó al mapa.`, {
      tone: 'success',
      action: { label: 'Ver ficha', onClick: () => navigate(`/punto/${saved.id}`) },
    });
    navigate(buildPath('/admin', { tab: 'puntos' }), { replace: true });
  };

  const missing = (Object.keys(errors) as Field[]).map((k) => LABELS[k]);
  const previewPoint: PointOfInterest | null = draft.position
    ? {
        id: existing?.id ?? '__nuevo__',
        title: draft.title || 'Nuevo punto',
        subtitle: '',
        narrative: '',
        category: (draft.category || 'historico') as CategoryId,
        kindLabel: '',
        images: [],
        imageAlt: '',
        audioNarrator: '',
        audioSeconds: 0,
        qrCode: null,
        coords: draft.position,
        tags: [],
      }
    : null;
  const mapPoints = [...points.filter((p) => p.id !== existing?.id), ...(previewPoint ? [previewPoint] : [])];

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => goBack('/admin?tab=puntos')} aria-label="Volver" className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-primary">
          <Icon name="arrow_back" />
        </button>
        <h1 className="font-serif text-2xl font-bold text-primary">{existing ? 'Editar punto de interés' : 'Nuevo punto de interés'}</h1>
      </div>

      <MissingFieldsBanner labels={missing} />

      <FormField id="p-title" label={LABELS.title} required error={errors.title}>
        <input id="p-title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Escuela del Convite" className={fieldInputCls(!!errors.title)} aria-invalid={!!errors.title} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="p-kind" label={LABELS.kindLabel} required error={errors.kindLabel}>
          <input id="p-kind" value={draft.kindLabel} onChange={(e) => set('kindLabel', e.target.value)} placeholder="Mural histórico, museo vivo…" className={fieldInputCls(!!errors.kindLabel)} aria-invalid={!!errors.kindLabel} />
        </FormField>
        <FormField id="p-cat" label={LABELS.category} required error={errors.category}>
          <select id="p-cat" value={draft.category} onChange={(e) => set('category', e.target.value as CategoryId)} className={fieldInputCls(!!errors.category)} aria-invalid={!!errors.category}>
            <option value="">Selecciona una categoría</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id="p-sub" label={LABELS.subtitle} required error={errors.subtitle}>
        <input id="p-sub" value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Una línea que resuma el lugar" className={fieldInputCls(!!errors.subtitle)} aria-invalid={!!errors.subtitle} />
      </FormField>

      <FormField id="p-narr" label={LABELS.narrative} required error={errors.narrative} hint="Historia del lugar tal como se contará en la ficha.">
        <textarea id="p-narr" rows={5} value={draft.narrative} onChange={(e) => set('narrative', e.target.value)} className={`${fieldInputCls(!!errors.narrative)} resize-none`} aria-invalid={!!errors.narrative} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <FormField id="p-narrator" label="Narrador del audio">
            <input id="p-narrator" value={draft.audioNarrator} onChange={(e) => set('audioNarrator', e.target.value)} placeholder="Nombre de quien cuenta el relato" className={fieldInputCls()} />
          </FormField>
        </div>
        <FormField id="p-audio" label="Duración audio (min)">
          <input id="p-audio" inputMode="decimal" value={draft.audioMinutes} onChange={(e) => set('audioMinutes', e.target.value.replace(/[^\d.,]/g, ''))} className={fieldInputCls()} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="p-addr" label="Dirección o referencia">
          <input id="p-addr" value={draft.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle 104 con Carrera 81" className={fieldInputCls()} />
        </FormField>
        <FormField id="p-tags" label="Etiquetas" hint="Separadas por comas.">
          <input id="p-tags" value={draft.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Convite, Memoria oral" className={fieldInputCls()} />
        </FormField>
      </div>

      <fieldset className={`p-4 rounded-2xl border ${errors.images ? 'border-error' : 'border-outline-variant/70'}`}>
        <legend className="px-1 text-xs font-bold text-on-surface">{LABELS.images} <span className="text-error">*</span></legend>
        {errors.images && <p className="text-xs text-error font-semibold mb-2">{errors.images}</p>}
        <div className="space-y-2">
          {draft.images.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              {isUrl(url) ? (
                <SafeImage src={url} alt={`Vista previa ${i + 1}`} className="w-11 h-11 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center text-outline shrink-0"><Icon name="image" /></span>
              )}
              <input
                aria-label={`URL de la imagen ${i + 1}`}
                type="url"
                value={url}
                onChange={(e) => set('images', draft.images.map((u, j) => (j === i ? e.target.value : u)))}
                placeholder="https://…"
                className={`${fieldInputCls()} flex-1 min-w-0`}
              />
              <button type="button" onClick={() => set('images', draft.images.length > 1 ? draft.images.filter((_, j) => j !== i) : [''])} aria-label={`Quitar imagen ${i + 1}`} className="w-9 h-9 rounded-full text-error hover:bg-error/10 flex items-center justify-center shrink-0">
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          ))}
        </div>
        {draft.images.length < 6 && (
          <button type="button" onClick={() => set('images', [...draft.images, ''])} className="mt-2 text-xs font-bold text-primary flex items-center gap-1">
            <Icon name="add_photo_alternate" className="text-[18px]" /> Agregar otra imagen
          </button>
        )}
      </fieldset>

      <fieldset className={`rounded-2xl border overflow-hidden ${errors.position ? 'border-error' : 'border-outline-variant/70'}`}>
        <legend className="mx-4 px-1 text-xs font-bold text-on-surface">{LABELS.position} <span className="text-error">*</span></legend>
        <p className={`px-4 pb-2 text-xs ${errors.position ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
          {errors.position ?? (draft.position ? 'Toca otra parte del mapa para mover el punto, escribe las coordenadas o usa tu GPS si estás en el lugar.' : 'Toca el mapa para ubicar el punto, escribe las coordenadas o usa tu GPS si estás en el lugar.')}
        </p>
        <div className="relative h-80">
          <LeafletMap
            ref={mapRef}
            points={mapPoints}
            activePointId={previewPoint?.id ?? null}
            onMapClick={(c) => set('position', { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) })}
            ariaLabel="Mapa para ubicar el punto de interés"
            initialZoom={15}
          />
          <div className="absolute right-2 top-2 z-10 flex flex-col rounded-xl bg-surface-container-lowest shadow border border-outline-variant/70 overflow-hidden">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar" className="w-9 h-9 flex items-center justify-center hover:bg-surface-container"><Icon name="add" className="text-[18px]" /></button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar" className="w-9 h-9 flex items-center justify-center hover:bg-surface-container border-t border-outline-variant/60"><Icon name="remove" className="text-[18px]" /></button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <FormField id="p-lat" label="Latitud">
            <input
              id="p-lat"
              inputMode="decimal"
              value={draft.position?.lat ?? ''}
              onChange={(e) => {
                const lat = Number(e.target.value.replace(',', '.'));
                const next = { lat, lng: draft.position?.lng ?? 0 };
                if (isValidLatLng(next)) set('position', next);
              }}
              placeholder="6.30"
              className={fieldInputCls()}
            />
          </FormField>
          <FormField id="p-lng" label="Longitud">
            <input
              id="p-lng"
              inputMode="decimal"
              value={draft.position?.lng ?? ''}
              onChange={(e) => {
                const lng = Number(e.target.value.replace(',', '.'));
                const next = { lat: draft.position?.lat ?? 0, lng };
                if (isValidLatLng(next)) set('position', next);
              }}
              placeholder="-75.58"
              className={fieldInputCls()}
            />
          </FormField>
          <button
            type="button"
            onClick={() => {
              if (location.gpsPosition) {
                set('position', location.gpsPosition);
                mapRef.current?.centerOn(location.gpsPosition, 18);
                toast('Ubicación del punto tomada de tu GPS.', { tone: 'success' });
              } else {
                location.enableGps();
                toast('Activando el GPS… vuelve a tocar el botón cuando tengas señal.');
              }
            }}
            className="col-span-2 sm:col-span-1 h-[42px] px-4 rounded-xl border border-primary text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/5"
          >
            <Icon name="my_location" className="text-[18px]" /> Usar mi ubicación
          </button>
        </div>
      </fieldset>

      <fieldset className="p-4 rounded-2xl border border-outline-variant/70">
        <legend className="px-1 text-xs font-bold text-on-surface">Recorridos que incluyen este punto</legend>
        <div className="space-y-1">
          {tours.map((t) => (
            <label key={t.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-container cursor-pointer">
              <input
                type="checkbox"
                checked={draft.tourIds.includes(t.id)}
                onChange={() => set('tourIds', draft.tourIds.includes(t.id) ? draft.tourIds.filter((id) => id !== t.id) : [...draft.tourIds, t.id])}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs font-semibold text-on-surface">{t.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => goBack('/admin?tab=puntos')} className="px-5 py-3 rounded-full border border-outline-variant text-sm font-bold text-on-surface-variant">
          Cancelar
        </button>
        <button type="submit" className="flex-1 py-3 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs">
          <Icon name="save" className="text-[18px]" /> {existing ? 'Guardar cambios' : 'Guardar punto'}
        </button>
      </div>
    </form>
  );
};
