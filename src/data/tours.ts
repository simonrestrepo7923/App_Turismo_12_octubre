import type { Tour } from '../types';
import { IMG } from './images';

/**
 * Recorridos iniciales por lugares reales de la Comuna 6 (ver fuentes en data/points.ts).
 * Distancias aproximadas a pie entre las paradas; las fotos de portada son ilustrativas.
 */
const CURATOR = { curatorName: 'Equipo Ruta Doce de Octubre', curatorRole: 'Contenido basado en fuentes públicas' };

export const SEED_TOURS: Tour[] = [
  {
    id: 'memorias-del-territorio',
    title: 'Memorias del Territorio: De Pedregal al Doce',
    shortDescription:
      'Recorrido por Pedregal y Doce de Octubre N.º 1, dos barrios que el Instituto de Crédito Territorial loteó entre 1962 y 1976 y que sus familias construyeron.',
    longDescription:
      'La Comuna 6 se formó por etapas: la urbanización Santander en 1951, el loteo de Pedregal por el Instituto de Crédito Territorial en 1962, la construcción del barrio Doce de Octubre entre 1970 y 1976 y los asentamientos de El Triunfo desde 1984. Este recorrido pasa por templos, la Casa de la Cultura y el parque de Pedregal para terminar en Doce de Octubre N.º 1, cerca de la Carrera 80.',
    category: 'historico',
    distanceKm: 1.7,
    durationMin: 60,
    difficulty: 'Fácil',
    stopsNoun: 'puntos de interés',
    pointIds: ['parroquia-santa-teresa-calcuta', 'casa-cultura-pedregal', 'parque-pedregal', 'parroquia-santa-maria-carmen'],
    badgeLabel: 'Ruta insignia',
    editorialPick: true,
    coverImage: IMG.escalinatas,
    coverAlt: 'Imagen ilustrativa de un barrio de ladera en Medellín',
    hasAudioGuide: true,
    specialFeature: { icon: 'history_edu', label: 'Historia de los barrios' },
    ...CURATOR,
    createdAt: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'parques-y-encuentro',
    title: 'Parques y Encuentro: Deporte y Vida al Aire Libre',
    shortDescription:
      'Parques de barrio, la sede de Comfama Pedregal y la Unidad Deportiva del Doce de Octubre: los espacios donde la comuna se encuentra.',
    longDescription:
      'Un recorrido de sur a norte por los espacios recreativos de la comuna: desde el Parque Los Jubilados en Pedregal, pasando por Comfama Pedregal y la Unidad Deportiva junto al Parque Biblioteca, hasta el Parque Picacho en la parte alta.',
    category: 'recreacion',
    distanceKm: 1.8,
    durationMin: 70,
    difficulty: 'Moderado',
    stopsNoun: 'parques y escenarios',
    pointIds: ['parque-los-jubilados', 'comfama-pedregal', 'unidad-deportiva-doce', 'parque-picacho'],
    badgeLabel: 'Recreación',
    coverImage: IMG.plaza,
    coverAlt: 'Imagen ilustrativa de un parque de barrio',
    hasAudioGuide: true,
    specialFeature: { icon: 'sports_soccer', label: 'Escenarios deportivos' },
    ...CURATOR,
    createdAt: '2024-04-10T00:00:00.000Z',
  },
  {
    id: 'sabores-del-doce',
    title: 'Sabores del Doce: Fogones y Panaderías del Barrio',
    shortDescription:
      'Restaurantes y panaderías de Pedregal y Doce de Octubre para probar comida típica antioqueña en el barrio.',
    longDescription:
      'Ruta gastronómica por negocios del barrio sobre la Carrera 74 y alrededor de la Carrera 80: almuerzos, chicharrón, panadería y parrilla. Los horarios cambian según el negocio; conviene confirmarlos antes de ir.',
    category: 'gastronomia',
    distanceKm: 2.6,
    durationMin: 90,
    difficulty: 'Fácil',
    stopsNoun: 'paradas gastronómicas',
    pointIds: ['restaurante-el-gordo', 'restaurante-la-fonda', 'oh-que-chicharron', 'panaderia-la-curva', 'pipol-bar-parrilla'],
    badgeLabel: 'Gastronomía',
    coverImage: IMG.fogones,
    coverAlt: 'Imagen ilustrativa de comida típica antioqueña',
    hasAudioGuide: true,
    specialFeature: { icon: 'restaurant', label: 'Negocios del barrio' },
    ...CURATOR,
    createdAt: '2024-05-02T00:00:00.000Z',
  },
  {
    id: 'balcones-del-picacho',
    title: 'Balcones del Picacho: Metrocable y Cerro Tutelar',
    shortDescription:
      'Sube en la Línea P del Metrocable hasta El Progreso y continúa a pie hasta el Cristo y el mirador del Cerro El Picacho.',
    longDescription:
      'El Cerro El Picacho es uno de los siete cerros tutelares de Medellín y está en la Comuna 6. El recorrido empieza en la estación Doce de Octubre, sigue a la estación El Progreso y sube por el barrio hasta el Cristo y el mirador, con vista sobre todo el Valle de Aburrá. Tiene pendientes fuertes y escaleras: lleva agua y calzado cómodo.',
    category: 'miradores',
    distanceKm: 2.3,
    durationMin: 150,
    difficulty: 'Exigente',
    stopsNoun: 'paradas',
    pointIds: ['estacion-doce-de-octubre', 'estacion-el-progreso', 'parroquia-santa-teresa-jesus', 'cristo-del-picacho', 'mirador-cerro-el-picacho'],
    badgeLabel: 'Naturaleza & vista',
    coverImage: IMG.mirador,
    coverAlt: 'Imagen ilustrativa de una vista panorámica desde la montaña',
    hasAudioGuide: true,
    specialFeature: { icon: 'cable_car', label: 'Incluye Metrocable' },
    ...CURATOR,
    createdAt: '2024-06-15T00:00:00.000Z',
  },
  {
    id: 'cultura-viva',
    title: 'Cultura Viva: Biblioteca, Música y Comunidad',
    shortDescription:
      'Del Parque Biblioteca Gabriel García Márquez y la Escuela de Música a los centros comunitarios del barrio La Esperanza.',
    longDescription:
      'Recorrido por los espacios donde se forman lectores, músicos y bailarines de la comuna: el Parque Biblioteca Gabriel García Márquez, la sede de la Red de Escuelas de Música, el Centro de Desarrollo Social La Esperanza y el Centro de Integración Comunitaria de las comunas 5 y 6.',
    category: 'musica',
    distanceKm: 1.8,
    durationMin: 55,
    difficulty: 'Fácil',
    stopsNoun: 'espacios culturales',
    pointIds: ['parque-biblioteca-ggm', 'escuela-musica-doce', 'cds-la-esperanza', 'cic-comunas-5-6'],
    badgeLabel: 'Cultura',
    coverImage: IMG.musica,
    coverAlt: 'Imagen ilustrativa de instrumentos musicales',
    hasAudioGuide: true,
    specialFeature: { icon: 'local_library', label: 'Parque biblioteca' },
    ...CURATOR,
    createdAt: '2024-07-20T00:00:00.000Z',
  },
];
