import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointOfInterest, Tour, WalkingRoute } from '../types';
import { useAppStore } from '../store/AppStore';
import { useAudio } from '../store/AudioContext';
import { locationLabel, useLocation } from '../store/LocationContext';
import { formatRating, getRating, getTourPoints, visitedPointIds } from '../store/selectors';
import { useAuthPrompt } from '../hooks/useAuthPrompt';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { BARRIO_RADIUS_M, formatDistance, haversineMeters, pointAlongPath, progressAlongPath, walkingMinutes } from '../lib/geo';
import { formatClock } from '../lib/format';
import { buildPath, goBack, navigate } from '../lib/router';
import { getWalkingRoute } from '../services/routing';
import { LeafletMap, type LeafletMapHandle, type MapInsets } from '../components/map/LeafletMap';
import { SafeImage } from '../components/ui/SafeImage';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';

/**
 * Mapa interactivo y navegación a pie.
 * MAPA-001: puntos del recorrido sobre el mapa real y ubicación del turista en tiempo real.
 * GEO-001: «Cómo llegar» calcula la ruta por las calles desde la ubicación actual, da
 *          indicaciones paso a paso y la recalcula si el turista se desvía.
 */

const ARRIVAL_METERS = 20;
const OFF_ROUTE_METERS = 35;
const REROUTE_COOLDOWN_MS = 8000;
const SIM_STEP_METERS = 14;
const SIM_INTERVAL_MS = 600;

interface MapViewProps {
  tourId: string | null;
  focusPointId: string | null;
  destinationId: string | null;
  onOpenQrScanner: () => void;
}

export const MapView: React.FC<MapViewProps> = ({ tourId, focusPointId, destinationId, onOpenQrScanner }) => {
  const { tours, points, ratings, visits, currentUser, recordVisit } = useAppStore();
  const { play } = useAudio();
  const location = useLocation();
  const online = useOnlineStatus();
  const toast = useToast();
  const promptLogin = useAuthPrompt();
  const isDesktop = useIsDesktop();
  const mapRef = useRef<LeafletMapHandle>(null);

  const tour: Tour | undefined = tours.find((t) => t.id === tourId);
  const shownPoints = useMemo(() => (tour ? getTourPoints(tour, points) : points), [tour, points]);
  const visited = useMemo(() => visitedPointIds(visits, currentUser?.id), [visits, currentUser?.id]);
  const firstPending = tour ? shownPoints.find((p) => !visited.has(p.id)) ?? shownPoints[0] : undefined;

  const [activeId, setActiveId] = useState<string | null>(focusPointId ?? destinationId ?? firstPending?.id ?? null);
  const [navTargetId, setNavTargetId] = useState<string | null>(destinationId);
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tourRoute, setTourRoute] = useState<WalkingRoute | null>(null);
  const [walking, setWalking] = useState(false);
  const [follow, setFollow] = useState(false);
  const [showList, setShowList] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);

  const active = points.find((p) => p.id === activeId) ?? null;
  const navTarget = points.find((p) => p.id === navTargetId) ?? null;
  const activeIndex = active && tour ? tour.pointIds.indexOf(active.id) : -1;

  // Espacio ocupado por los paneles flotantes, para encuadrar el mapa.
  const insets: MapInsets = isDesktop
    ? { top: 72, right: 72, bottom: 24, left: 0 }
    : { top: 130, right: 64, bottom: Math.max(96, sheetHeight + 80), left: 0 };

  // ── Trazado del recorrido por las calles ────────────────────────────────
  useEffect(() => {
    if (!tour || shownPoints.length < 2) {
      setTourRoute(null);
      return;
    }
    const controller = new AbortController();
    getWalkingRoute(shownPoints.map((p) => p.coords), { persist: true, signal: controller.signal })
      .then(setTourRoute)
      .catch(() => undefined);
    return () => controller.abort();
  }, [tour, shownPoints]);

  // ── Encuadre inicial ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      if (navTarget) map.fitTo([location.position, navTarget.coords]);
      else if (focusPointId && active) map.centerOn(active.coords, 17);
      else map.fitTo(shownPoints.map((p) => p.coords), 17);
    }, 50);
    return () => window.clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cálculo de la ruta a pie ─────────────────────────────────────────────
  const lastRouteAt = useRef(0);
  const routeAbort = useRef<AbortController | null>(null);
  const requestRoute = useCallback(
    (target: PointOfInterest, from = location.position) => {
      routeAbort.current?.abort();
      const controller = new AbortController();
      routeAbort.current = controller;
      lastRouteAt.current = Date.now();
      setRouteLoading(true);
      getWalkingRoute([from, target.coords], { destinationName: target.title, signal: controller.signal })
        .then((r) => {
          setRoute(r);
          setRouteLoading(false);
        })
        .catch(() => setRouteLoading(false));
    },
    [location.position],
  );

  useEffect(() => {
    if (navTarget) requestRoute(navTarget);
    else {
      routeAbort.current?.abort();
      setRoute(null);
    }
  }, [navTargetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = route ? progressAlongPath(route.coords, location.position) : null;
  const straightToTarget = navTarget ? haversineMeters(location.position, navTarget.coords) : 0;
  // Lo que falta por la ruta, más el tramo final desde la calle hasta la placa.
  const routeEnd = route ? route.coords[route.coords.length - 1] : null;
  const remaining = progress && routeEnd && navTarget ? progress.remaining + haversineMeters(routeEnd, navTarget.coords) : straightToTarget;
  const tolerance = Math.min(location.accuracy ?? 0, 30);
  const arrived = !!navTarget && (straightToTarget <= ARRIVAL_METERS + tolerance || (progress !== null && progress.remaining <= 10 && straightToTarget < 60));

  // Recalcula la ruta si la persona se desvía (GEO-001, escenario 2).
  useEffect(() => {
    if (!navTarget || !progress || arrived || routeLoading || walking) return;
    if (progress.offset > OFF_ROUTE_METERS + tolerance && Date.now() - lastRouteAt.current > REROUTE_COOLDOWN_MS) {
      requestRoute(navTarget);
      toast('Te desviaste de la ruta: la recalculamos.', { durationMs: 2500 });
    }
  }, [location.position.lat, location.position.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // El mapa sigue a la persona mientras navega.
  useEffect(() => {
    if (follow && navTarget) mapRef.current?.centerOn(location.position);
  }, [location.position.lat, location.position.lng, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Caminata simulada por la ruta (cuando no se usa el GPS real).
  const progressRef = useRef(progress);
  progressRef.current = progress;
  useEffect(() => {
    if (!walking || !route || location.source === 'gps') return;
    const id = window.setInterval(() => {
      const along = (progressRef.current?.along ?? 0) + SIM_STEP_METERS;
      location.setSimulatedPosition(pointAlongPath(route.coords, along));
    }, SIM_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [walking, route, location.source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!arrived) return;
    setWalking(false);
    navigator.vibrate?.([120, 60, 120]);
  }, [arrived]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const selectPoint = (id: string) => {
    setActiveId(id);
    setShowList(false);
    const p = points.find((pt) => pt.id === id);
    if (p && !navTarget) mapRef.current?.centerOn(p.coords);
  };

  const startNavigation = (p: PointOfInterest) => {
    setNavTargetId(p.id);
    setActiveId(p.id);
    setWalking(false);
    setFollow(true);
    setShowList(false);
    mapRef.current?.fitTo([location.position, p.coords]);
  };

  const stopNavigation = () => {
    setNavTargetId(null);
    setWalking(false);
    setFollow(false);
  };

  const seal = (p: PointOfInterest) => {
    const r = recordVisit({ pointId: p.id, tourId: tour?.id });
    if (!r.ok) {
      promptLogin('Inicia sesión para sellar este punto en tu pasaporte barrial.');
      return;
    }
    toast(`«${p.title}» sellado en tu pasaporte.`, { tone: 'success' });
    if (tour) {
      const next = shownPoints.find((pt) => pt.id !== p.id && !visited.has(pt.id));
      if (next) setActiveId(next.id);
    }
    stopNavigation();
  };

  const locate = () => {
    if (location.status === 'off' || location.status === 'denied' || location.status === 'unavailable') location.enableGps();
    setFollow(!!navTarget);
    mapRef.current?.centerOn(location.position, 17);
  };

  const tourVisited = tour ? shownPoints.filter((p) => visited.has(p.id)).length : 0;
  const progressPct = tour && shownPoints.length ? Math.round((tourVisited / shownPoints.length) * 100) : 0;
  const farAway = location.gpsPosition && (location.distanceToBarrio ?? 0) > BARRIO_RADIUS_M;

  // ── Piezas de la interfaz ────────────────────────────────────────────────
  const header = (
    <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={() => goBack(tour ? `/recorrido/${tour.id}` : '/inicio')}
        aria-label="Volver"
        className="w-11 h-11 rounded-full bg-surface-container-lowest text-primary shadow-md lg:shadow-none flex items-center justify-center border border-outline-variant/70 active:scale-95 shrink-0"
      >
        <Icon name="arrow_back" className="text-[22px]" />
      </button>
      <div className="flex-1 min-w-0 bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl px-3.5 py-2 shadow-md lg:shadow-none border border-outline-variant/70">
        {tour ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-primary truncate">
                {activeIndex >= 0 ? `Punto ${activeIndex + 1} de ${shownPoints.length}` : `${shownPoints.length} puntos`}
              </span>
              <span className="text-[11px] font-bold text-secondary shrink-0">{progressPct}% completado</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-1" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del recorrido">
              <div className="bg-primary-container h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] text-on-surface-variant truncate mt-1">{tour.title}</p>
          </>
        ) : (
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-outline">Mostrando</span>
            <select
              value=""
              onChange={(e) => e.target.value && navigate(`/mapa/${e.target.value}`, { replace: true })}
              className="w-full bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer -ml-0.5"
              aria-label="Elegir un recorrido para ver en el mapa"
            >
              <option value="">Todos los puntos ({shownPoints.length}) · elegir recorrido…</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );

  const locationChip = (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={locate}
        className={`w-full lg:w-auto px-3 py-1.5 rounded-full text-[11px] font-bold shadow-sm border flex items-center justify-center gap-1 ${
          location.source === 'gps' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'
        }`}
      >
        <Icon name={location.source === 'gps' ? 'my_location' : location.status === 'requesting' ? 'location_searching' : 'location_searching'} className="text-[14px]" />
        <span className="truncate">{location.status === 'off' ? 'Activar GPS · ahora ves una ubicación simulada' : locationLabel(location)}</span>
      </button>
      {farAway && (
        <div className="px-3 py-2 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm text-[11px] text-on-surface-variant flex items-center gap-2">
          <Icon name="travel_explore" className="text-secondary text-[18px] shrink-0" />
          <span className="flex-1">Estás a {formatDistance(location.distanceToBarrio ?? 0)} del barrio.</span>
          {location.canSimulate && (
            <button type="button" onClick={() => location.setSimulating(!location.simulating)} className="font-bold text-primary underline-offset-2 hover:underline shrink-0">
              {location.simulating ? 'Usar mi GPS' : 'Simular que estoy allí'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const pointCard = active && (
    <PointCard
      point={active}
      tour={tour}
      index={activeIndex}
      meters={haversineMeters(location.position, active.coords)}
      ratingText={`${formatRating(getRating(ratings, 'point', active.id).average)} (${getRating(ratings, 'point', active.id).count})`}
      visited={visited.has(active.id)}
      onPrev={tour && activeIndex > 0 ? () => selectPoint(tour.pointIds[activeIndex - 1]) : undefined}
      onNext={tour && activeIndex >= 0 && activeIndex < shownPoints.length - 1 ? () => selectPoint(tour.pointIds[activeIndex + 1]) : undefined}
      onDirections={() => startNavigation(active)}
      onPlay={() => play({ id: active.id, title: active.title, narrator: active.audioNarrator, seconds: active.audioSeconds })}
    />
  );

  const navPanel = navTarget && (
    <NavigationPanel
      target={navTarget}
      route={route}
      loading={routeLoading}
      online={online}
      remaining={remaining}
      along={progress?.along ?? 0}
      arrived={arrived}
      sealed={visited.has(navTarget.id)}
      gps={location.source === 'gps'}
      walking={walking}
      onToggleWalk={() => setWalking((w) => !w)}
      onStop={stopNavigation}
      onSeal={() => seal(navTarget)}
      onOpenFicha={() => navigate(buildPath(`/punto/${navTarget.id}`, { recorrido: tour?.id }))}
    />
  );

  const pointList = (
    <ol className="space-y-1.5" aria-label="Puntos en el mapa">
      {shownPoints.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => selectPoint(p.id)}
            aria-current={p.id === activeId ? 'true' : undefined}
            className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
              p.id === activeId ? 'bg-secondary-fixed/50 ring-1 ring-secondary/40' : 'hover:bg-surface-container'
            }`}
          >
            <span className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${visited.has(p.id) ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-primary'}`}>
              {visited.has(p.id) ? <Icon name="check" className="text-[15px]" /> : tour ? String(i + 1).padStart(2, '0') : <Icon name="location_on" className="text-[15px]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-on-surface truncate">{p.title}</span>
              <span className="block text-[11px] text-on-surface-variant truncate">
                {p.kindLabel} · {formatDistance(haversineMeters(location.position, p.coords))}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  const tools = (
    <div className="flex flex-col gap-2.5">
      <MapButton icon={follow ? 'navigation' : 'my_location'} label={follow ? 'Siguiendo tu ubicación' : 'Centrar en mi ubicación'} onClick={locate} active={follow} />
      <MapButton icon="zoom_out_map" label="Ver todos los puntos" onClick={() => { setFollow(false); mapRef.current?.fitTo(shownPoints.map((p) => p.coords), 17); }} />
      <MapButton icon="qr_code_scanner" label="Escanear placa QR" onClick={onOpenQrScanner} primary />
      <div className="flex flex-col rounded-xl bg-surface-container-lowest shadow-md border border-outline-variant/70 overflow-hidden">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar" className="w-11 h-10 hover:bg-surface-container flex items-center justify-center">
          <Icon name="add" className="text-[20px]" />
        </button>
        <span className="h-px bg-outline-variant/60" />
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar" className="w-11 h-10 hover:bg-surface-container flex items-center justify-center">
          <Icon name="remove" className="text-[20px]" />
        </button>
      </div>
    </div>
  );

  const map = (
    <LeafletMap
      ref={mapRef}
      points={shownPoints}
      routePointIds={tour?.pointIds}
      activePointId={activeId}
      visitedIds={visited}
      user={{ coords: location.position, accuracy: location.accuracy, heading: location.heading, simulated: location.source === 'simulated' }}
      tourPath={tourRoute?.coords ?? (tour ? shownPoints.map((p) => p.coords) : null)}
      navPath={route ? [progress?.snapped ?? location.position, ...route.coords.slice(nearestIndex(route, progress?.along ?? 0))] : null}
      onSelectPoint={selectPoint}
      onUserPan={() => setFollow(false)}
      insets={insets}
      className="absolute inset-0"
      ariaLabel={tour ? `Mapa del recorrido ${tour.title}` : 'Mapa de todos los puntos de interés del barrio'}
    />
  );

  // ── Computador: panel lateral + mapa ─────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <aside className="w-[360px] xl:w-[400px] shrink-0 h-full overflow-y-auto border-r border-outline-variant/60 bg-surface p-4 space-y-4" aria-label="Panel del mapa">
          {header}
          {locationChip}
          {navPanel || pointCard}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2">{tour ? 'Paradas del recorrido' : 'Todos los puntos'}</h2>
            {pointList}
          </section>
        </aside>
        <div className="relative flex-1 min-w-0">
          {map}
          <div className="absolute right-4 top-4 z-30">{tools}</div>
        </div>
      </div>
    );
  }

  // ── Celular: mapa a pantalla completa + hoja inferior ────────────────────
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {map}
      <div className="absolute top-3 left-3 right-3 z-30 space-y-2 max-w-xl mx-auto pt-[env(safe-area-inset-top)]">
        {header}
        {locationChip}
      </div>
      <div className="absolute right-3 top-[150px] z-30">{tools}</div>

      <section ref={sheetRef} className="absolute bottom-[72px] left-0 right-0 z-30 px-3 pb-2 max-w-2xl mx-auto" aria-live="polite">
        {showList ? (
          <div className="bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant p-3 max-h-[52dvh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-outline">{tour ? 'Paradas del recorrido' : 'Todos los puntos'}</h2>
              <button type="button" onClick={() => setShowList(false)} aria-label="Cerrar lista" className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center">
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            {pointList}
          </div>
        ) : (
          navPanel ||
          pointCard || (
            <div className="bg-surface-container-lowest/95 rounded-2xl shadow-md border border-outline-variant px-4 py-3 text-xs text-on-surface-variant flex items-center gap-2">
              <Icon name="touch_app" className="text-secondary" /> Toca un punto del mapa para ver su historia y cómo llegar.
            </div>
          )
        )}
        {!navTarget && !showList && (
          <button
            type="button"
            onClick={() => setShowList(true)}
            className="mt-2 mx-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest/95 border border-outline-variant shadow-sm text-[11px] font-bold text-primary"
          >
            <Icon name="list" className="text-[16px]" /> Ver lista de puntos
          </button>
        )}
      </section>
    </div>
  );
};

/** Índice del primer vértice de la ruta que aún no se ha recorrido. */
function nearestIndex(route: WalkingRoute, along: number): number {
  let acc = 0;
  for (let i = 1; i < route.coords.length; i++) {
    acc += haversineMeters(route.coords[i - 1], route.coords[i]);
    if (acc > along) return i;
  }
  return route.coords.length - 1;
}

const MapButton: React.FC<{ icon: string; label: string; onClick: () => void; primary?: boolean; active?: boolean }> = ({ icon, label, onClick, primary, active }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    aria-pressed={active}
    className={`w-11 h-11 rounded-full shadow-md flex items-center justify-center border active:scale-95 transition-transform ${
      primary || active ? 'bg-primary-container text-on-primary border-primary' : 'bg-surface-container-lowest text-primary border-outline-variant/70 hover:bg-surface-container'
    }`}
  >
    <Icon name={icon} className="text-[21px]" fill={active} />
  </button>
);

interface NavigationPanelProps {
  target: PointOfInterest;
  route: WalkingRoute | null;
  loading: boolean;
  online: boolean;
  remaining: number;
  along: number;
  arrived: boolean;
  sealed: boolean;
  gps: boolean;
  walking: boolean;
  onToggleWalk: () => void;
  onStop: () => void;
  onSeal: () => void;
  onOpenFicha: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ target, route, loading, online, remaining, along, arrived, sealed, gps, walking, onToggleWalk, onStop, onSeal, onOpenFicha }) => {
  if (arrived) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl shadow-xl lg:shadow-none border border-outline-variant p-4 animate-slide-up">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <Icon name="where_to_vote" fill className="text-[24px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Has llegado</p>
            <h2 className="font-serif text-lg font-bold text-primary leading-tight">{target.title}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onOpenFicha} className="h-11 rounded-full border border-primary text-primary text-xs font-bold flex items-center justify-center gap-1.5">
            <Icon name="menu_book" className="text-[18px]" /> Ver ficha
          </button>
          {sealed ? (
            <button type="button" onClick={onStop} className="h-11 rounded-full bg-primary-fixed text-primary text-xs font-bold flex items-center justify-center gap-1.5">
              <Icon name="verified" className="text-[18px]" /> Ya sellado · cerrar
            </button>
          ) : (
            <button type="button" onClick={onSeal} className="h-11 rounded-full bg-secondary text-white text-xs font-bold flex items-center justify-center gap-1.5">
              <Icon name="approval" className="text-[18px]" /> Sellar visita
            </button>
          )}
        </div>
      </div>
    );
  }

  // Próxima maniobra según lo recorrido.
  let nextIdx = -1;
  let toNext = 0;
  if (route) {
    let cum = 0;
    for (let i = 0; i < route.steps.length; i++) {
      if (i > 0 && cum > along + 3) {
        nextIdx = i;
        toNext = cum - along;
        break;
      }
      cum += route.steps[i].distance;
    }
  }
  const next = route && nextIdx >= 0 ? route.steps[nextIdx] : route?.steps[route.steps.length - 1];
  const upcoming = route && nextIdx >= 0 ? route.steps.slice(nextIdx + 1, nextIdx + 4) : [];

  return (
    <div className="bg-surface-container-lowest rounded-3xl shadow-xl lg:shadow-none border border-outline-variant p-4 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
            <Icon name="directions_walk" className="text-[15px]" /> Ruta a pie
          </p>
          <h2 className="font-serif text-lg font-bold text-primary leading-tight truncate">{target.title}</h2>
        </div>
        <div className="text-right shrink-0">
          <p className="font-serif text-2xl font-bold text-primary leading-none tabular-nums">{formatDistance(remaining)}</p>
          <p className="text-[11px] text-on-surface-variant">{walkingMinutes(remaining)} min a pie</p>
        </div>
      </div>

      {loading && !route ? (
        <p className="mt-3 text-xs text-on-surface-variant flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Calculando la mejor ruta por las calles…
        </p>
      ) : (
        next && (
          <div className="mt-3 p-3 rounded-2xl bg-primary text-on-primary flex items-center gap-3">
            <Icon name={next.icon} className="text-[28px] shrink-0" />
            <div className="min-w-0">
              {nextIdx >= 0 && <p className="text-[11px] font-bold text-primary-fixed-dim">En {formatDistance(toNext)}</p>}
              <p className="text-sm font-bold leading-snug">{next.instruction}</p>
            </div>
          </div>
        )
      )}
      {upcoming.length > 0 && (
        <ol className="mt-2 space-y-1">
          {upcoming.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <Icon name={s.icon} className="text-[16px] text-outline" />
              <span className="truncate">{s.instruction}</span>
            </li>
          ))}
        </ol>
      )}
      {route?.source === 'aproximada' && (
        <p className="mt-2 text-[11px] text-on-surface-variant flex items-center gap-1">
          <Icon name="info" className="text-[14px]" />
          {online ? 'No pudimos consultar el servicio de rutas: ruta aproximada en línea recta.' : 'Sin conexión: ruta aproximada en línea recta.'}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {gps ? (
          <span className="h-11 rounded-full bg-primary-fixed/60 text-primary text-[11px] font-bold flex items-center justify-center gap-1 text-center px-2">
            <Icon name="my_location" className="text-[16px]" /> Siguiendo tu GPS
          </span>
        ) : (
          <button type="button" onClick={onToggleWalk} disabled={!route} className="h-11 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Icon name={walking ? 'pause' : 'play_arrow'} fill className="text-[18px]" />
            {walking ? 'Pausar caminata' : 'Simular caminata'}
          </button>
        )}
        <button type="button" onClick={onStop} className="h-11 rounded-full border border-outline-variant text-on-surface-variant text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-surface-container">
          <Icon name="close" className="text-[18px]" /> Finalizar ruta
        </button>
      </div>
    </div>
  );
};

interface PointCardProps {
  point: PointOfInterest;
  tour?: Tour;
  index: number;
  meters: number;
  ratingText: string;
  visited: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onDirections: () => void;
  onPlay: () => void;
}

const PointCard: React.FC<PointCardProps> = ({ point, tour, index, meters, ratingText, visited, onPrev, onNext, onDirections, onPlay }) => (
  <div className="bg-surface-container-lowest rounded-3xl shadow-xl lg:shadow-none border border-outline-variant p-4 animate-slide-up">
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold truncate">
        <Icon name="near_me" className="text-[14px]" />A {formatDistance(meters)} (≈ {walkingMinutes(meters * 1.3)} min a pie)
      </span>
      <span className="text-xs text-on-surface-variant flex items-center gap-1 shrink-0">
        <Icon name="star" fill className="text-[15px] text-on-tertiary-container" />
        <span className="font-bold text-on-surface">{ratingText}</span>
      </span>
    </div>
    <div className="flex items-start gap-3.5 mb-3.5">
      <button type="button" onClick={onPlay} aria-label={`Escuchar el relato de ${point.title}`} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-outline-variant group">
        <SafeImage src={point.images[0]} alt={point.imageAlt} className="w-full h-full object-cover" />
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold flex items-center gap-0.5">
          <Icon name="volume_up" className="text-[11px]" />
          {formatClock(point.audioSeconds)}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-secondary text-[11px] uppercase tracking-wider font-bold truncate">
          {point.kindLabel}
          {tour && index >= 0 ? ` · Parada ${String(index + 1).padStart(2, '0')}` : ''}
          {visited ? ' · Sellado ✓' : ''}
        </p>
        <h2 className="font-serif text-lg font-bold text-primary leading-tight line-clamp-2">{point.title}</h2>
        <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5 leading-relaxed">{point.narrative}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {tour && (
        <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Punto anterior" className="w-9 h-11 rounded-full border border-outline-variant flex items-center justify-center text-primary disabled:opacity-30 shrink-0">
          <Icon name="chevron_left" />
        </button>
      )}
      <button
        type="button"
        onClick={onDirections}
        className="flex-1 h-11 px-2 rounded-full bg-surface text-secondary border border-secondary text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap hover:bg-secondary-fixed/30 active:scale-95"
      >
        <Icon name="directions_walk" className="text-[17px]" /> Cómo llegar
      </button>
      <button
        type="button"
        onClick={() => navigate(buildPath(`/punto/${point.id}`, { recorrido: tour?.id }))}
        className="flex-1 h-11 px-2 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap hover:bg-primary-container active:scale-95"
      >
        <Icon name="menu_book" className="text-[17px]" /> Ver historia
      </button>
      {tour && (
        <button type="button" onClick={onNext} disabled={!onNext} aria-label="Punto siguiente" className="w-9 h-11 rounded-full border border-outline-variant flex items-center justify-center text-primary disabled:opacity-30 shrink-0">
          <Icon name="chevron_right" />
        </button>
      )}
    </div>
  </div>
);
