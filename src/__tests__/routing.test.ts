import { describe, expect, it } from 'vitest';
import { approximateRoute, describeStep, parseOsrm, type OsrmResponse } from '../services/routing';

const OSRM: OsrmResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 420.5,
      duration: 302,
      geometry: { type: 'LineString', coordinates: [[-75.5824, 6.3006], [-75.5824, 6.3012], [-75.5807, 6.3012], [-75.5807, 6.3015]] },
      legs: [
        {
          steps: [
            { distance: 66, duration: 47, name: 'Carrera 80', maneuver: { type: 'depart', location: [-75.5824, 6.3006], bearing_after: 2 } },
            { distance: 188, duration: 135, name: 'Calle 104', maneuver: { type: 'turn', modifier: 'right', location: [-75.5824, 6.3012] } },
            { distance: 33, duration: 24, name: '', maneuver: { type: 'turn', modifier: 'left', location: [-75.5807, 6.3012] } },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [-75.5807, 6.3015] } },
          ],
        },
      ],
    },
  ],
};

describe('rutas a pie (GEO-001)', () => {
  it('convierte la respuesta de OSRM en una ruta con indicaciones en español', () => {
    const r = parseOsrm(OSRM, 'Casa Museo Popular')!;
    expect(r.source).toBe('osrm');
    expect(r.coords).toHaveLength(4);
    expect(r.coords[0]).toEqual({ lat: 6.3006, lng: -75.5824 });
    expect(r.steps.map((s) => s.instruction)).toEqual([
      'Sal hacia el norte por Carrera 80',
      'Gira a la derecha por Calle 104',
      'Gira a la izquierda',
      'Llegas a Casa Museo Popular',
    ]);
    // En ladera se camina más despacio que el cálculo de OSRM.
    expect(r.duration).toBeGreaterThanOrEqual(r.distance / 70 * 60);
  });

  it('rechaza respuestas sin ruta', () => {
    expect(parseOsrm({ code: 'NoRoute' })).toBeNull();
  });

  it('traduce maniobras especiales', () => {
    expect(describeStep({ distance: 10, duration: 5, name: 'Calle 102', maneuver: { type: 'roundabout', exit: 2, location: [0, 0] } }, false).instruction).toBe(
      'En la glorieta toma la 2.ª salida por Calle 102',
    );
    expect(describeStep({ distance: 10, duration: 5, name: '', maneuver: { type: 'end of road', modifier: 'left', location: [0, 0] } }, false).instruction).toBe(
      'Al final de la vía gira a la izquierda',
    );
  });

  it('ofrece una ruta aproximada sin conexión', () => {
    const r = approximateRoute([{ lat: 6.3, lng: -75.58 }, { lat: 6.301, lng: -75.58 }], 'Plaza');
    expect(r.source).toBe('aproximada');
    expect(r.distance).toBeCloseTo(111.2, 0);
    expect(r.steps[0].instruction).toBe('Camina hacia el norte');
    expect(r.steps.at(-1)?.instruction).toBe('Llegas a Plaza');
  });
});
