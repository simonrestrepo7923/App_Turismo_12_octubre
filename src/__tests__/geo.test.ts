import { describe, expect, it } from 'vitest';
import { BARRIO_CENTER, isInsideAntioquia, bearingDegrees, cardinalFromBearing, formatDistance, haversineMeters, isInsideBarrio, pointAlongPath, polylineLength, progressAlongPath } from '../lib/geo';
import { SEED_POINTS } from '../data/points';

describe('geolocalización', () => {
  it('calcula distancias reales en metros', () => {
    // 0,001° de latitud ≈ 111 m
    expect(haversineMeters({ lat: 6.3, lng: -75.58 }, { lat: 6.301, lng: -75.58 })).toBeCloseTo(111.2, 0);
    expect(haversineMeters(BARRIO_CENTER, BARRIO_CENTER)).toBe(0);
  });

  it('obtiene el rumbo y la dirección cardinal', () => {
    expect(cardinalFromBearing(bearingDegrees({ lat: 6.3, lng: -75.58 }, { lat: 6.31, lng: -75.58 }))).toBe('norte');
    expect(cardinalFromBearing(bearingDegrees({ lat: 6.3, lng: -75.58 }, { lat: 6.3, lng: -75.57 }))).toBe('oriente');
  });

  it('reconoce ubicaciones dentro y fuera de Antioquia', () => {
    expect(isInsideAntioquia({ lat: 6.2087, lng: -75.5701 })).toBe(true); // El Poblado, Medellín
    expect(isInsideAntioquia({ lat: 7.8939, lng: -76.6283 })).toBe(true); // Apartadó
    expect(isInsideAntioquia({ lat: 4.711, lng: -74.0721 })).toBe(false); // Bogotá
    expect(isInsideAntioquia({ lat: 3.4516, lng: -76.532 })).toBe(false); // Cali
  });

  it('todos los puntos de interés están dentro del barrio', () => {
    for (const p of SEED_POINTS) expect(isInsideBarrio(p.coords, 1500)).toBe(true);
  });

  it('mide el avance sobre un trazado y detecta desvíos', () => {
    const path = [
      { lat: 6.3, lng: -75.58 },
      { lat: 6.301, lng: -75.58 },
      { lat: 6.301, lng: -75.579 },
    ];
    const total = polylineLength(path);
    const mid = pointAlongPath(path, 50);
    const p = progressAlongPath(path, mid);
    expect(p.along).toBeCloseTo(50, 0);
    expect(p.remaining).toBeCloseTo(total - 50, 0);
    expect(p.offset).toBeLessThan(1);
    const off = progressAlongPath(path, { lat: 6.3005, lng: -75.5795 });
    expect(off.offset).toBeGreaterThan(40);
    expect(pointAlongPath(path, 99999)).toEqual(path[2]);
  });

  it('formatea distancias en español', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1530)).toBe('1,5 km');
  });
});
