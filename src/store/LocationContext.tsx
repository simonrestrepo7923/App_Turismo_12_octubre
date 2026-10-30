import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types';
import { BARRIO_CENTER, haversineMeters, isInsideAntioquia, isInsideBarrio } from '../lib/geo';

/**
 * Ubicación del visitante (MAPA-001 escenario 2 y GEO-001).
 *
 * - Con el GPS activo se usa la posición real del dispositivo (con su precisión y rumbo).
 * - Si el GPS está apagado o fue denegado, o si el visitante está lejos del barrio y
 *   prefiere probar la app, se usa una posición simulada dentro de la Comuna 6.
 */

export type GpsStatus = 'off' | 'requesting' | 'active' | 'denied' | 'unavailable';

interface LocationValue {
  /** Posición efectiva que usa la app (real o simulada). */
  position: LatLng;
  source: 'gps' | 'simulated';
  status: GpsStatus;
  /** Precisión en metros de la lectura GPS (null si es simulada). */
  accuracy: number | null;
  /** Rumbo en grados cuando el dispositivo está en movimiento. */
  heading: number | null;
  /** Posición GPS real aunque se esté simulando. */
  gpsPosition: LatLng | null;
  /** Distancia del GPS real al centro del barrio. */
  distanceToBarrio: number | null;
  /** El visitante eligió simular que está en el barrio. */
  simulating: boolean;
  /** Se puede simular estar en el barrio (no si el GPS real está dentro de Antioquia). */
  canSimulate: boolean;
  enableGps: () => void;
  disableGps: () => void;
  setSimulatedPosition: (pos: LatLng) => void;
  setSimulating: (value: boolean) => void;
}

/** Punto de partida simulado dentro de la Comuna 6. */
export const DEFAULT_SIMULATED_POSITION: LatLng = { lat: 6.30098, lng: -75.58258 };

const LocationContext = createContext<LocationValue | null>(null);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<GpsStatus>('off');
  const [gps, setGps] = useState<{ coords: LatLng; accuracy: number; heading: number | null } | null>(null);
  const [simulated, setSimulated] = useState<LatLng>(DEFAULT_SIMULATED_POSITION);
  const [simulating, setSimulating] = useState(false);
  const watchId = useRef<number | null>(null);

  const stopWatch = () => {
    if (watchId.current !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  const enableGps = useCallback(() => {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setStatus('unavailable');
      return;
    }
    stopWatch();
    setStatus('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const heading = pos.coords.heading !== null && !Number.isNaN(pos.coords.heading) && (pos.coords.speed ?? 0) > 0.3 ? pos.coords.heading : null;
        setGps({ coords, accuracy: pos.coords.accuracy, heading });
        setStatus('active');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps(null);
          setStatus('denied');
          stopWatch();
          return;
        }
        // Pérdidas momentáneas de señal (techos, túneles): se sigue escuchando y se
        // conserva la última posición conocida.
        setGps((last) => {
          if (!last) setStatus('unavailable');
          return last;
        });
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }, []);

  const disableGps = useCallback(() => {
    stopWatch();
    setGps(null);
    setStatus('off');
  }, []);

  // Si el permiso ya se había concedido antes, el GPS se activa solo.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (!cancelled && p.state === 'granted') enableGps();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [enableGps]);

  const value = useMemo<LocationValue>(() => {
    const distanceToBarrio = gps ? haversineMeters(gps.coords, BARRIO_CENTER) : null;
    const canSimulate = !gps || !isInsideAntioquia(gps.coords);
    const useGps = status === 'active' && gps !== null && (!simulating || !canSimulate);
    return {
      position: useGps ? gps.coords : simulated,
      source: useGps ? 'gps' : 'simulated',
      status,
      accuracy: useGps ? gps.accuracy : null,
      heading: useGps ? gps.heading : null,
      gpsPosition: gps?.coords ?? null,
      distanceToBarrio,
      simulating: simulating && canSimulate,
      canSimulate,
      enableGps,
      disableGps,
      setSimulatedPosition: setSimulated,
      setSimulating,
    };
  }, [gps, status, simulated, simulating, enableGps, disableGps]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export function useLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation debe usarse dentro de <LocationProvider>');
  return ctx;
}

/** Texto corto del estado de ubicación para mostrar en pantalla. */
export function locationLabel(loc: LocationValue): string {
  if (loc.source === 'gps') {
    const acc = loc.accuracy ?? 0;
    if (acc > 150) return `GPS activo · precisión baja (±${Math.round(acc)} m)`;
    return acc >= 1 ? `GPS activo · ±${Math.round(acc)} m` : 'GPS activo';
  }
  if (loc.simulating && loc.gpsPosition && !isInsideBarrio(loc.gpsPosition)) return 'Simulando que estás en el barrio';
  switch (loc.status) {
    case 'requesting':
      return 'Buscando señal GPS…';
    case 'denied':
      return 'Permiso de ubicación denegado · ubicación simulada';
    case 'unavailable':
      return window.isSecureContext ? 'GPS no disponible · ubicación simulada' : 'El GPS requiere HTTPS · ubicación simulada';
    default:
      return 'GPS apagado · ubicación simulada';
  }
}
