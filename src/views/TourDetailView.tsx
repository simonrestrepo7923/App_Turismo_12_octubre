import React, { useMemo, useState } from 'react';
import type { Tour } from '../types';
import { CATEGORY_BY_ID } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { useAudio } from '../store/AudioContext';
import { formatRating, getRating, getTourPoints, visitedPointIds } from '../store/selectors';
import { formatClock, formatDuration, initials, stopsLabel } from '../lib/format';
import { buildPath, goBack, navigate } from '../lib/router';
import { FavoriteButton } from '../components/TourCard';
import { ReviewsSection } from '../components/ReviewsSection';
import { SafeImage } from '../components/ui/SafeImage';
import { saveTourOffline } from '../services/offline';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';

/** Detalle general del recorrido (CONS-001 escenario 2): descripción, duración y puntos incluidos. */
export const TourDetailView: React.FC<{ tour: Tour }> = ({ tour }) => {
  const { points, ratings, visits, currentUser, pointCache, cachePoints, recordVisit } = useAppStore();
  const { play } = useAudio();
  const toast = useToast();

  const tourPoints = useMemo(() => getTourPoints(tour, points), [tour, points]);
  const rating = getRating(ratings, 'tour', tour.id);
  const visited = visitedPointIds(visits, currentUser?.id);
  const visitedCount = tourPoints.filter((p) => visited.has(p.id)).length;
  const offlineReady = tourPoints.length > 0 && tourPoints.every((p) => pointCache[p.id]);
  const cat = CATEGORY_BY_ID[tour.category];
  const totalAudio = tourPoints.reduce((s, p) => s + p.audioSeconds, 0);

  const start = (index = 0) => {
    if (currentUser) recordVisit({ tourId: tour.id });
    navigate(buildPath(`/mapa/${tour.id}`, { punto: tourPoints[index]?.id }));
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: tour.title, text: tour.shortDescription, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado al portapapeles.', { tone: 'success' });
      }
    } catch {
      // El usuario canceló el diálogo de compartir.
    }
  };

  const [saving, setSaving] = useState(false);
  const download = async () => {
    if (saving) return;
    setSaving(true);
    cachePoints(tour.pointIds);
    try {
      const r = await saveTourOffline(tourPoints);
      const parts = [`${tourPoints.length} fichas`];
      if (r.route !== 'ninguna') parts.push(r.route === 'calles' ? 'la ruta por las calles' : 'la ruta aproximada');
      if (r.tiles > 0) parts.push('el mapa de la zona');
      if (r.images > 0) parts.push(`${r.images} fotos`);
      toast(`Guardado para usar sin conexión: ${parts.join(', ')}.`, { tone: 'success', durationMs: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-background min-h-screen pb-32 lg:pb-12">
      <div className="relative w-full h-[340px] md:h-[440px] overflow-hidden bg-primary lg:max-w-[1200px] lg:mx-auto lg:mt-8 lg:rounded-3xl lg:w-[calc(100%-4rem)]">
        <SafeImage src={tour.coverImage} alt={tour.coverAlt} className="w-full h-full object-cover opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-on-surface/20 to-black/50 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <button type="button" onClick={() => goBack('/explorar')} aria-label="Volver" className="w-11 h-11 rounded-full bg-surface/90 backdrop-blur-md text-primary flex items-center justify-center shadow-md active:scale-95">
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={share} aria-label="Compartir recorrido" className="w-11 h-11 rounded-full bg-surface/90 backdrop-blur-md text-primary flex items-center justify-center shadow-md active:scale-95">
              <Icon name="share" className="text-[22px]" />
            </button>
            <FavoriteButton tourId={tour.id} variant="bookmark" className="w-11 h-11 shadow-md" />
          </div>
        </div>
        <span className="absolute bottom-5 left-4 sm:left-6 md:left-10 z-10 flex items-center gap-2 bg-surface-container-lowest/90 px-3.5 py-1.5 rounded-full border border-outline-variant/80 shadow-xs">
          <Icon name="location_on" className="text-secondary text-sm" />
          <span className="text-xs font-bold text-on-surface">Comuna 6 · Medellín</span>
        </span>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <section className="md:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold tracking-wide uppercase">
                <Icon name={cat.icon} className="text-sm" />
                {cat.label}
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-primary font-bold tracking-tight leading-tight mt-1">{tour.title}</h1>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <Icon name="star" fill className="text-on-tertiary-container text-base" />
                <span className="text-sm font-bold text-on-surface">{formatRating(rating.average)}</span>
                <span className="text-outline">•</span>
                <a href="#valoraciones" onClick={(e) => { e.preventDefault(); document.getElementById('valoraciones')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-on-surface-variant underline-offset-2 hover:underline">
                  {rating.count} valoraciones de visitantes
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/60">
              <Metric icon="straighten" value={`${tour.distanceKm} km`} label="de trayecto" />
              <Metric icon="schedule" value={formatDuration(tour.durationMin)} label="estimados" />
              <Metric icon="pin_drop" value={`${tourPoints.length} puntos`} label="de interés" accent />
              <Metric icon="directions_walk" value={tour.difficulty} label="dificultad · urbano" />
            </div>

            {currentUser && tourPoints.length > 0 && (
              <div className="p-3 rounded-2xl bg-primary-fixed/40 border border-primary-fixed-dim flex items-center gap-3">
                <Icon name="local_activity" className="text-primary text-[22px]" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-primary">Tu pasaporte: {visitedCount} de {tourPoints.length} puntos sellados</p>
                  <div className="h-1.5 mt-1 rounded-full bg-surface-container-high overflow-hidden">
                    <div className="h-full bg-primary-container rounded-full" style={{ width: `${(visitedCount / tourPoints.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => start(Math.min(visitedCount, Math.max(0, tourPoints.length - 1)))}
                disabled={tourPoints.length === 0}
                className="flex-1 h-12 bg-primary hover:bg-primary-container text-on-primary font-bold text-sm rounded-full flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                <Icon name="play_arrow" fill className="text-[20px]" />
                {visitedCount > 0 && visitedCount < tourPoints.length ? 'Continuar recorrido' : 'Comenzar recorrido'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/mapa/${tour.id}`)}
                  className="flex-1 sm:flex-initial px-5 h-12 bg-surface-container-lowest border-2 border-secondary text-secondary font-bold text-sm rounded-full flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95"
                >
                  <Icon name="map" className="text-[18px]" />
                  Ver en el mapa
                </button>
                <button
                  type="button"
                  onClick={download}
                  aria-label={offlineReady ? 'Disponible sin conexión' : 'Guardar para usar sin conexión'}
                  title={offlineReady ? 'Disponible sin conexión' : 'Guardar para usar sin conexión'}
                  className={`w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center active:scale-95 ${
                    offlineReady ? 'bg-primary-fixed text-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {saving ? (
                    <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="Guardando" />
                  ) : (
                    <Icon name={offlineReady ? 'cloud_done' : 'download_for_offline'} className="text-[20px]" />
                  )}
                </button>
              </div>
            </div>

            <article className="p-5 sm:p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/70 shadow-xs">
              <h2 className="font-serif text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <Icon name="auto_stories" className="text-secondary" />
                Relato de la experiencia
              </h2>
              {tour.quote && <p className="text-base leading-relaxed italic font-serif text-primary/95 mb-4 border-l-2 border-secondary pl-4">{tour.quote}</p>}
              <p className="text-sm text-on-surface-variant leading-relaxed">{tour.longDescription || tour.shortDescription}</p>
              <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">{initials(tour.curatorName)}</span>
                <span>
                  <span className="block text-xs font-bold text-on-surface leading-tight">{tour.curatorName}</span>
                  <span className="block text-[11px] text-on-surface-variant">{tour.curatorRole}</span>
                </span>
                <Icon name="verified" className="ml-auto text-outline" />
              </div>
            </article>
          </section>

          <section className="md:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
              <h2 className="font-serif text-xl font-bold text-primary flex items-center gap-2">
                <Icon name="timeline" className="text-secondary" />
                Puntos del recorrido
              </h2>
              <span className="text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full font-semibold">{stopsLabel(tour)}</span>
            </div>

            {tourPoints.length === 0 ? (
              <p className="p-4 bg-surface-container rounded-xl text-sm text-on-surface-variant">Los puntos de este recorrido están en proceso de curaduría comunitaria.</p>
            ) : (
              <ol className="relative pl-7 space-y-3">
                <span className="absolute left-[13px] top-4 bottom-4 w-0.5 bg-primary-container/30" aria-hidden="true" />
                {tourPoints.map((p, idx) => {
                  const done = visited.has(p.id);
                  return (
                    <li key={p.id} className="relative">
                      <span
                        className={`absolute -left-7 top-3 w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ring-4 ring-background ${
                          done ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'
                        }`}
                      >
                        {done ? <Icon name="check" className="text-[16px]" /> : String(idx + 1).padStart(2, '0')}
                      </span>
                      <div
                        onClick={() => navigate(buildPath(`/punto/${p.id}`, { recorrido: tour.id }))}
                        className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/80 hover:border-primary hover:shadow-sm transition-all flex gap-3 cursor-pointer group"
                      >
                        <SafeImage src={p.images[0]} alt={p.imageAlt} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-secondary tracking-wider uppercase truncate">{p.kindLabel}</span>
                              {p.qrCode && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary-fixed/70 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Icon name="qr_code_2" className="text-[11px]" /> QR
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm text-on-surface font-bold truncate mt-0.5 group-hover:text-primary">{p.title}</h3>
                            <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">{p.subtitle}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-outline-variant/20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                play({ id: p.id, title: p.title, narrator: p.audioNarrator, seconds: p.audioSeconds });
                              }}
                              className="text-[11px] text-on-surface-variant hover:text-primary flex items-center gap-1 font-medium"
                            >
                              <Icon name="volume_up" className="text-[14px] text-outline" />
                              Audio {formatClock(p.audioSeconds)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                start(idx);
                              }}
                              className="text-[11px] text-secondary font-bold hover:underline flex items-center gap-0.5"
                            >
                              Ir aquí <Icon name="arrow_forward" className="text-[13px]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {tourPoints.length > 0 && (
              <div className="p-3.5 bg-primary-container text-on-primary rounded-2xl shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary flex items-center justify-center shrink-0">
                    <Icon name="headphones" className="text-xl" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">Guía de audio inmersiva</span>
                    <span className="block text-xs text-on-primary-container truncate">Voces de la comunidad · {Math.round(totalAudio / 60)} min</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => play({ id: `tour-${tour.id}`, title: `Audioguía: ${tour.title}`, narrator: tour.curatorName, seconds: totalAudio })}
                  className="px-3.5 py-1.5 bg-primary-fixed text-on-primary-fixed text-xs rounded-full font-bold hover:bg-primary-fixed-dim shrink-0"
                >
                  Escuchar
                </button>
              </div>
            )}
          </section>
        </div>

        <div id="valoraciones" className="mt-10 max-w-2xl scroll-mt-20">
          <ReviewsSection targetType="tour" targetId={tour.id} targetName="este recorrido" />
        </div>
      </main>
    </div>
  );
};

const Metric: React.FC<{ icon: string; value: string; label: string; accent?: boolean }> = ({ icon, value, label, accent }) => (
  <div className="flex flex-col items-center justify-center p-2.5 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/40">
    <Icon name={icon} className={`mb-1 text-[20px] ${accent ? 'text-secondary' : 'text-primary'}`} />
    <span className="text-sm font-bold text-on-surface">{value}</span>
    <span className="text-[10px] text-on-surface-variant">{label}</span>
  </div>
);
