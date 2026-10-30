import React, { useMemo, useState } from 'react';
import { CATEGORIES } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { useAudio } from '../store/AudioContext';
import { locationLabel, useLocation } from '../store/LocationContext';
import { formatRating, getRating, visitedPointIds } from '../store/selectors';
import { formatDistance, haversineMeters, walkingMinutes } from '../lib/geo';
import { formatDuration } from '../lib/format';
import { buildPath, navigate } from '../lib/router';
import { promptInstall, usePwa } from '../lib/pwa';
import { readJSON, writeJSON } from '../lib/storage';
import { FavoriteButton } from '../components/TourCard';
import { SafeImage } from '../components/ui/SafeImage';
import { Icon } from '../components/ui/Icon';

const NEARBY_RADIUS_M = 400;
const INSTALL_DISMISSED_KEY = 'ruta12:install-dismissed';

/** Pantalla principal: saludo, búsqueda rápida, categorías, ruta destacada y lugares cercanos. */
export const HomeView: React.FC<{ onShowInstallHelp: () => void }> = ({ onShowInstallHelp }) => {
  const { tours, points, ratings, visits, currentUser } = useAppStore();
  const { play } = useAudio();
  const location = useLocation();
  const pwa = usePwa();
  const [query, setQuery] = useState('');
  const [installDismissed, setInstallDismissed] = useState(() => readJSON<boolean>(INSTALL_DISMISSED_KEY) === true);

  const featured = tours.find((t) => t.editorialPick) ?? tours[0];
  const featuredRating = featured ? getRating(ratings, 'tour', featured.id) : null;
  const recommended = useMemo(
    () => [...tours].filter((t) => t.id !== featured?.id).sort((a, b) => getRating(ratings, 'tour', b.id).count - getRating(ratings, 'tour', a.id).count),
    [tours, ratings, featured?.id],
  );
  const nearby = useMemo(
    () =>
      points
        .map((p) => ({ point: p, meters: haversineMeters(location.position, p.coords) }))
        .sort((a, b) => a.meters - b.meters)
        .slice(0, 4),
    [points, location.position],
  );
  const withinRadius = nearby.filter((n) => n.meters <= NEARBY_RADIUS_M).length;
  const stamps = visitedPointIds(visits, currentUser?.id).size;
  const inProgress = currentUser
    ? tours.find((t) => {
        const v = visitedPointIds(visits, currentUser.id);
        const done = t.pointIds.filter((id) => v.has(id)).length;
        return done > 0 && done < t.pointIds.length;
      })
    : undefined;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(buildPath('/explorar', { q: query.trim() }));
  };

  const firstName = currentUser?.name.split(' ')[0] ?? 'caminante';
  const showInstall = !pwa.installed && !installDismissed && (pwa.canInstall || pwa.isIos);

  return (
    <div className="w-full max-w-md md:max-w-3xl lg:max-w-6xl mx-auto pb-32 lg:pb-12 pt-3 lg:pt-8 px-4 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 xl:gap-10">
        {/* Columna principal */}
        <div className="min-w-0">
          <section className="mb-5 lg:mb-6">
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-primary font-bold tracking-tight">
              Hola, {firstName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="text-sm lg:text-base text-on-surface-variant mt-0.5 leading-relaxed">¿Qué historia quieres descubrir hoy en nuestro barrio?</p>
          </section>

          {showInstall && (
            <div className="mb-5 p-3 rounded-2xl bg-primary text-on-primary flex items-center gap-3 lg:hidden">
              <Icon name="mobile_arrow_down" className="text-[26px] text-secondary-container shrink-0" />
              <p className="flex-1 text-xs leading-snug">
                <strong className="block text-sm">Instala la app</strong>
                Ábrela desde tu pantalla de inicio y úsala sin conexión.
              </p>
              <button
                type="button"
                onClick={() => (pwa.canInstall ? void promptInstall() : onShowInstallHelp())}
                className="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold shrink-0"
              >
                Instalar
              </button>
              <button
                type="button"
                aria-label="Ocultar sugerencia de instalación"
                onClick={() => {
                  writeJSON(INSTALL_DISMISSED_KEY, true);
                  setInstallDismissed(true);
                }}
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          )}

          <form onSubmit={submitSearch} className="mb-5 relative flex items-center" role="search">
            <Icon name="search" className="absolute left-3.5 text-outline text-[20px] pointer-events-none" />
            <label htmlFor="home-search" className="sr-only">Buscar recorridos</label>
            <input
              id="home-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca rutas, memorias, gastronomía…"
              enterKeyHint="search"
              className="w-full pl-10 pr-12 py-3 bg-surface-container-lowest border border-outline-variant/70 rounded-xl text-sm placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
            />
            <button
              type="button"
              onClick={() => navigate(buildPath('/explorar', { q: query.trim(), filtros: 1 }))}
              aria-label="Búsqueda avanzada con filtros"
              className="absolute right-1.5 w-10 h-10 text-on-surface-variant hover:text-primary rounded-lg flex items-center justify-center"
            >
              <Icon name="tune" className="text-[20px]" />
            </button>
          </form>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm sm:text-base text-primary">Categorías de memoria</h2>
              <button type="button" onClick={() => navigate('/explorar')} className="text-xs text-secondary font-semibold hover:underline py-1">
                Ver todas
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 py-1 lg:mx-0 lg:px-0 lg:flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(buildPath('/explorar', { cat: c.id }))}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-tertiary-fixed-dim hover:text-tertiary hover:border-tertiary-container text-xs font-semibold transition-all active:scale-95"
                >
                  <span aria-hidden="true">{c.emoji}</span>
                  {c.shortLabel}
                  <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {tours.filter((t) => t.category === c.id).length}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {inProgress && (
            <button
              type="button"
              onClick={() => navigate(`/mapa/${inProgress.id}`)}
              className="mb-6 w-full p-3.5 rounded-2xl bg-primary-fixed/50 border border-primary-fixed-dim flex items-center gap-3 text-left hover:bg-primary-fixed/70"
            >
              <span className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                <Icon name="play_arrow" fill />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-secondary">Continúa donde quedaste</span>
                <span className="block text-sm font-bold text-primary truncate">{inProgress.title}</span>
              </span>
              <Icon name="chevron_right" className="text-primary" />
            </button>
          )}

          {featured && featuredRating && (
            <section className="mb-6">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="verified" className="text-secondary text-[18px]" />
                <span className="text-xs font-bold text-secondary tracking-wider uppercase">Recomendación editorial</span>
              </div>
              <article className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-[#EBE6DC] shadow-sm group lg:grid lg:grid-cols-[1.2fr_1fr]">
                <div className="relative h-56 lg:h-full lg:min-h-72 w-full overflow-hidden cursor-pointer" onClick={() => navigate(`/recorrido/${featured.id}`)}>
                  <SafeImage src={featured.coverImage} alt={featured.coverAlt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/35 to-transparent lg:from-primary/60" />
                  <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-primary text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    {featured.badgeLabel}
                  </span>
                  <FavoriteButton tourId={featured.id} variant="bookmark" className="absolute top-3 right-3 w-10 h-10" />
                  <div className="absolute bottom-3 left-3.5 right-3.5 lg:hidden">
                    <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight text-white">{featured.title}</h3>
                  </div>
                </div>
                <div className="p-3.5 lg:p-6 flex flex-col gap-3 lg:justify-between">
                  <div className="hidden lg:block">
                    <h3 className="font-serif text-2xl font-bold leading-tight text-primary">{featured.title}</h3>
                    <p className="text-sm text-on-surface-variant mt-2 leading-relaxed line-clamp-4">{featured.shortDescription}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-1 py-1.5 bg-surface-container-low rounded-xl px-2 text-center">
                    <Stat label="Distancia" value={`${featured.distanceKm} km`} />
                    <Stat label="Tiempo" value={formatDuration(featured.durationMin)} bordered />
                    <Stat label="Paradas" value={`${featured.pointIds.length}`} bordered />
                    <Stat label="Valoración" value={`★ ${formatRating(featuredRating.average)}`} bordered accent />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/recorrido/${featured.id}`)}
                      className="flex-1 bg-primary text-on-primary hover:bg-primary-container h-11 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                    >
                      Explorar ruta <Icon name="arrow_forward" className="text-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/mapa/${featured.id}`)}
                      aria-label="Ver la ruta en el mapa"
                      className="w-11 h-11 bg-surface-container hover:bg-surface-variant text-primary rounded-full flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Icon name="map" className="text-[20px]" />
                    </button>
                  </div>
                </div>
              </article>
            </section>
          )}

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-serif text-lg lg:text-xl font-bold text-primary">Recorridos recomendados</h2>
                <p className="text-xs text-on-surface-variant">Narrativas vivas diseñadas por líderes comunitarios</p>
              </div>
              <button type="button" onClick={() => navigate('/explorar')} className="text-xs text-secondary font-semibold hover:underline shrink-0 py-1">
                Ver todos
              </button>
            </div>
            <div className="flex gap-3.5 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2 snap-x lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-visible">
              {recommended.map((tour) => {
                const r = getRating(ratings, 'tour', tour.id);
                return (
                  <article
                    key={tour.id}
                    onClick={() => navigate(`/recorrido/${tour.id}`)}
                    className="snap-start flex-shrink-0 w-64 lg:w-auto bg-surface-container-lowest rounded-2xl overflow-hidden border border-[#EBE6DC] shadow-xs flex flex-col cursor-pointer group hover:shadow-md transition-all"
                  >
                    <div className="relative h-36 w-full overflow-hidden">
                      <SafeImage src={tour.coverImage} alt={tour.coverAlt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <span className="absolute top-2.5 left-2.5 bg-primary/85 text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{tour.badgeLabel}</span>
                      <span className="absolute bottom-2 right-2 bg-surface-container-lowest/90 px-1.5 py-0.5 rounded-md text-[11px] font-bold text-primary shadow-xs">★ {formatRating(r.average)}</span>
                    </div>
                    <div className="p-3 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="font-serif text-base font-bold text-primary line-clamp-1 leading-snug group-hover:text-secondary transition-colors">{tour.title}</h3>
                        <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">{tour.shortDescription}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-outline-variant/30 text-on-surface-variant text-[11px] font-medium">
                        <span className="flex items-center gap-1"><Icon name="route" className="text-[14px]" />{tour.distanceKm} km</span>
                        <span className="flex items-center gap-1"><Icon name="schedule" className="text-[14px]" />{formatDuration(tour.durationMin)}</span>
                        <span className="text-secondary font-bold">{tour.hasAudioGuide ? 'Guiada' : 'Autoguiada'}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {/* Columna lateral (computador) / continuación (celular) */}
        <aside className="lg:sticky lg:top-8 lg:self-start space-y-5">
          {currentUser && (
            <button type="button" onClick={() => navigate('/perfil')} className="hidden lg:flex w-full items-center gap-3 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 text-left hover:border-primary">
              <span className="w-11 h-11 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center shrink-0">
                <Icon name="local_activity" />
              </span>
              <span className="flex-1">
                <span className="block text-xs text-on-surface-variant">Tu pasaporte barrial</span>
                <span className="block text-lg font-bold text-primary leading-tight">{stamps} {stamps === 1 ? 'sello' : 'sellos'}</span>
              </span>
              <Icon name="chevron_right" className="text-outline" />
            </button>
          )}

          <section className="lg:p-4 lg:rounded-2xl lg:bg-surface-container-lowest lg:border lg:border-outline-variant/60">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {location.source === 'gps' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-container opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${location.source === 'gps' ? 'bg-secondary' : 'bg-outline'}`} />
                </span>
                <h2 className="font-serif text-lg font-bold text-primary">Lugares cerca de ti</h2>
              </div>
              {location.status !== 'active' ? (
                <button type="button" onClick={location.enableGps} className="text-[11px] px-2.5 py-1.5 rounded-full bg-primary text-on-primary font-bold flex items-center gap-1 shrink-0">
                  <Icon name="my_location" className="text-[14px]" /> Activar GPS
                </button>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-bold shrink-0">
                  {withinRadius} a menos de {NEARBY_RADIUS_M} m
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant mb-2.5">{locationLabel(location)}</p>
            <div className="flex flex-col gap-2">
              {nearby.map(({ point, meters }) => {
                const tour = tours.find((t) => t.pointIds.includes(point.id));
                return (
                  <div key={point.id} className="p-2.5 bg-surface-container-lowest lg:bg-surface-container-low rounded-xl border border-[#EBE6DC] lg:border-transparent flex items-center gap-3 hover:bg-surface-container-low transition-colors">
                    <button type="button" onClick={() => navigate(`/punto/${point.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <SafeImage src={point.images[0]} alt={point.imageAlt} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1 text-secondary text-[11px] font-semibold">
                          <Icon name="near_me" className="text-[13px]" />A {formatDistance(meters)} · {walkingMinutes(meters * 1.3)} min
                        </span>
                        <span className="block text-sm font-bold text-primary truncate leading-tight mt-0.5">{point.title}</span>
                        <span className="block text-xs text-on-surface-variant truncate mt-0.5">{point.address ?? tour?.title ?? point.kindLabel}</span>
                      </span>
                    </button>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => play({ id: point.id, title: point.title, narrator: point.audioNarrator, seconds: point.audioSeconds })}
                        aria-label={`Escuchar relato de ${point.title}`}
                        className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                      >
                        <Icon name="volume_up" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(buildPath('/mapa', { destino: point.id }))}
                        aria-label={`Cómo llegar a ${point.title}`}
                        className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                      >
                        <Icon name="directions_walk" className="text-[18px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => navigate('/mapa')} className="mt-3 w-full py-2.5 rounded-full border border-primary text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/5">
              <Icon name="map" className="text-[18px]" /> Ver todos en el mapa
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; bordered?: boolean; accent?: boolean }> = ({ label, value, bordered, accent }) => (
  <div className={`flex flex-col items-center ${bordered ? 'border-l border-outline-variant/40' : ''}`}>
    <span className="text-[10px] text-outline font-semibold uppercase">{label}</span>
    <span className={`text-xs sm:text-sm font-bold ${accent ? 'text-secondary' : 'text-primary'}`}>{value}</span>
  </div>
);
