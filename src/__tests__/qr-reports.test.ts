import { describe, expect, it } from 'vitest';
import { findPointByQr, parseQrPayload } from '../services/qr';
import { buildTourReport } from '../services/reports';
import { SEED_POINTS } from '../data/points';
import { SEED_TOURS } from '../data/tours';
import type { Review, Visit } from '../types';

describe('códigos QR (QR-001)', () => {
  it('lee la URL completa o el código suelto', () => {
    expect(parseQrPayload('https://ejemplo.org/app/#/qr/QR-DOCE-02')).toBe('QR-DOCE-02');
    expect(parseQrPayload('  qr-doce-02 ')).toBe('QR-DOCE-02');
    expect(parseQrPayload('https://otra-pagina.com')).toBeNull();
    expect(parseQrPayload('')).toBeNull();
  });

  it('encuentra el punto o reporta código no válido', () => {
    expect(findPointByQr('QR-DOCE-02', SEED_POINTS)?.id).toBe('casa-cultura-pedregal');
    expect(findPointByQr('QR-FALSO', SEED_POINTS)).toBeNull();
    expect(findPointByQr(null, SEED_POINTS)).toBeNull();
  });
});

describe('reportes (REP-001)', () => {
  const tour = SEED_TOURS[0];
  const review = (targetType: Review['targetType'], targetId: string, rating: number, date: string): Review => ({
    id: Math.random().toString(),
    targetType,
    targetId,
    userId: 'u',
    authorName: 'X',
    rating,
    comment: 'ok',
    date,
  });
  const reviews = [
    review('tour', tour.id, 5, '2026-03-10T12:00:00Z'),
    review('point', tour.pointIds[0], 3, '2026-03-11T12:00:00Z'),
    review('tour', tour.id, 1, '2025-01-01T12:00:00Z'), // fuera del rango
    review('tour', 'otro', 1, '2026-03-11T12:00:00Z'), // otro recorrido
  ];
  const visits: Visit[] = [
    { id: '1', userId: 'u', tourId: tour.id, date: '2026-03-10T12:00:00Z' },
    { id: '2', userId: 'u', tourId: tour.id, date: '2026-03-31T23:00:00Z' },
    { id: '3', userId: 'u', tourId: tour.id, pointId: tour.pointIds[0], date: '2026-03-10T12:00:00Z' },
    { id: '4', userId: 'u', tourId: tour.id, date: '2026-04-02T12:00:00Z' }, // fuera
  ];

  it('calcula promedio, valoraciones y visitas en el rango', () => {
    const r = buildTourReport(tour, SEED_POINTS, reviews, visits, '2026-03-01', '2026-03-31');
    expect(r.reviewCount).toBe(2);
    expect(r.average).toBe(4);
    expect(r.visitCount).toBe(2);
    expect(r.points[0].stamps).toBe(1);
    expect(r.points[0].average).toBe(3);
    expect(r.points).toHaveLength(tour.pointIds.length);
  });
});
