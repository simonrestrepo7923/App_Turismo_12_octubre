import type { Announcement } from '../types';

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'notif-1',
    title: 'Nueva ruta: Balcones del Picacho',
    description: 'Sube en el Metrocable Línea P hasta El Progreso y camina hasta el Cristo y el mirador del Cerro El Picacho.',
    time: 'Hace 2 horas',
    type: 'ruta',
    tourId: 'balcones-del-picacho',
  },
  {
    id: 'notif-2',
    title: 'Visita el Parque Biblioteca',
    description: 'El Parque Biblioteca Gabriel García Márquez, en la Carrera 80 # 104-04, está junto a la estación Doce de Octubre del Metrocable.',
    time: 'Ayer',
    type: 'evento',
  },
  {
    id: 'notif-3',
    title: 'Sellos del pasaporte barrial',
    description: 'Escanea el código QR de cada placa para sellar tu visita y desbloquear insignias culturales.',
    time: 'Hace 3 días',
    type: 'pasaporte',
  },
];
