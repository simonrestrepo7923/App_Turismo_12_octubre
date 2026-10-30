/**
 * Modelo de dominio de Ruta Doce de Octubre.
 *
 * Los puntos de interés y los recorridos están normalizados: un recorrido
 * referencia sus puntos por id (`pointIds`), así un punto puede pertenecer a
 * varios recorridos y al eliminarlo se retira de todos (ADMIN-002).
 */

export type CategoryId = 'historico' | 'recreacion' | 'gastronomia' | 'miradores' | 'musica';

export type Difficulty = 'Fácil' | 'Moderado' | 'Exigente';

export type DurationRange = '<1h' | '1h-2h' | '+2h';
export type DistanceRange = '<2km' | '2-5km' | '+5km';

/** Coordenada geográfica (WGS84). */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface PointOfInterest {
  id: string;
  title: string;
  /** Resumen de una línea. */
  subtitle: string;
  /** Relato completo que se muestra en la ficha. */
  narrative: string;
  category: CategoryId;
  /** Etiqueta libre del tipo de lugar (p. ej. «Mural histórico»). */
  kindLabel: string;
  images: string[];
  imageAlt: string;
  audioNarrator: string;
  audioSeconds: number;
  /** Código impreso en la placa física. `null` si aún no se ha generado (ADMIN-003). */
  qrCode: string | null;
  coords: LatLng;
  address?: string;
  tags: string[];
}

export interface Tour {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  quote?: string;
  category: CategoryId;
  distanceKm: number;
  durationMin: number;
  difficulty: Difficulty;
  /** Sustantivo para contar las paradas («murales», «miradores»…). */
  stopsNoun: string;
  pointIds: string[];
  badgeLabel: string;
  editorialPick?: boolean;
  coverImage: string;
  coverAlt: string;
  hasAudioGuide: boolean;
  specialFeature?: { icon: string; label: string };
  curatorName: string;
  curatorRole: string;
  createdAt: string;
}

export type UserRole = 'turista' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Hash con sal (SHA-256 iterado). En producción la autenticación vive en el servidor. */
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export type ReviewTarget = 'tour' | 'point';

export interface Review {
  id: string;
  targetType: ReviewTarget;
  targetId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  date: string;
}

/** Visita registrada: inicio de un recorrido o sello de un punto. */
export interface Visit {
  id: string;
  userId: string;
  tourId?: string;
  pointId?: string;
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'ruta' | 'evento' | 'pasaporte';
  tourId?: string;
}

export interface CommunityProposal {
  name: string;
  contact: string;
  location: string;
  title: string;
  story: string;
  category: CategoryId;
}

/** Copia básica de una ficha guardada para consulta sin conexión (FICHA-001). */
export interface CachedPoint {
  id: string;
  title: string;
  subtitle: string;
  narrative: string;
  kindLabel: string;
  audioNarrator: string;
  address?: string;
  cachedAt: string;
}

export interface RatingSummary {
  average: number;
  count: number;
}

/** Correo enviado por la app (buzón de demostración: no hay servidor de correo). */
export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  code?: string;
  date: string;
  read: boolean;
}

/** Solicitud de recuperación de contraseña pendiente. */
export interface PasswordReset {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  sentAt: string;
}

/** Intentos fallidos de inicio de sesión por correo (bloqueo temporal). */
export interface LoginThrottle {
  failures: number;
  lockedUntil: string | null;
}

/** Paso de una ruta a pie. */
export interface RouteStep {
  instruction: string;
  distance: number;
  location: LatLng;
  icon: string;
}

export interface WalkingRoute {
  coords: LatLng[];
  distance: number;
  duration: number;
  steps: RouteStep[];
  /** `osrm`: calculada sobre las calles reales; `aproximada`: línea recta (sin conexión). */
  source: 'osrm' | 'aproximada';
}
