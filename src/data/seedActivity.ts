import type { Review, Visit } from '../types';
import { createRng, hashString } from '../lib/random';
import { SEED_POINTS } from './points';
import { SEED_TOURS } from './tours';

/**
 * Historial de demostración (valoraciones y visitas de otros caminantes durante
 * el último año). Se genera de forma determinista para que los promedios y los
 * reportes sean estables; lo que crean los usuarios se guarda aparte.
 */

const TOUR_TARGETS: Record<string, { rating: number; reviews: number; visits: number }> = {
  'memorias-del-territorio': { rating: 4.9, reviews: 142, visits: 420 },
  'parques-y-encuentro': { rating: 4.8, reviews: 98, visits: 310 },
  'sabores-del-doce': { rating: 5.0, reviews: 64, visits: 190 },
  'balcones-del-picacho': { rating: 4.9, reviews: 76, visits: 150 },
  'cultura-viva': { rating: 4.7, reviews: 52, visits: 120 },
};

const AUTHORS = [
  'Marcela G.', 'Andrés T.', 'Luisa F.', 'Camilo R.', 'Sara M.', 'Julián P.', 'Valentina C.', 'Mateo H.',
  'Daniela O.', 'Santiago V.', 'Paula A.', 'Felipe Z.', 'Natalia E.', 'Esteban L.', 'Mariana B.', 'Tomás G.',
  'Carolina J.', 'David Q.', 'Laura N.', 'Sebastián D.', 'Isabella R.', 'Alejandro M.', 'Manuela S.', 'Juan José K.',
];

const COMMENTS: Record<number, string[]> = {
  5: [
    'Muy bonito conocer la historia de cómo se construyeron estos barrios.',
    'Una de las mejores experiencias en Medellín, muy bien narrada.',
    'Los audios son conmovedores y la ruta está muy bien señalizada.',
    'Volvería con mi familia, aprendimos muchísimo del barrio.',
    'Las placas QR funcionan perfecto y las historias son hermosas.',
    'Gran trabajo de la comunidad, se nota el cariño en cada parada.',
    'Imperdible. Los guías locales hacen toda la diferencia.',
    'Me encantó la mezcla de historia, parques y comida tradicional.',
  ],
  4: [
    'Muy bien señalizado, el audio ayuda mucho a entender la historia del lugar.',
    'Recomendado. Algunas escalas son exigentes, lleven agua.',
    'Muy bonito, aunque me hubiera gustado más tiempo en cada parada.',
    'Buena experiencia, ideal para ir en la mañana.',
    'Excelente contenido; el mapa podría tener más detalle.',
  ],
  3: [
    'Interesante, pero algunos audios estaban muy largos.',
    'Bien en general, faltaba señalización en un par de esquinas.',
  ],
};

function buildRatings(target: number, count: number, rng: ReturnType<typeof createRng>): number[] {
  const ratings = new Array<number>(count).fill(5);
  let deficit = Math.round(5 * count - target * count);
  let guard = 0;
  while (deficit > 0 && guard < 10000) {
    const i = Math.floor(rng.next() * count);
    if (ratings[i] > 3) {
      ratings[i]--;
      deficit--;
    }
    guard++;
  }
  return ratings;
}

function dayOffsetToISO(today: Date, offsetDays: number, rng: ReturnType<typeof createRng>): string {
  const d = new Date(today);
  d.setDate(d.getDate() - offsetDays);
  d.setHours(rng.int(8, 17), rng.int(0, 59), 0, 0);
  return d.toISOString();
}

export function generateSeedActivity(today = new Date()): { reviews: Review[]; visits: Visit[] } {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const reviews: Review[] = [];
  const visits: Visit[] = [];

  const addReviews = (targetType: Review['targetType'], targetId: string, rating: number, count: number) => {
    const rng = createRng(hashString(targetType + targetId));
    buildRatings(rating, count, rng).forEach((r, i) => {
      reviews.push({
        id: `seed-r-${targetId}-${i}`,
        targetType,
        targetId,
        userId: 'seed',
        authorName: rng.pick(AUTHORS),
        rating: r,
        comment: rng.pick(COMMENTS[r] ?? COMMENTS[5]),
        date: dayOffsetToISO(base, rng.int(1, 365), rng),
      });
    });
  };

  for (const tour of SEED_TOURS) {
    const t = TOUR_TARGETS[tour.id];
    if (!t) continue;
    addReviews('tour', tour.id, t.rating, t.reviews);

    const rng = createRng(hashString('visits' + tour.id));
    for (let i = 0; i < t.visits; i++) {
      let offset = rng.int(0, 365);
      // Más visitas los fines de semana.
      const d = new Date(base);
      d.setDate(d.getDate() - offset);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6 && rng.next() < 0.35) offset = Math.max(0, offset - ((dow + 1) % 7));
      const date = dayOffsetToISO(base, offset, rng);
      visits.push({ id: `seed-v-${tour.id}-${i}`, userId: 'seed', tourId: tour.id, date });
      // Sellos de los puntos visitados en esa caminata (cada vez menos gente llega al final).
      tour.pointIds.forEach((pointId, idx) => {
        if (rng.next() < 0.78 - idx * 0.09) {
          visits.push({ id: `seed-s-${tour.id}-${i}-${idx}`, userId: 'seed', tourId: tour.id, pointId, date });
        }
      });
    }
  }

  for (const point of SEED_POINTS) {
    const rng = createRng(hashString('point' + point.id));
    const count = rng.int(6, 24);
    const rating = Math.round((4.4 + rng.next() * 0.6) * 10) / 10;
    addReviews('point', point.id, rating, count);
  }

  return { reviews, visits };
}
