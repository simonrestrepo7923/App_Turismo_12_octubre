import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CategoryId, LatLng, PointOfInterest } from '../../types';
import { CATEGORY_BY_ID } from '../../data/categories';
import { CONFIG } from '../../config';
import { BARRIO_BOUNDS, BARRIO_CENTER } from '../../lib/geo';
import { ILLUSTRATED_PLAN_SVG } from './illustratedPlan';
import { Icon } from '../ui/Icon';

/**
 * Mapa interactivo sobre OpenStreetMap (MAPA-001).
 * Muestra los puntos de interés, el trazado del recorrido, la ubicación del
 * visitante con su precisión y la ruta a pie hacia un destino (GEO-001).
 * Si las teselas no cargan (sin conexión), superpone el plano ilustrado del barrio.
 */

export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LeafletMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitTo: (coords: LatLng[], maxZoom?: number) => void;
  centerOn: (c: LatLng, zoom?: number) => void;
}

export interface UserMarker {
  coords: LatLng;
  accuracy: number | null;
  heading: number | null;
  simulated: boolean;
}

interface LeafletMapProps {
  points: PointOfInterest[];
  /** Orden del recorrido: numera los pines. */
  routePointIds?: string[];
  activePointId?: string | null;
  visitedIds?: Set<string>;
  user?: UserMarker | null;
  tourPath?: LatLng[] | null;
  navPath?: LatLng[] | null;
  onSelectPoint?: (pointId: string) => void;
  onMapClick?: (c: LatLng) => void;
  /** Se llama cuando la persona arrastra el mapa (para dejar de seguir su ubicación). */
  onUserPan?: () => void;
  insets?: MapInsets;
  className?: string;
  ariaLabel?: string;
  initialZoom?: number;
}

const ZERO: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export const CATEGORY_COLOR: Record<CategoryId, string> = {
  historico: '#1B4332',
  recreacion: '#A23E18',
  gastronomia: '#8A5A00',
  musica: '#5B3F8C',
  miradores: '#2D6A4F',
};

const ll = (c: LatLng) => L.latLng(c.lat, c.lng);

function pinIcon(p: PointOfInterest, index: number | undefined, active: boolean, visited: boolean): L.DivIcon {
  const label =
    visited && !active
      ? '<span class="material-symbols-outlined r12-pin__glyph">check</span>'
      : index !== undefined
        ? `<span class="r12-pin__num">${String(index + 1).padStart(2, '0')}</span>`
        : `<span class="material-symbols-outlined r12-pin__glyph">${CATEGORY_BY_ID[p.category].icon}</span>`;
  const cls = `r12-pin${active ? ' r12-pin--active' : ''}${visited ? ' r12-pin--visited' : ''}`;
  return L.divIcon({
    className: 'r12-pin-wrap',
    html: `<div class="${cls}" style="--pin:${CATEGORY_COLOR[p.category]}">${label}</div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 44],
  });
}

function userIcon(heading: number | null, simulated: boolean): L.DivIcon {
  return L.divIcon({
    className: 'r12-user-wrap',
    html: `<div class="r12-user${simulated ? ' r12-user--sim' : ''}">${
      heading !== null ? `<span class="r12-user__cone" style="transform:rotate(${heading}deg)"></span>` : ''
    }<span class="r12-user__pulse"></span><span class="r12-user__dot"></span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  {
    points,
    routePointIds,
    activePointId,
    visitedIds,
    user,
    tourPath,
    navPath,
    onSelectPoint,
    onMapClick,
    onUserPan,
    insets = ZERO,
    className = '',
    ariaLabel = 'Mapa del barrio Doce de Octubre',
    initialZoom = 16,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{ markers: L.LayerGroup; tour: L.LayerGroup; nav: L.LayerGroup; user: L.LayerGroup } | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const callbacks = useRef({ onSelectPoint, onMapClick, onUserPan });
  callbacks.current = { onSelectPoint, onMapClick, onUserPan };
  const [offlinePlan, setOfflinePlan] = useState(false);

  // ── Creación del mapa ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, {
      center: ll(BARRIO_CENTER),
      zoom: initialZoom,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: false,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 110 }).addTo(map);
    mapRef.current = map;

    const tiles = L.tileLayer(CONFIG.tileUrl, {
      subdomains: CONFIG.tileSubdomains,
      attribution: CONFIG.tileAttribution,
      maxZoom: 19,
      detectRetina: false,
    }).addTo(map);

    // Respaldo sin conexión: si ninguna tesela carga, se muestra el plano ilustrado.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = ILLUSTRATED_PLAN_SVG;
    const plan = L.svgOverlay(svg, L.latLngBounds([BARRIO_BOUNDS.south, BARRIO_BOUNDS.west], [BARRIO_BOUNDS.north, BARRIO_BOUNDS.east]), {
      opacity: 0.95,
      interactive: false,
    });
    let loaded = 0;
    let failed = 0;
    const showPlan = () => {
      if (!map.hasLayer(plan)) plan.addTo(map).bringToBack();
      setOfflinePlan(true);
    };
    tiles.on('tileload', () => {
      loaded++;
      if (map.hasLayer(plan)) plan.remove();
      setOfflinePlan(false);
    });
    tiles.on('tileerror', () => {
      failed++;
      if (failed >= 3 && loaded === 0) showPlan();
    });
    if (navigator.onLine === false) showPlan();

    layers.current = {
      tour: L.layerGroup().addTo(map),
      nav: L.layerGroup().addTo(map),
      markers: L.layerGroup().addTo(map),
      user: L.layerGroup().addTo(map),
    };

    map.on('click', (e: L.LeafletMouseEvent) => callbacks.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.on('dragstart', () => callbacks.current.onUserPan?.());

    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layers.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API imperativa ───────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      fitTo: (coords, maxZoom = 18) => {
        const map = mapRef.current;
        if (!map || coords.length === 0) return;
        const i = insetsRef.current;
        if (coords.length === 1) {
          centerWithInsets(map, coords[0], Math.max(map.getZoom(), 17), i);
          return;
        }
        map.fitBounds(L.latLngBounds(coords.map(ll)), {
          paddingTopLeft: [i.left + 40, i.top + 40],
          paddingBottomRight: [i.right + 40, i.bottom + 40],
          maxZoom,
          animate: true,
        });
      },
      centerOn: (c, zoom) => {
        const map = mapRef.current;
        if (map) centerWithInsets(map, c, zoom ?? map.getZoom(), insetsRef.current);
      },
    }),
    [],
  );

  // ── Pines ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const group = layers.current?.markers;
    if (!group) return;
    group.clearLayers();
    const order = new Map((routePointIds ?? []).map((id, i) => [id, i]));
    for (const p of points) {
      const active = p.id === activePointId;
      const marker = L.marker(ll(p.coords), {
        icon: pinIcon(p, order.get(p.id), active, visitedIds?.has(p.id) ?? false),
        title: p.title,
        alt: p.title,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: active ? 1000 : 0,
      });
      marker.on('click', () => callbacks.current.onSelectPoint?.(p.id));
      marker.on('keypress', (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') callbacks.current.onSelectPoint?.(p.id);
      });
      group.addLayer(marker);
    }
  }, [points, routePointIds, activePointId, visitedIds]);

  // ── Trazado del recorrido ────────────────────────────────────────────────
  useEffect(() => {
    const group = layers.current?.tour;
    if (!group) return;
    group.clearLayers();
    if (!tourPath || tourPath.length < 2) return;
    const coords = tourPath.map(ll);
    L.polyline(coords, { color: '#012D1D', opacity: 0.18, weight: 12, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(group);
    L.polyline(coords, { color: '#1B4332', weight: 5, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(group);
    L.polyline(coords, { color: '#FFDBCC', weight: 2.5, dashArray: '2 9', interactive: false, lineCap: 'round' }).addTo(group);
  }, [tourPath]);

  // ── Ruta de navegación ───────────────────────────────────────────────────
  useEffect(() => {
    const group = layers.current?.nav;
    if (!group) return;
    group.clearLayers();
    if (!navPath || navPath.length < 2) return;
    const coords = navPath.map(ll);
    L.polyline(coords, { color: '#FFFFFF', weight: 10, opacity: 0.95, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(group);
    L.polyline(coords, { color: '#A23E18', weight: 6, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(group);
    L.polyline(coords, { color: '#FFFFFF', weight: 2, dashArray: '1 10', interactive: false, lineCap: 'round' }).addTo(group);
  }, [navPath]);

  // ── Ubicación del visitante ──────────────────────────────────────────────
  useEffect(() => {
    const group = layers.current?.user;
    if (!group) return;
    group.clearLayers();
    if (!user) return;
    if (user.accuracy && user.accuracy > 8) {
      L.circle(ll(user.coords), {
        radius: Math.min(user.accuracy, 2000),
        color: '#2D6A4F',
        weight: 1,
        fillColor: '#2D6A4F',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(group);
    }
    L.marker(ll(user.coords), {
      icon: userIcon(user.heading, user.simulated),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
      alt: 'Tu ubicación',
    }).addTo(group);
  }, [user?.coords.lat, user?.coords.lng, user?.accuracy, user?.heading, user?.simulated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        className="r12-map isolate absolute inset-0 bg-[#F3EFE6]"
        style={{ ['--r12-bottom' as string]: `${insets.bottom}px`, ['--r12-left' as string]: `${insets.left}px` }}
      />
      {offlinePlan && (
        <div
          className="absolute z-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-on-surface/85 text-surface text-[11px] font-bold flex items-center gap-1.5 shadow-md pointer-events-none max-w-[90%]"
          style={{ top: insets.top + 8, marginLeft: (insets.left - insets.right) / 2 }}
          role="status"
        >
          <Icon name="cloud_off" className="text-[15px]" />
          Sin conexión: se muestra el plano ilustrado del barrio
        </div>
      )}
    </div>
  );
});

function centerWithInsets(map: L.Map, c: LatLng, zoom: number, i: MapInsets) {
  const target = map.project(ll(c), zoom).add(L.point((i.right - i.left) / 2, (i.bottom - i.top) / 2));
  map.setView(map.unproject(target, zoom), zoom, { animate: true });
}
