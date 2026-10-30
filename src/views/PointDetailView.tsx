import React, { useEffect, useRef, useState } from 'react';
import type { CachedPoint, PointOfInterest } from '../types';
import { CATEGORY_BY_ID } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { useAudio } from '../store/AudioContext';
import { useLocation } from '../store/LocationContext';
import { getToursForPoint } from '../store/selectors';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuthPrompt } from '../hooks/useAuthPrompt';
import { formatDistance, haversineMeters, walkingMinutes } from '../lib/geo';
import { formatClock, formatDate, formatShortDate } from '../lib/format';
import { buildPath, goBack, navigate } from '../lib/router';
import { ReviewsSection } from '../components/ReviewsSection';
import { SafeImage } from '../components/ui/SafeImage';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';

/**
 * Ficha informativa de un punto de interés (FICHA-001).
 * Escenario 1: texto descriptivo, imágenes y relatos del lugar.
 * Escenario 2: sin conexión, muestra la información básica guardada en caché.
 */
export const PointDetailView: React.FC<{ pointId: string; tourContextId: string | null }> = ({ pointId, tourContextId }) => {
  const { points, tours, pointCache, cachePoints } = useAppStore();
  const online = useOnlineStatus();
  const point = points.find((p) => p.id === pointId);
  const cached = pointCache[pointId];

  // Cada ficha consultada con conexión queda guardada para verla luego sin internet.
  useEffect(() => {
    if (online && point) cachePoints([point.id]);
  }, [online, point?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!online) {
    return cached ? <OfflinePoint cached={cached} /> : <Unavailable offline />;
  }
  if (!point) return <Unavailable offline={false} />;

  const contextTour = tours.find((t) => t.id === tourContextId && t.pointIds.includes(point.id)) ?? getToursForPoint(point.id, tours)[0];
  return <OnlinePoint point={point} contextTourId={contextTour?.id ?? null} />;
};

const OnlinePoint: React.FC<{ point: PointOfInterest; contextTourId: string | null }> = ({ point, contextTourId }) => {
  const { tours, visits, currentUser, recordVisit } = useAppStore();
  const { play } = useAudio();
  const location = useLocation();
  const toast = useToast();
  const promptLogin = useAuthPrompt();
  const [slide, setSlide] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  const cat = CATEGORY_BY_ID[point.category];
  const inTours = getToursForPoint(point.id, tours);
  const contextTour = inTours.find((t) => t.id === contextTourId) ?? inTours[0];
  const stopNumber = contextTour ? contextTour.pointIds.indexOf(point.id) + 1 : null;
  const meters = haversineMeters(location.position, point.coords);
  const myVisit = currentUser ? visits.find((v) => v.userId === currentUser.id && v.pointId === point.id) : undefined;

  const seal = () => {
    const r = recordVisit({ pointId: point.id, tourId: contextTour?.id });
    if (!r.ok) promptLogin('Inicia sesión para sellar este punto en tu pasaporte barrial.');
    else toast('¡Punto sellado en tu pasaporte barrial!', { tone: 'success' });
  };

  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="w-full pb-32 lg:pb-12 lg:grid lg:grid-cols-2 lg:gap-8 xl:gap-12 lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-8">
      <div className="relative w-full h-72 md:h-96 bg-primary lg:sticky lg:top-8 lg:self-start lg:h-[calc(100dvh-4rem)] lg:rounded-3xl lg:overflow-hidden">
        <div ref={galleryRef} onScroll={onGalleryScroll} className="w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar" aria-label="Galería de imágenes">
          {point.images.map((src, i) => (
            <SafeImage key={i} src={src} alt={`${point.imageAlt} (imagen ${i + 1} de ${point.images.length})`} className="w-full h-full shrink-0 snap-center object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between">
          <button type="button" onClick={() => goBack(contextTour ? `/recorrido/${contextTour.id}` : '/explorar')} aria-label="Volver" className="w-11 h-11 rounded-full bg-surface/90 text-primary flex items-center justify-center shadow-md active:scale-95">
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <span className="px-3 py-1 rounded-full bg-black/45 text-white text-xs font-bold">{slide + 1} / {point.images.length}</span>
        </div>
        {point.images.length > 1 && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
            {point.images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
                onClick={() => galleryRef.current?.scrollTo({ left: i * (galleryRef.current?.clientWidth ?? 0), behavior: 'smooth' })}
                className={`h-2 rounded-full transition-all ${i === slide ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 lg:px-0 lg:pt-0 space-y-6 min-w-0">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Icon name={cat.icon} className="text-[15px]" />
            {point.kindLabel}
            {stopNumber && contextTour ? ` · Parada ${String(stopNumber).padStart(2, '0')}` : ''}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary leading-tight mt-1">{point.title}</h1>
          <p className="text-sm text-on-surface-variant mt-1">{point.subtitle}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed/60 text-primary text-[11px] font-bold">
              <Icon name="cloud_done" className="text-[14px]" /> Disponible sin conexión
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-semibold">
              <Icon name="near_me" className="text-[14px]" /> A {formatDistance(meters)} de ti
            </span>
          </div>
        </header>

        <button
          type="button"
          onClick={() => play({ id: point.id, title: point.title, narrator: point.audioNarrator, seconds: point.audioSeconds })}
          className="w-full p-3 rounded-2xl bg-primary-container text-on-primary flex items-center gap-3 text-left shadow-sm active:scale-[0.99]"
        >
          <span className="w-11 h-11 rounded-full bg-secondary text-white flex items-center justify-center shrink-0">
            <Icon name="play_arrow" fill className="text-[26px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold">Escuchar el relato</span>
            <span className="block text-xs text-on-primary-container truncate">{point.audioNarrator}</span>
          </span>
          <span className="text-xs font-mono text-on-primary-container">{formatClock(point.audioSeconds)}</span>
        </button>

        <section>
          <h2 className="font-serif text-xl font-bold text-primary mb-2 flex items-center gap-2">
            <Icon name="auto_stories" className="text-secondary" />
            Relato del lugar
          </h2>
          <p className="text-[15px] text-on-surface leading-relaxed">{point.narrative}</p>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <Info icon="record_voice_over" label="Narrado por" value={point.audioNarrator} />
            {point.address && <Info icon="signpost" label="Dirección" value={point.address} />}
            <Info icon="qr_code_2" label="Código de la placa" value={point.qrCode ?? 'Placa en instalación'} mono={!!point.qrCode} />
            <Info icon="directions_walk" label="Desde tu ubicación" value={`${formatDistance(meters)} · ${walkingMinutes(meters)} min a pie`} />
          </dl>
          {point.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {point.tags.map((t) => (
                <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-container text-primary">#{t}</span>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => navigate(buildPath(contextTour ? `/mapa/${contextTour.id}` : '/mapa', { destino: point.id }))}
            className="h-12 rounded-full border-2 border-secondary text-secondary text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-secondary/5 active:scale-95"
          >
            <Icon name="directions_walk" className="text-[18px]" /> Cómo llegar
          </button>
          {myVisit ? (
            <span className="h-12 rounded-full bg-primary-fixed text-primary text-xs font-bold flex items-center justify-center gap-1.5 text-center px-2">
              <Icon name="verified" fill className="text-[18px]" /> Sellado el {formatShortDate(myVisit.date)}
            </span>
          ) : (
            <button type="button" onClick={seal} className="h-12 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary-container active:scale-95">
              <Icon name="approval" className="text-[18px]" /> Sellar visita
            </button>
          )}
        </div>

        {inTours.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-outline mb-2">Hace parte de</h2>
            <div className="flex flex-wrap gap-2">
              {inTours.map((t) => (
                <button key={t.id} type="button" onClick={() => navigate(`/recorrido/${t.id}`)} className="px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-primary hover:border-primary flex items-center gap-1">
                  <Icon name="route" className="text-[14px]" /> {t.title}
                </button>
              ))}
            </div>
          </section>
        )}

        <ReviewsSection targetType="point" targetId={point.id} targetName="este lugar" />
      </div>
    </div>
  );
};

const Info: React.FC<{ icon: string; label: string; value: string; mono?: boolean }> = ({ icon, label, value, mono }) => (
  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-container-low">
    <Icon name={icon} className="text-[16px] text-secondary mt-0.5" />
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider font-bold text-outline">{label}</dt>
      <dd className={`text-on-surface font-semibold ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  </div>
);

const OfflinePoint: React.FC<{ cached: CachedPoint }> = ({ cached }) => (
  <div className="w-full pb-32">
    <div className="bg-on-surface text-surface px-4 py-3 flex items-start gap-3">
      <Icon name="cloud_off" className="text-[22px] shrink-0" />
      <div className="text-xs leading-relaxed">
        <p className="font-bold text-sm">Estás sin conexión</p>
        <p>Mostramos la información básica guardada el {formatDate(cached.cachedAt)}. Imágenes, audio y valoraciones estarán disponibles al recuperar la conexión.</p>
      </div>
    </div>
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
      <button type="button" onClick={() => goBack('/inicio')} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
        <Icon name="arrow_back" className="text-[18px]" /> Volver
      </button>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">{cached.kindLabel}</p>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary leading-tight mt-1">{cached.title}</h1>
        <p className="text-sm text-on-surface-variant mt-1">{cached.subtitle}</p>
      </header>
      <section className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60">
        <h2 className="font-serif text-lg font-bold text-primary mb-2">Relato del lugar</h2>
        <p className="text-[15px] text-on-surface leading-relaxed">{cached.narrative}</p>
        <p className="text-xs text-on-surface-variant mt-3">Narrado por {cached.audioNarrator}{cached.address ? ` · ${cached.address}` : ''}</p>
      </section>
    </main>
  </div>
);

const Unavailable: React.FC<{ offline: boolean }> = ({ offline }) => (
  <div className="max-w-md mx-auto px-6 py-16 text-center flex flex-col items-center">
    <Icon name={offline ? 'cloud_off' : 'wrong_location'} className="text-5xl text-outline mb-3" />
    <h1 className="font-serif text-2xl font-bold text-primary mb-2">{offline ? 'Ficha no disponible sin conexión' : 'Este punto ya no está disponible'}</h1>
    <p className="text-sm text-on-surface-variant mb-6">
      {offline
        ? 'Solo puedes ver sin internet las fichas que consultaste antes o los recorridos que guardaste. Conéctate para abrir esta ficha.'
        : 'Es posible que haya sido retirado del mapa por la administración. Explora otros lugares del barrio.'}
    </p>
    <button type="button" onClick={() => navigate('/explorar')} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
      Ir a Explorar
    </button>
  </div>
);
