import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CachedPoint, LoginThrottle, OutboxEmail, PasswordReset, PointOfInterest, Review, ReviewTarget, Tour, User, Visit } from '../types';
import { SEED_POINTS } from '../data/points';
import { SEED_TOURS } from '../data/tours';
import { generateSeedActivity } from '../data/seedActivity';
import {
  LOGIN_LOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  RESET_CODE_TTL_MINUTES,
  RESET_MAX_ATTEMPTS,
  RESET_RESEND_SECONDS,
  SEED_USERS,
  authenticate,
  generateResetCode,
  hashPassword,
  hashResetCode,
  needsRehash,
  normalizeEmail,
  passwordError,
  validateRegister,
  verifyPassword,
  type RegisterInput,
} from '../services/auth';
import { readJSON, removeKey, writeJSON } from '../lib/storage';
import { slugify } from '../lib/format';
import { uid } from '../lib/random';
import { buildRatingIndex, type RatingIndex } from './selectors';
import { cleanAuthParams, clearRecoveryFlag, db, fetchContent, fetchUser, fromPoint, fromTour, isRemote, markRecoveryRequested, recoveryLink, reportSyncError, supabase, toUser, write } from '../services/supabase';
import { navigate } from '../lib/router';

/**
 * Estado global de la app. Simula el backend: el contenido, las cuentas, las
 * valoraciones y las visitas se guardan en localStorage para que persistan entre
 * recargas. Cambiar `SCHEMA` invalida los datos guardados de versiones anteriores.
 */

const STORAGE_KEY = 'ruta12:state';
const SESSION_KEY = 'ruta12:session';
const SCHEMA = 4;

interface PersistedState {
  schema: number;
  tours: Tour[];
  points: PointOfInterest[];
  users: User[];
  userReviews: Review[];
  userVisits: Visit[];
  sessionUserId: string | null;
  favorites: Record<string, string[]>;
  readAnnouncementIds: string[];
  pointCache: Record<string, CachedPoint>;
  onboarded: boolean;
  /** Si es falso, la sesión dura solo mientras la pestaña esté abierta. */
  rememberSession: boolean;
  outbox: OutboxEmail[];
  resets: Record<string, PasswordReset>;
  throttles: Record<string, LoginThrottle>;
}

function initialState(): PersistedState {
  return {
    schema: SCHEMA,
    tours: SEED_TOURS,
    points: SEED_POINTS,
    users: SEED_USERS,
    userReviews: [],
    userVisits: [],
    sessionUserId: null,
    favorites: { 'user-demo-turista': ['memorias-del-territorio', 'balcones-del-picacho'] },
    readAnnouncementIds: [],
    pointCache: {},
    onboarded: false,
    rememberSession: true,
    outbox: [],
    resets: {},
    throttles: {},
  };
}

/** Migra datos guardados por versiones anteriores de la app. */
function migrate(saved: Record<string, unknown>): PersistedState | null {
  if (saved.schema === SCHEMA) return { ...initialState(), ...(saved as Partial<PersistedState>) };
  if (saved.schema === 2 || saved.schema === 3) {
    // Las versiones 2 y 3 traían lugares de ejemplo inventados; ahora son lugares reales.
    // Se conservan las cuentas y la sesión, y el contenido vuelve al de la versión actual.
    const old = saved as Partial<PersistedState>;
    const base = initialState();
    const users = (old.users ?? base.users).map((u) => SEED_USERS.find((d) => d.id === u.id) ?? u);
    return {
      ...base,
      users,
      sessionUserId: old.sessionUserId ?? null,
      onboarded: old.onboarded ?? false,
      rememberSession: old.rememberSession ?? true,
      outbox: old.outbox ?? [],
      resets: old.resets ?? {},
      throttles: old.throttles ?? {},
    };
  }
  return null;
}

function loadState(): PersistedState {
  const saved = readJSON<Record<string, unknown>>(STORAGE_KEY);
  const state = (saved && migrate(saved)) || initialState();
  if (!state.sessionUserId) {
    try {
      state.sessionUserId = window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      // sin sessionStorage
    }
  }
  return state;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; seconds: number }
  | { ok: false; reason: 'unconfirmed' }
  | { ok: false; reason: 'network' };

export type RegisterResult =
  | { user: User }
  | { pending: true }
  | { errors: Partial<Record<keyof RegisterInput, string>> };

export type ResetRequestResult =
  | { ok: true; emailSent: boolean }
  | { ok: false; reason: 'cooldown'; seconds: number }
  | { ok: false; reason: 'error'; message: string };

export type ResetConfirmResult =
  | { ok: true }
  | { ok: false; reason: 'no-request' | 'expired' | 'too-many' | 'weak' | 'mismatch' | 'bad-code' }
  | { ok: false; reason: 'invalid-code'; attemptsLeft: number }
  | { ok: false; reason: 'error'; message: string };

export type PasswordChangeResult = { ok: true } | { ok: false; field: 'current' | 'next' | 'confirm'; message: string };

export type ActionResult = { ok: true } | { ok: false; reason: 'auth-required' | 'invalid' };

export interface TourInput extends Omit<Tour, 'id' | 'createdAt'> {
  id?: string;
}

export interface PointInput extends Omit<PointOfInterest, 'id'> {
  id?: string;
}

interface AppStore {
  tours: Tour[];
  points: PointOfInterest[];
  reviews: Review[];
  visits: Visit[];
  ratings: RatingIndex;
  users: User[];
  currentUser: User | null;
  isAdmin: boolean;
  onboarded: boolean;
  favoriteTourIds: string[];
  readAnnouncementIds: string[];
  pointCache: Record<string, CachedPoint>;
  outbox: OutboxEmail[];

  /** true si los datos se guardan en Supabase (nube); false si solo en el navegador. */
  remote: boolean;
  /** Se abrió el enlace de recuperación del correo: falta escribir la nueva contraseña. */
  recovering: boolean;
  /** El enlace de recuperación venció o ya se usó. */
  recoveryLinkExpired: boolean;
  finishRecovery: (password: string, confirm: string) => Promise<{ ok: true } | { ok: false; field: 'password' | 'confirm' | 'general'; message: string }>;
  login: (email: string, password: string, remember?: boolean) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => void;
  continueAsGuest: () => void;
  requestPasswordReset: (email: string) => Promise<ResetRequestResult>;
  confirmPasswordReset: (email: string, code: string, password: string, confirm: string) => Promise<ResetConfirmResult>;
  resetResendIn: (email: string) => number;
  markEmailRead: (id: string) => void;
  updateProfile: (name: string) => Promise<boolean>;
  changePassword: (current: string, next: string, confirm: string) => Promise<PasswordChangeResult>;

  toggleFavorite: (tourId: string) => ActionResult;
  addReview: (input: { targetType: ReviewTarget; targetId: string; rating: number; comment: string }) => ActionResult;
  recordVisit: (input: { tourId?: string; pointId?: string }) => ActionResult;
  cachePoints: (pointIds: string[]) => void;
  markAnnouncementsRead: (ids: string[]) => void;

  saveTour: (input: TourInput) => Tour;
  deleteTour: (tourId: string) => void;
  savePoint: (input: PointInput, tourIds: string[]) => PointOfInterest;
  deletePoint: (pointId: string) => void;
  generateQrCode: (pointId: string) => string;
  resetDemoData: () => void;
}

const AppStoreContext = createContext<AppStore | null>(null);

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(loadState);
  const [seed] = useState(() => generateSeedActivity());

  useEffect(() => {
    // Sin «Recordarme», la sesión solo se guarda en sessionStorage (se cierra con la pestaña).
    writeJSON(STORAGE_KEY, state.rememberSession ? state : { ...state, sessionUserId: null });
    try {
      if (state.sessionUserId) window.sessionStorage.setItem(SESSION_KEY, state.sessionUserId);
      else window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // sin sessionStorage
    }
  }, [state]);

  // ── Modo nube (Supabase) ────────────────────────────────────────────────
  const [remoteUser, setRemoteUser] = useState<User | null>(null);
  // Mientras se recupera la contraseña, Supabase inicia una sesión temporal que no se muestra.
  const silentAuth = useRef(recoveryLink === 'valid');
  const [recovering, setRecovering] = useState(false);
  const [recoveryLinkExpired, setRecoveryLinkExpired] = useState(recoveryLink === 'expired');
  const remoteUserId = remoteUser?.id ?? null;

  const loadRemote = useCallback(async (userId: string | null) => {
    try {
      const c = await fetchContent(userId);
      setState((s) => ({
        ...s,
        tours: c.tours,
        points: c.points,
        userReviews: c.reviews,
        userVisits: c.visits,
        favorites: userId ? { ...s.favorites, [userId]: c.favorites } : s.favorites,
      }));
    } catch (e) {
      // Sin internet se sigue mostrando la última copia guardada en el navegador.
      reportSyncError('cargar los datos', e);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const apply = async (authUser: Parameters<typeof fetchUser>[0] | null) => {
      if (silentAuth.current) return;
      const user = authUser ? await fetchUser(authUser).catch(() => toUser(authUser)) : null;
      if (!cancelled && !silentAuth.current) setRemoteUser(user);
    };
    const startRecovery = () => {
      silentAuth.current = true;
      setRemoteUser(null);
      setRecovering(true);
      cleanAuthParams();
      navigate('/auth?modo=nueva-clave', { replace: true });
    };
    // getSession espera a que Supabase lea el enlace del correo (?code=…) si lo hay.
    supabase.auth.getSession().then(({ data }) => {
      if (recoveryLink === 'valid') {
        if (data.session) return startRecovery();
        silentAuth.current = false;
        setRecoveryLinkExpired(true);
      }
      if (recoveryLink) {
        cleanAuthParams();
        if (!data.session) navigate('/auth?modo=recuperar', { replace: true });
      }
      apply(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Se difiere para no llamar a Supabase dentro del aviso (recomendación de supabase-js).
      setTimeout(() => (event === 'PASSWORD_RECOVERY' ? startRecovery() : apply(session?.user ?? null)), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isRemote) loadRemote(remoteUserId);
  }, [remoteUserId, loadRemote]);

  const currentUser = useMemo(
    () => (isRemote ? remoteUser : state.users.find((u) => u.id === state.sessionUserId) ?? null),
    [remoteUser, state.users, state.sessionUserId],
  );

  const reviews = useMemo(() => {
    const tourIds = new Set(state.tours.map((t) => t.id));
    const pointIds = new Set(state.points.map((p) => p.id));
    const exists = (r: Review) => (r.targetType === 'tour' ? tourIds.has(r.targetId) : pointIds.has(r.targetId));
    // En la nube solo hay valoraciones reales; en el navegador se suman las de demostración.
    return (isRemote ? state.userReviews : [...seed.reviews, ...state.userReviews]).filter(exists);
  }, [seed.reviews, state.userReviews, state.tours, state.points]);

  const visits = useMemo(() => (isRemote ? state.userVisits : [...seed.visits, ...state.userVisits]), [seed.visits, state.userVisits]);
  const ratings = useMemo(() => buildRatingIndex(reviews), [reviews]);

  // Estado más reciente, para calcular resultados fuera de los updaters de React.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Autenticación (PERFIL-001) ──────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string, remember = true): Promise<LoginResult> => {
      const key = normalizeEmail(email);
      const now = Date.now();
      const throttle = state.throttles[key];
      if (throttle?.lockedUntil && new Date(throttle.lockedUntil).getTime() > now) {
        return { ok: false, reason: 'locked', seconds: Math.ceil((new Date(throttle.lockedUntil).getTime() - now) / 1000) };
      }
      let user: User | null;
      if (isRemote) {
        const { data, error } = await db().auth.signInWithPassword({ email: key, password });
        if (error) {
          if (error.code === 'email_not_confirmed') return { ok: false, reason: 'unconfirmed' };
          if (!error.status || error.status >= 500) return { ok: false, reason: 'network' };
        }
        user = data.user ? await fetchUser(data.user).catch(() => toUser(data.user!)) : null;
        if (user) setRemoteUser(user);
      } else {
        user = authenticate(email, password, state.users);
      }
      if (!user) {
        const failures = (throttle?.lockedUntil ? 0 : throttle?.failures ?? 0) + 1;
        const locked = failures >= LOGIN_MAX_FAILURES;
        setState((s) => ({
          ...s,
          throttles: {
            ...s.throttles,
            [key]: { failures: locked ? 0 : failures, lockedUntil: locked ? new Date(now + LOGIN_LOCK_SECONDS * 1000).toISOString() : null },
          },
        }));
        return locked ? { ok: false, reason: 'locked', seconds: LOGIN_LOCK_SECONDS } : { ok: false, reason: 'invalid', attemptsLeft: LOGIN_MAX_FAILURES - failures };
      }
      const upgraded = !isRemote && needsRehash(user.passwordHash) ? { ...user, passwordHash: hashPassword(password) } : user;
      setState((s) => {
        const throttles = { ...s.throttles };
        delete throttles[key];
        return {
          ...s,
          users: upgraded === user ? s.users : s.users.map((u) => (u.id === user.id ? upgraded : u)),
          sessionUserId: user.id,
          onboarded: true,
          rememberSession: remember,
          throttles,
        };
      });
      return { ok: true, user: upgraded };
    },
    [state.users, state.throttles],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<RegisterResult> => {
      const errors = validateRegister(input, isRemote ? [] : state.users);
      if (Object.keys(errors).length > 0) return { errors };
      if (isRemote) {
        const name = input.name.trim().replace(/\s+/g, ' ');
        const { data, error } = await db().auth.signUp({
          email: normalizeEmail(input.email),
          password: input.password,
          options: { data: { nombre: name } },
        });
        if (error) {
          if (error.code === 'user_already_exists') return { errors: { email: 'Ya existe una cuenta con este correo. Inicia sesión.' } };
          if (error.code === 'weak_password') return { errors: { password: 'La contraseña es muy débil. Usa una más larga.' } };
          return { errors: { email: `No se pudo crear la cuenta: ${error.message}` } };
        }
        if (!data.session || !data.user) return { pending: true };
        const user = toUser(data.user, { nombre: name, rol: 'turista' });
        setRemoteUser(user);
        setState((s) => ({ ...s, onboarded: true }));
        return { user };
      }
      const user: User = {
        id: uid('user'),
        name: input.name.trim().replace(/\s+/g, ' '),
        email: normalizeEmail(input.email),
        passwordHash: hashPassword(input.password),
        role: 'turista',
        createdAt: new Date().toISOString(),
      };
      const welcome: OutboxEmail = {
        id: uid('mail'),
        to: user.email,
        subject: 'Bienvenido a Ruta Doce de Octubre',
        body: `Hola, ${user.name}. Tu cuenta fue creada. Ya puedes guardar recorridos favoritos, sellar tu pasaporte barrial y valorar los lugares que visites.`,
        date: new Date().toISOString(),
        read: false,
      };
      setState((s) => ({ ...s, users: [...s.users, user], sessionUserId: user.id, onboarded: true, rememberSession: true, outbox: [welcome, ...s.outbox] }));
      return { user };
    },
    [state.users],
  );

  const logout = useCallback(() => {
    if (supabase) {
      supabase.auth.signOut();
      setRemoteUser(null);
    }
    setState((s) => ({ ...s, sessionUserId: null }));
  }, []);
  const continueAsGuest = useCallback(() => setState((s) => ({ ...s, onboarded: true })), []);

  // ── Recuperación de contraseña ──────────────────────────────────────────
  const resetResendIn = useCallback(
    (email: string) => {
      const r = state.resets[normalizeEmail(email)];
      if (!r) return 0;
      return Math.max(0, Math.ceil((new Date(r.sentAt).getTime() + RESET_RESEND_SECONDS * 1000 - Date.now()) / 1000));
    },
    [state.resets],
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<ResetRequestResult> => {
      const key = normalizeEmail(email);
      const wait = resetResendIn(key);
      if (wait > 0) return { ok: false, reason: 'cooldown', seconds: wait };
      if (isRemote) {
        const { error } = await db().auth.resetPasswordForEmail(key, { redirectTo: window.location.origin + window.location.pathname });
        if (error) {
          if (error.status === 429) return { ok: false, reason: 'error', message: 'Se enviaron demasiados correos. Espera un rato e inténtalo de nuevo.' };
          return { ok: false, reason: 'error', message: `No se pudo enviar el correo: ${error.message}` };
        }
        markRecoveryRequested();
        setRecoveryLinkExpired(false);
        const sentAt = new Date().toISOString();
        setState((s) => ({ ...s, resets: { ...s.resets, [key]: { email: key, codeHash: '', expiresAt: sentAt, attempts: 0, sentAt } } }));
        return { ok: true, emailSent: true };
      }
      const user = state.users.find((u) => u.email === key);
      // Por seguridad la respuesta es la misma exista o no la cuenta; solo se envía correo si existe.
      if (!user) return { ok: true, emailSent: false };
      const code = generateResetCode();
      const now = new Date();
      const reset: PasswordReset = {
        email: key,
        codeHash: hashResetCode(key, code),
        expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60000).toISOString(),
        attempts: 0,
        sentAt: now.toISOString(),
      };
      const mail: OutboxEmail = {
        id: uid('mail'),
        to: key,
        subject: 'Tu código para restablecer la contraseña',
        body: `Hola, ${user.name}. Usa este código para crear una nueva contraseña en Ruta Doce de Octubre. Vence en ${RESET_CODE_TTL_MINUTES} minutos. Si no lo pediste, ignora este mensaje.`,
        code,
        date: now.toISOString(),
        read: false,
      };
      setState((s) => ({ ...s, resets: { ...s.resets, [key]: reset }, outbox: [mail, ...s.outbox].slice(0, 30) }));
      return { ok: true, emailSent: true };
    },
    [state.users, resetResendIn],
  );

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, password: string, confirm: string): Promise<ResetConfirmResult> => {
      const key = normalizeEmail(email);
      if (isRemote) {
        if (passwordError(password)) return { ok: false, reason: 'weak' };
        if (password !== confirm) return { ok: false, reason: 'mismatch' };
        silentAuth.current = true;
        const { error } = await db().auth.verifyOtp({ email: key, token: code.trim(), type: 'recovery' });
        if (error) {
          silentAuth.current = false;
          return { ok: false, reason: 'bad-code' };
        }
        const { error: upd } = await db().auth.updateUser({ password });
        await db().auth.signOut();
        silentAuth.current = false;
        setRemoteUser(null);
        if (upd) return { ok: false, reason: 'error', message: `No se pudo cambiar la contraseña: ${upd.message}` };
        return { ok: true };
      }
      const reset = state.resets[key];
      if (!reset) return { ok: false, reason: 'no-request' };
      if (new Date(reset.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' };
      if (reset.attempts >= RESET_MAX_ATTEMPTS) return { ok: false, reason: 'too-many' };
      if (hashResetCode(key, code.trim()) !== reset.codeHash) {
        const attempts = reset.attempts + 1;
        setState((s) => ({ ...s, resets: { ...s.resets, [key]: { ...reset, attempts } } }));
        return attempts >= RESET_MAX_ATTEMPTS ? { ok: false, reason: 'too-many' } : { ok: false, reason: 'invalid-code', attemptsLeft: RESET_MAX_ATTEMPTS - attempts };
      }
      if (passwordError(password)) return { ok: false, reason: 'weak' };
      if (password !== confirm) return { ok: false, reason: 'mismatch' };
      const passwordHash = hashPassword(password);
      setState((s) => {
        const resets = { ...s.resets };
        delete resets[key];
        const throttles = { ...s.throttles };
        delete throttles[key];
        const notice: OutboxEmail = {
          id: uid('mail'),
          to: key,
          subject: 'Tu contraseña fue cambiada',
          body: 'La contraseña de tu cuenta en Ruta Doce de Octubre se cambió correctamente. Si no fuiste tú, recupérala de nuevo de inmediato.',
          date: new Date().toISOString(),
          read: false,
        };
        return { ...s, users: s.users.map((u) => (u.email === key ? { ...u, passwordHash } : u)), resets, throttles, outbox: [notice, ...s.outbox].slice(0, 30) };
      });
      return { ok: true };
    },
    [state.resets],
  );

  const finishRecovery = useCallback(async (password: string, confirm: string) => {
    const err = passwordError(password);
    if (err) return { ok: false as const, field: 'password' as const, message: err };
    if (password !== confirm) return { ok: false as const, field: 'confirm' as const, message: 'Las contraseñas no coinciden.' };
    const { error } = await db().auth.updateUser({ password });
    if (error) {
      const message = error.code === 'same_password' ? 'La nueva contraseña debe ser distinta de la anterior.' : `No se pudo cambiar la contraseña: ${error.message}`;
      return { ok: false as const, field: 'general' as const, message };
    }
    await db().auth.signOut();
    clearRecoveryFlag();
    silentAuth.current = false;
    setRemoteUser(null);
    setRecovering(false);
    return { ok: true as const };
  }, []);

  const markEmailRead = useCallback((id: string) => {
    setState((s) => ({ ...s, outbox: s.outbox.map((m) => (m.id === id ? { ...m, read: true } : m)) }));
  }, []);

  // ── Perfil ──────────────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (name: string) => {
      const clean = name.trim().replace(/\s+/g, ' ');
      if (!currentUser || clean.length < 3) return false;
      if (isRemote) {
        const { error } = await db().from('perfiles').update({ nombre: clean }).eq('id', currentUser.id);
        if (error) {
          reportSyncError('guardar tu nombre', error);
          return false;
        }
        setRemoteUser({ ...currentUser, name: clean });
        return true;
      }
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === currentUser.id ? { ...u, name: clean } : u)) }));
      return true;
    },
    [currentUser],
  );

  const changePassword = useCallback(
    async (current: string, next: string, confirm: string): Promise<PasswordChangeResult> => {
      if (!currentUser) return { ok: false, field: 'current', message: 'Inicia sesión de nuevo.' };
      const err = passwordError(next);
      if (isRemote) {
        if (err) return { ok: false, field: 'next', message: err };
        if (next === current) return { ok: false, field: 'next', message: 'La nueva contraseña debe ser distinta de la actual.' };
        if (next !== confirm) return { ok: false, field: 'confirm', message: 'Las contraseñas no coinciden.' };
        const check = await db().auth.signInWithPassword({ email: currentUser.email, password: current });
        if (check.error) return { ok: false, field: 'current', message: 'La contraseña actual no es correcta.' };
        const { error } = await db().auth.updateUser({ password: next });
        if (error) return { ok: false, field: 'next', message: `No se pudo cambiar: ${error.message}` };
        return { ok: true };
      }
      if (!verifyPassword(current, currentUser.passwordHash)) return { ok: false, field: 'current', message: 'La contraseña actual no es correcta.' };
      if (err) return { ok: false, field: 'next', message: err };
      if (next === current) return { ok: false, field: 'next', message: 'La nueva contraseña debe ser distinta de la actual.' };
      if (next !== confirm) return { ok: false, field: 'confirm', message: 'Las contraseñas no coinciden.' };
      const passwordHash = hashPassword(next);
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === currentUser.id ? { ...u, passwordHash } : u)) }));
      return { ok: true };
    },
    [currentUser],
  );

  // ── Acciones del turista ────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    (tourId: string): ActionResult => {
      if (!currentUser) return { ok: false, reason: 'auth-required' };
      const had = (stateRef.current.favorites[currentUser.id] ?? []).includes(tourId);
      setState((s) => {
        const list = s.favorites[currentUser.id] ?? [];
        const next = list.includes(tourId) ? list.filter((id) => id !== tourId) : [...list, tourId];
        return { ...s, favorites: { ...s.favorites, [currentUser.id]: next } };
      });
      if (isRemote) {
        write('guardar el favorito', () =>
          had
            ? db().from('favoritos').delete().eq('usuario_id', currentUser.id).eq('recorrido_id', tourId)
            : db().from('favoritos').insert({ usuario_id: currentUser.id, recorrido_id: tourId }),
        );
      }
      return { ok: true };
    },
    [currentUser],
  );

  const addReview = useCallback(
    (input: { targetType: ReviewTarget; targetId: string; rating: number; comment: string }): ActionResult => {
      if (!currentUser) return { ok: false, reason: 'auth-required' };
      if (input.rating < 1 || input.rating > 5 || input.comment.trim().length < 3) return { ok: false, reason: 'invalid' };
      const review: Review = {
        id: uid('review'),
        targetType: input.targetType,
        targetId: input.targetId,
        userId: currentUser.id,
        authorName: currentUser.name,
        rating: input.rating,
        comment: input.comment.trim(),
        date: new Date().toISOString(),
      };
      // Una valoración por persona y lugar: si ya existía, se reemplaza.
      setState((s) => ({
        ...s,
        userReviews: [
          ...s.userReviews.filter(
            (r) => !(r.userId === currentUser.id && r.targetType === input.targetType && r.targetId === input.targetId),
          ),
          review,
        ],
      }));
      if (isRemote) {
        write('guardar la valoración', async () => {
          await db().from('resenas').delete().eq('usuario_id', currentUser.id).eq('tipo', review.targetType).eq('objetivo_id', review.targetId);
          return db().from('resenas').insert({
            usuario_id: currentUser.id,
            autor: review.authorName,
            tipo: review.targetType,
            objetivo_id: review.targetId,
            estrellas: review.rating,
            comentario: review.comment,
          });
        });
      }
      return { ok: true };
    },
    [currentUser],
  );

  const recordVisit = useCallback(
    (input: { tourId?: string; pointId?: string }): ActionResult => {
      if (!currentUser) return { ok: false, reason: 'auth-required' };
      const today = new Date().toDateString();
      const duplicate = stateRef.current.userVisits.some((v) => {
        if (v.userId !== currentUser.id) return false;
        if (input.pointId) return v.pointId === input.pointId;
        return !v.pointId && v.tourId === input.tourId && new Date(v.date).toDateString() === today;
      });
      if (duplicate) return { ok: true };
      const visit: Visit = { id: uid('visit'), userId: currentUser.id, ...input, date: new Date().toISOString() };
      setState((s) => ({ ...s, userVisits: [...s.userVisits, visit] }));
      if (isRemote) {
        write('sellar la visita', () =>
          db().from('visitas').insert({ usuario_id: currentUser.id, recorrido_id: input.tourId ?? null, lugar_id: input.pointId ?? null }),
        );
      }
      return { ok: true };
    },
    [currentUser],
  );

  const cachePoints = useCallback((pointIds: string[]) => {
    setState((s) => {
      const cache = { ...s.pointCache };
      const now = new Date().toISOString();
      for (const id of pointIds) {
        const p = s.points.find((pt) => pt.id === id);
        if (!p) continue;
        cache[id] = {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          narrative: p.narrative,
          kindLabel: p.kindLabel,
          audioNarrator: p.audioNarrator,
          address: p.address,
          cachedAt: now,
        };
      }
      return { ...s, pointCache: cache };
    });
  }, []);

  const markAnnouncementsRead = useCallback((ids: string[]) => {
    setState((s) => ({ ...s, readAnnouncementIds: Array.from(new Set([...s.readAnnouncementIds, ...ids])) }));
  }, []);

  // ── Administración de contenidos (ADMIN-001/002/003) ────────────────────
  // El resultado se calcula con el estado más reciente (stateRef) y luego se aplica
  // con una actualización funcional, porque React puede diferir el updater.

  const saveTour = useCallback((input: TourInput): Tour => {
    const s = stateRef.current;
    const existing = input.id ? s.tours.find((t) => t.id === input.id) : undefined;
    let saved: Tour;
    if (existing) {
      saved = { ...existing, ...input, id: existing.id, createdAt: existing.createdAt };
    } else {
      const base = slugify(input.title) || 'recorrido';
      let id = base;
      while (s.tours.some((t) => t.id === id)) id = `${base}-${Math.random().toString(36).slice(2, 5)}`;
      saved = { ...input, id, createdAt: new Date().toISOString() };
    }
    setState((cur) => ({
      ...cur,
      tours: existing ? cur.tours.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...cur.tours],
    }));
    if (isRemote) {
      write('guardar el recorrido', async () => {
        const up = await db().from('recorridos').upsert(fromTour(saved));
        if (up.error) return up;
        await db().from('recorrido_lugares').delete().eq('recorrido_id', saved.id);
        if (saved.pointIds.length === 0) return { error: null };
        return db().from('recorrido_lugares').insert(saved.pointIds.map((lugar_id, i) => ({ recorrido_id: saved.id, lugar_id, orden: i + 1 })));
      });
    }
    return saved;
  }, []);

  const deleteTour = useCallback((tourId: string) => {
    setState((s) => ({ ...s, tours: s.tours.filter((t) => t.id !== tourId) }));
    if (isRemote) write('borrar el recorrido', () => db().from('recorridos').delete().eq('id', tourId));
  }, []);

  const savePoint = useCallback((input: PointInput, tourIds: string[]): PointOfInterest => {
    const existing = input.id ? stateRef.current.points.find((p) => p.id === input.id) : undefined;
    const saved: PointOfInterest = existing ? { ...existing, ...input, id: existing.id } : { ...input, id: uid('punto') };
    if (isRemote) {
      const before = stateRef.current.tours;
      write('guardar el punto', async () => {
        const up = await db().from('lugares').upsert(fromPoint(saved));
        if (up.error) return up;
        for (const t of before) {
          const has = t.pointIds.includes(saved.id);
          const wants = tourIds.includes(t.id);
          if (has && !wants) await db().from('recorrido_lugares').delete().eq('recorrido_id', t.id).eq('lugar_id', saved.id);
          if (!has && wants) {
            const r = await db().from('recorrido_lugares').insert({ recorrido_id: t.id, lugar_id: saved.id, orden: t.pointIds.length + 1 });
            if (r.error) return r;
          }
        }
        return { error: null };
      });
    }
    setState((s) => {
      const points = s.points.some((p) => p.id === saved.id)
        ? s.points.map((p) => (p.id === saved.id ? saved : p))
        : [...s.points, saved];
      // Sincroniza la pertenencia del punto a los recorridos elegidos.
      const tours = s.tours.map((t) => {
        const has = t.pointIds.includes(saved.id);
        const wants = tourIds.includes(t.id);
        if (has === wants) return t;
        return { ...t, pointIds: wants ? [...t.pointIds, saved.id] : t.pointIds.filter((id) => id !== saved.id) };
      });
      // La ficha guardada para modo sin conexión se actualiza con los nuevos datos.
      const pointCache = { ...s.pointCache };
      if (pointCache[saved.id]) {
        pointCache[saved.id] = {
          ...pointCache[saved.id],
          title: saved.title,
          subtitle: saved.subtitle,
          narrative: saved.narrative,
          kindLabel: saved.kindLabel,
          audioNarrator: saved.audioNarrator,
          address: saved.address,
        };
      }
      return { ...s, points, tours, pointCache };
    });
    return saved;
  }, []);

  const deletePoint = useCallback((pointId: string) => {
    if (isRemote) write('borrar el punto', () => db().from('lugares').delete().eq('id', pointId));
    setState((s) => {
      const pointCache = { ...s.pointCache };
      delete pointCache[pointId];
      return {
        ...s,
        points: s.points.filter((p) => p.id !== pointId),
        tours: s.tours.map((t) => ({ ...t, pointIds: t.pointIds.filter((id) => id !== pointId) })),
        pointCache,
      };
    });
  }, []);

  const generateQrCode = useCallback(
    (pointId: string): string => {
      const point = state.points.find((p) => p.id === pointId);
      if (point?.qrCode) return point.qrCode;
      const taken = new Set(state.points.map((p) => p.qrCode).filter(Boolean));
      const base = 'QR-' + (slugify(point?.title ?? 'punto').toUpperCase().split('-').slice(0, 2).join('-') || 'PUNTO');
      let code = base;
      while (taken.has(code)) code = `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      setState((s) => ({ ...s, points: s.points.map((p) => (p.id === pointId ? { ...p, qrCode: code } : p)) }));
      if (isRemote) write('guardar el código QR', () => db().from('lugares').update({ codigo_qr: code }).eq('id', pointId));
      return code;
    },
    [state.points],
  );

  const resetDemoData = useCallback(() => {
    removeKey('ruta12:routes');
    if (isRemote) {
      // En la nube no se borra nada: se vuelve a traer lo que hay guardado.
      loadRemote(remoteUserId);
      return;
    }
    removeKey(STORAGE_KEY);
    removeKey('ruta12:routes');
    setState((s) => ({ ...initialState(), sessionUserId: s.sessionUserId, onboarded: true, rememberSession: s.rememberSession }));
  }, [loadRemote, remoteUserId]);

  const value: AppStore = {
    tours: state.tours,
    points: state.points,
    reviews,
    visits,
    ratings,
    users: isRemote ? (remoteUser ? [remoteUser] : []) : state.users,
    currentUser,
    remote: isRemote,
    recovering,
    recoveryLinkExpired,
    finishRecovery,
    isAdmin: currentUser?.role === 'admin',
    onboarded: state.onboarded,
    favoriteTourIds: currentUser ? state.favorites[currentUser.id] ?? [] : [],
    readAnnouncementIds: state.readAnnouncementIds,
    pointCache: state.pointCache,
    outbox: state.outbox,
    login,
    register,
    logout,
    continueAsGuest,
    requestPasswordReset,
    confirmPasswordReset,
    resetResendIn,
    markEmailRead,
    updateProfile,
    changePassword,
    toggleFavorite,
    addReview,
    recordVisit,
    cachePoints,
    markAnnouncementsRead,
    saveTour,
    deleteTour,
    savePoint,
    deletePoint,
    generateQrCode,
    resetDemoData,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore debe usarse dentro de <AppStoreProvider>');
  return ctx;
}
