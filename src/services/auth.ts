import type { User } from '../types';
import { hashString } from '../lib/random';
import { sha256Hex } from '../lib/sha256';

/**
 * Autenticación de DEMOSTRACIÓN: las cuentas viven en el navegador (localStorage).
 * Las contraseñas se guardan con sal y SHA-256 iterado, pero cualquier persona con
 * acceso al navegador puede leer los datos. En producción esto va en un servidor.
 */

const ITERATIONS = 2000;

export function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr);
  else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function stretch(password: string, salt: string, iterations: number): string {
  let h = sha256Hex(`${salt}:${password}`);
  for (let i = 1; i < iterations; i++) h = sha256Hex(h + salt);
  return h;
}

/** Hash con formato `s256$<iteraciones>$<sal>$<hash>`. */
export function hashPassword(password: string, salt = randomToken()): string {
  return `s256$${ITERATIONS}$${salt}$${stretch(password, salt, ITERATIONS)}`;
}

/** Comprueba una contraseña. Acepta también el formato de la versión anterior. */
export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('s256$')) {
    const [, iter, salt, hash] = stored.split('$');
    return stretch(password, salt, Number(iter)) === hash;
  }
  return hashString('ruta-doce-de-octubre:' + password).toString(36) === stored;
}

export const needsRehash = (stored: string) => !stored.startsWith(`s256$${ITERATIONS}$`);

export const DEMO_ACCOUNTS = {
  turista: { email: 'caminante@comuna6.org', password: 'Caminante123', name: 'Juan Pablo Cartagena' },
  admin: { email: 'admin@comuna6.org', password: 'Admin12345', name: 'Mesa de Cultura Comunitaria' },
} as const;

export const SEED_USERS: User[] = [
  {
    id: 'user-demo-turista',
    name: DEMO_ACCOUNTS.turista.name,
    email: DEMO_ACCOUNTS.turista.email,
    passwordHash: hashPassword(DEMO_ACCOUNTS.turista.password, 'demo-turista-salt'),
    role: 'turista',
    createdAt: '2024-09-01T00:00:00.000Z',
  },
  {
    id: 'user-demo-admin',
    name: DEMO_ACCOUNTS.admin.name,
    email: DEMO_ACCOUNTS.admin.email,
    passwordHash: hashPassword(DEMO_ACCOUNTS.admin.password, 'demo-admin-salt'),
    role: 'admin',
    createdAt: '2024-01-15T00:00:00.000Z',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim());

// ── Política de contraseñas ──────────────────────────────────────────────────
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  ok: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: 'len', label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`, ok: password.length >= MIN_PASSWORD_LENGTH },
    { id: 'letter', label: 'Al menos una letra', ok: /[a-záéíóúñü]/i.test(password) },
    { id: 'number', label: 'Al menos un número', ok: /\d/.test(password) },
  ];
}

export const isStrongEnough = (password: string) => passwordRules(password).every((r) => r.ok);

export type PasswordStrength = { level: 0 | 1 | 2 | 3; label: string };

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: '' };
  if (!isStrongEnough(password)) return { level: 1, label: 'Débil' };
  const extra = (password.length >= 12 ? 1 : 0) + (/[^a-z0-9áéíóúñü]/i.test(password) ? 1 : 0) + (/[A-ZÁÉÍÓÚÑ]/.test(password) && /[a-záéíóúñ]/.test(password) ? 1 : 0);
  return extra >= 2 ? { level: 3, label: 'Segura' } : { level: 2, label: 'Media' };
}

export function passwordError(password: string): string | undefined {
  const failed = passwordRules(password).filter((r) => !r.ok);
  if (failed.length === 0) return undefined;
  return `La contraseña necesita: ${failed.map((r) => r.label.toLowerCase()).join(', ')}.`;
}

// ── Registro ─────────────────────────────────────────────────────────────────
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateRegister(input: RegisterInput, users: User[]): FieldErrors<keyof RegisterInput> {
  const errors: FieldErrors<keyof RegisterInput> = {};
  if (input.name.trim().length < 3) errors.name = 'Escribe tu nombre completo.';
  if (!isValidEmail(input.email)) errors.email = 'Escribe un correo electrónico válido.';
  else if (users.some((u) => u.email === normalizeEmail(input.email))) errors.email = 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.';
  const pwErr = passwordError(input.password);
  if (pwErr) errors.password = pwErr;
  if (!errors.password && input.confirmPassword !== input.password) errors.confirmPassword = 'Las contraseñas no coinciden.';
  if (!input.consent) errors.consent = 'Debes aceptar los términos para crear la cuenta.';
  return errors;
}

export function authenticate(email: string, password: string, users: User[]): User | null {
  const user = users.find((u) => u.email === normalizeEmail(email));
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

// ── Protección contra intentos repetidos ─────────────────────────────────────
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_SECONDS = 60;

// ── Recuperación de contraseña ───────────────────────────────────────────────
export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_RESEND_SECONDS = 30;

export function generateResetCode(): string {
  const n = parseInt(randomToken(4), 16) % 1_000_000;
  return n.toString().padStart(6, '0');
}

export const hashResetCode = (email: string, code: string) => sha256Hex(`reset:${normalizeEmail(email)}:${code}`);
