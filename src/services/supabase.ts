import { createClient, type SupabaseClient, type User as AuthUser } from '@supabase/supabase-js';
import type { PointOfInterest, Review, Tour, User, Visit } from '../types';

/**
 * Conexión con Supabase (base de datos y cuentas en la nube).
 * Si no hay `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`,
 * la app sigue funcionando como antes: todo guardado en el navegador.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isRemote = Boolean(url && key);

// «pkce»: el enlace del correo vuelve a la app con ?code=… (no choca con las rutas #/…).
export const supabase: SupabaseClient | null = isRemote ? createClient(url!, key!, { auth: { flowType: 'pkce' } }) : null;

// ── Recuperar contraseña con el enlace del correo ────────────────────────────
const RECOVERY_FLAG = 'ruta12:recovery';

/** Recuerda que en este navegador se pidió recuperar la contraseña (vale 1 hora). */
export function markRecoveryRequested() {
  try {
    localStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    // sin almacenamiento
  }
}

export function clearRecoveryFlag() {
  try {
    localStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // sin almacenamiento
  }
}

function recentRecoveryRequest(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(RECOVERY_FLAG) ?? 0) < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Qué trae la dirección al abrir la app: un enlace de recuperación válido, uno vencido o nada. */
export const recoveryLink: 'valid' | 'expired' | null = (() => {
  if (!isRemote || typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  if (search.has('error_description') || /error_code=|error_description=/.test(hash)) return 'expired';
  if (search.has('code') && recentRecoveryRequest()) return 'valid';
  return null;
})();

/** Quita ?code=… o #error=… de la dirección para que no quede a la vista. */
export function cleanAuthParams() {
  const hash = /error_code=|error_description=|access_token=/.test(window.location.hash) ? '' : window.location.hash;
  window.history.replaceState(window.history.state, '', window.location.pathname + hash);
}

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

/** Avisa a la interfaz que algo no se pudo guardar en la nube. */
export function reportSyncError(action: string, error: unknown) {
  console.error(`[supabase] ${action}`, error);
  window.dispatchEvent(new CustomEvent('ruta12:sync-error', { detail: action }));
}

/** Ejecuta una escritura y avisa si falla (no bloquea la interfaz). */
export function write(action: string, run: () => PromiseLike<{ error: unknown }>) {
  Promise.resolve(run()).then(
    ({ error }) => error && reportSyncError(action, error),
    (e) => reportSyncError(action, e),
  );
}

// ── Filas de la base de datos ────────────────────────────────────────────────

interface LugarRow {
  id: string;
  titulo: string;
  subtitulo: string | null;
  relato: string | null;
  categoria: string;
  tipo: string | null;
  imagenes: string[] | null;
  imagen_alt: string | null;
  narrador_audio: string | null;
  segundos_audio: number | null;
  codigo_qr: string | null;
  lat: number;
  lng: number;
  direccion: string | null;
  etiquetas: string[] | null;
}

interface RecorridoRow {
  id: string;
  titulo: string;
  descripcion_corta: string | null;
  descripcion: string | null;
  cita: string | null;
  categoria: string;
  distancia_km: number | string | null;
  duracion_min: number | null;
  dificultad: string | null;
  sustantivo_paradas: string | null;
  etiqueta: string | null;
  destacado: boolean | null;
  portada: string | null;
  portada_alt: string | null;
  tiene_audioguia: boolean | null;
  curador: string | null;
  rol_curador: string | null;
  caracteristica: { icon: string; label: string } | null;
  creado_en: string;
}

export const toPoint = (r: LugarRow): PointOfInterest => ({
  id: r.id,
  title: r.titulo,
  subtitle: r.subtitulo ?? '',
  narrative: r.relato ?? '',
  category: r.categoria as PointOfInterest['category'],
  kindLabel: r.tipo ?? '',
  images: r.imagenes ?? [],
  imageAlt: r.imagen_alt ?? r.titulo,
  audioNarrator: r.narrador_audio ?? '',
  audioSeconds: r.segundos_audio ?? 0,
  qrCode: r.codigo_qr,
  coords: { lat: r.lat, lng: r.lng },
  address: r.direccion ?? undefined,
  tags: r.etiquetas ?? [],
});

export const fromPoint = (p: PointOfInterest): LugarRow => ({
  id: p.id,
  titulo: p.title,
  subtitulo: p.subtitle,
  relato: p.narrative,
  categoria: p.category,
  tipo: p.kindLabel,
  imagenes: p.images,
  imagen_alt: p.imageAlt,
  narrador_audio: p.audioNarrator,
  segundos_audio: p.audioSeconds,
  codigo_qr: p.qrCode,
  lat: p.coords.lat,
  lng: p.coords.lng,
  direccion: p.address ?? null,
  etiquetas: p.tags,
});

export const toTour = (r: RecorridoRow, pointIds: string[]): Tour => ({
  id: r.id,
  title: r.titulo,
  shortDescription: r.descripcion_corta ?? '',
  longDescription: r.descripcion ?? '',
  quote: r.cita ?? undefined,
  category: r.categoria as Tour['category'],
  distanceKm: Number(r.distancia_km ?? 0),
  durationMin: r.duracion_min ?? 0,
  difficulty: (r.dificultad ?? 'Fácil') as Tour['difficulty'],
  stopsNoun: r.sustantivo_paradas ?? 'paradas',
  pointIds,
  badgeLabel: r.etiqueta ?? '',
  editorialPick: r.destacado ?? false,
  coverImage: r.portada ?? '',
  coverAlt: r.portada_alt ?? r.titulo,
  hasAudioGuide: r.tiene_audioguia ?? true,
  specialFeature: r.caracteristica ?? undefined,
  curatorName: r.curador ?? '',
  curatorRole: r.rol_curador ?? '',
  createdAt: r.creado_en,
});

export const fromTour = (t: Tour): RecorridoRow => ({
  id: t.id,
  titulo: t.title,
  descripcion_corta: t.shortDescription,
  descripcion: t.longDescription,
  cita: t.quote ?? null,
  categoria: t.category,
  distancia_km: t.distanceKm,
  duracion_min: t.durationMin,
  dificultad: t.difficulty,
  sustantivo_paradas: t.stopsNoun,
  etiqueta: t.badgeLabel,
  destacado: t.editorialPick ?? false,
  portada: t.coverImage,
  portada_alt: t.coverAlt,
  tiene_audioguia: t.hasAudioGuide,
  curador: t.curatorName,
  rol_curador: t.curatorRole,
  caracteristica: t.specialFeature ?? null,
  creado_en: t.createdAt,
});

export const toUser = (u: AuthUser, perfil?: { nombre?: string | null; rol?: string | null } | null): User => ({
  id: u.id,
  name: perfil?.nombre || (u.user_metadata?.nombre as string | undefined) || (u.email ?? '').split('@')[0],
  email: u.email ?? '',
  passwordHash: '',
  role: perfil?.rol === 'admin' ? 'admin' : 'turista',
  createdAt: u.created_at,
});

export async function fetchUser(u: AuthUser): Promise<User> {
  const { data } = await db().from('perfiles').select('nombre, rol').eq('id', u.id).maybeSingle();
  return toUser(u, data);
}

export interface RemoteContent {
  tours: Tour[];
  points: PointOfInterest[];
  reviews: Review[];
  visits: Visit[];
  favorites: string[];
}

/** Trae todo el contenido. Visitas y favoritos solo los del usuario (o todas si es admin). */
export async function fetchContent(userId: string | null): Promise<RemoteContent> {
  const c = db();
  const [lugares, recorridos, orden, resenas, visitas, favoritos] = await Promise.all([
    c.from('lugares').select('*'),
    c.from('recorridos').select('*').order('creado_en', { ascending: true }),
    c.from('recorrido_lugares').select('*').order('orden', { ascending: true }),
    c.from('resenas').select('*'),
    userId ? c.from('visitas').select('*') : Promise.resolve({ data: [], error: null }),
    userId ? c.from('favoritos').select('recorrido_id').eq('usuario_id', userId) : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [lugares, recorridos, orden, resenas, visitas, favoritos].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const byTour = new Map<string, string[]>();
  for (const r of (orden.data ?? []) as { recorrido_id: string; lugar_id: string }[]) {
    byTour.set(r.recorrido_id, [...(byTour.get(r.recorrido_id) ?? []), r.lugar_id]);
  }
  return {
    points: ((lugares.data ?? []) as LugarRow[]).map(toPoint),
    // Los más nuevos primero, como en la versión local.
    tours: ((recorridos.data ?? []) as RecorridoRow[]).map((r) => toTour(r, byTour.get(r.id) ?? [])).reverse(),
    reviews: ((resenas.data ?? []) as Record<string, string | number>[]).map((r) => ({
      id: String(r.id),
      targetType: r.tipo as Review['targetType'],
      targetId: String(r.objetivo_id),
      userId: String(r.usuario_id),
      authorName: String(r.autor ?? 'Visitante'),
      rating: Number(r.estrellas),
      comment: String(r.comentario ?? ''),
      date: String(r.fecha),
    })),
    visits: ((visitas.data ?? []) as Record<string, string | null>[]).map((v) => ({
      id: String(v.id),
      userId: String(v.usuario_id),
      tourId: v.recorrido_id ?? undefined,
      pointId: v.lugar_id ?? undefined,
      date: String(v.fecha),
    })),
    favorites: ((favoritos.data ?? []) as { recorrido_id: string }[]).map((f) => f.recorrido_id),
  };
}
