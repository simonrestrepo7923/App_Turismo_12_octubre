import type { LatLng, RouteStep, WalkingRoute } from '../types';
import { CONFIG } from '../config';
import { bearingDegrees, cardinalFromBearing, haversineMeters, WALK_SPEED_M_PER_MIN } from '../lib/geo';
import { readJSON, writeJSON } from '../lib/storage';

/**
 * Rutas a pie (GEO-001) calculadas con OSRM sobre las calles de OpenStreetMap.
 * Si no hay conexión o el servicio no responde, se devuelve una ruta aproximada
 * en línea recta para que la navegación nunca quede bloqueada.
 */

// ── Respuesta de OSRM (solo los campos que se usan) ─────────────────────────
interface OsrmManeuver {
  type: string;
  modifier?: string;
  location: [number, number];
  bearing_after?: number;
  exit?: number;
}
interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: OsrmManeuver;
}
export interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    legs: { steps: OsrmStep[] }[];
  }[];
}

const MODIFIER_TEXT: Record<string, string> = {
  left: 'a la izquierda',
  right: 'a la derecha',
  'slight left': 'levemente a la izquierda',
  'slight right': 'levemente a la derecha',
  'sharp left': 'cerrado a la izquierda',
  'sharp right': 'cerrado a la derecha',
  straight: 'recto',
  uturn: 'en U',
};

const MODIFIER_ICON: Record<string, string> = {
  left: 'turn_left',
  right: 'turn_right',
  'slight left': 'turn_slight_left',
  'slight right': 'turn_slight_right',
  'sharp left': 'turn_sharp_left',
  'sharp right': 'turn_sharp_right',
  straight: 'straight',
  uturn: 'u_turn_left',
};

const via = (name: string) => (name ? ` por ${name}` : '');

/** Convierte una maniobra de OSRM en una instrucción en español. */
export function describeStep(step: OsrmStep, isLast: boolean, destinationName?: string): { instruction: string; icon: string } {
  const m = step.maneuver;
  const mod = m.modifier ?? 'straight';
  const turn = MODIFIER_TEXT[mod] ?? 'recto';
  switch (m.type) {
    case 'depart':
      return {
        instruction: `Sal hacia el ${cardinalFromBearing(m.bearing_after ?? 0)}${via(step.name)}`,
        icon: 'directions_walk',
      };
    case 'arrive':
      return { instruction: isLast && destinationName ? `Llegas a ${destinationName}` : 'Llegas al punto intermedio', icon: 'where_to_vote' };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return { instruction: `En la glorieta toma la ${m.exit ? `${m.exit}.ª ` : ''}salida${via(step.name)}`, icon: 'roundabout_right' };
    case 'fork':
      return { instruction: `En la bifurcación mantente ${turn}${via(step.name)}`, icon: MODIFIER_ICON[mod] ?? 'fork_right' };
    case 'end of road':
      return { instruction: `Al final de la vía gira ${turn}${via(step.name)}`, icon: MODIFIER_ICON[mod] ?? 'turn_right' };
    case 'new name':
    case 'continue':
      if (mod === 'straight' || !MODIFIER_TEXT[mod]) return { instruction: `Continúa recto${via(step.name)}`, icon: 'straight' };
      return { instruction: `Sigue ${turn}${via(step.name)}`, icon: MODIFIER_ICON[mod] };
    default:
      if (mod === 'straight') return { instruction: `Continúa recto${via(step.name)}`, icon: 'straight' };
      if (mod === 'uturn') return { instruction: `Da la vuelta${via(step.name)}`, icon: 'u_turn_left' };
      return { instruction: `Gira ${turn}${via(step.name)}`, icon: MODIFIER_ICON[mod] ?? 'turn_right' };
  }
}

/** Transforma la respuesta de OSRM en una ruta de la app. Devuelve `null` si no es válida. */
export function parseOsrm(data: OsrmResponse, destinationName?: string): WalkingRoute | null {
  const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
  if (!route || route.geometry.coordinates.length < 2) return null;
  const allSteps = route.legs.flatMap((leg, li) => leg.steps.map((s) => ({ s, lastLeg: li === route.legs.length - 1 })));
  const steps: RouteStep[] = [];
  allSteps.forEach(({ s, lastLeg }, i) => {
    const isArrive = s.maneuver.type === 'arrive';
    // Las llegadas intermedias de un recorrido con varias paradas no aportan.
    if (isArrive && !(lastLeg && i === allSteps.length - 1)) return;
    const { instruction, icon } = describeStep(s, lastLeg && i === allSteps.length - 1, destinationName);
    steps.push({
      instruction,
      icon,
      distance: s.distance,
      location: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
    });
  });
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: route.distance,
    // OSRM calcula a velocidad de terreno plano; en ladera se camina más despacio.
    duration: Math.max(route.duration, (route.distance / WALK_SPEED_M_PER_MIN) * 60),
    steps,
    source: 'osrm',
  };
}

/** Ruta aproximada en línea recta entre los puntos (sin conexión). */
export function approximateRoute(waypoints: LatLng[], destinationName?: string): WalkingRoute {
  const steps: RouteStep[] = [];
  let distance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const d = haversineMeters(waypoints[i - 1], waypoints[i]);
    distance += d;
    steps.push({
      instruction: `Camina hacia el ${cardinalFromBearing(bearingDegrees(waypoints[i - 1], waypoints[i]))}`,
      icon: 'near_me',
      distance: d,
      location: waypoints[i - 1],
    });
  }
  steps.push({
    instruction: destinationName ? `Llegas a ${destinationName}` : 'Llegas a tu destino',
    icon: 'where_to_vote',
    distance: 0,
    location: waypoints[waypoints.length - 1],
  });
  return { coords: waypoints, distance, duration: (distance / WALK_SPEED_M_PER_MIN) * 60, steps, source: 'aproximada' };
}

const memoryCache = new Map<string, WalkingRoute>();
const PERSIST_KEY = 'ruta12:routes';
const round = (n: number) => n.toFixed(5);
const cacheKey = (wps: LatLng[]) => wps.map((p) => `${round(p.lat)},${round(p.lng)}`).join(';');

function persisted(): Record<string, WalkingRoute> {
  return readJSON<Record<string, WalkingRoute>>(PERSIST_KEY) ?? {};
}

/**
 * Calcula la ruta a pie que pasa por los puntos dados.
 * @param persist guarda el resultado para usarlo sin conexión (útil para los trazados de recorridos).
 */
export async function getWalkingRoute(
  waypoints: LatLng[],
  options: { destinationName?: string; persist?: boolean; signal?: AbortSignal } = {},
): Promise<WalkingRoute> {
  if (waypoints.length < 2) return approximateRoute(waypoints.length ? [waypoints[0], waypoints[0]] : [], options.destinationName);
  const key = cacheKey(waypoints);
  const cached = memoryCache.get(key) ?? (options.persist ? persisted()[key] : undefined);
  if (cached) return cached;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return approximateRoute(waypoints, options.destinationName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.routingTimeoutMs);
  options.signal?.addEventListener('abort', () => controller.abort());
  try {
    const coords = waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${CONFIG.routingUrl}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseOsrm((await res.json()) as OsrmResponse, options.destinationName);
    if (!parsed) throw new Error('Respuesta sin ruta');
    memoryCache.set(key, parsed);
    if (options.persist) {
      const all = persisted();
      all[key] = parsed;
      // Se conservan solo las últimas 20 rutas guardadas.
      const keys = Object.keys(all);
      for (const k of keys.slice(0, Math.max(0, keys.length - 20))) delete all[k];
      writeJSON(PERSIST_KEY, all);
    }
    return parsed;
  } catch (err) {
    if (options.signal?.aborted) throw err;
    return approximateRoute(waypoints, options.destinationName);
  } finally {
    clearTimeout(timeout);
  }
}
