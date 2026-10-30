import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256Hex } from '../lib/sha256';
import {
  SEED_USERS,
  DEMO_ACCOUNTS,
  authenticate,
  generateResetCode,
  hashPassword,
  hashResetCode,
  isStrongEnough,
  passwordError,
  passwordStrength,
  validateRegister,
  verifyPassword,
} from '../services/auth';
import { hashString } from '../lib/random';

describe('sha256', () => {
  it('coincide con la implementación de Node', () => {
    for (const m of ['', 'abc', 'contraseña ñ', 'a'.repeat(55), 'a'.repeat(64), 'x'.repeat(1000)]) {
      expect(sha256Hex(m)).toBe(createHash('sha256').update(m, 'utf8').digest('hex'));
    }
  });
});

describe('contraseñas', () => {
  it('genera hashes con sal distintos para la misma contraseña', () => {
    const a = hashPassword('Memoria2024');
    const b = hashPassword('Memoria2024');
    expect(a).not.toBe(b);
    expect(a.startsWith('s256$')).toBe(true);
    expect(verifyPassword('Memoria2024', a)).toBe(true);
    expect(verifyPassword('memoria2024', a)).toBe(false);
  });

  it('acepta el formato de la versión anterior', () => {
    const legacy = hashString('ruta-doce-de-octubre:Caminante123').toString(36);
    expect(verifyPassword('Caminante123', legacy)).toBe(true);
    expect(verifyPassword('otra', legacy)).toBe(false);
  });

  it('exige mínimo 8 caracteres, una letra y un número', () => {
    expect(isStrongEnough('corta1')).toBe(false);
    expect(isStrongEnough('sinnumeros')).toBe(false);
    expect(isStrongEnough('12345678')).toBe(false);
    expect(isStrongEnough('Memoria2024')).toBe(true);
    expect(passwordError('abc')).toMatch(/mínimo 8 caracteres/);
    expect(passwordStrength('Memoria2024!').level).toBe(3);
  });
});

describe('registro e inicio de sesión (PERFIL-001)', () => {
  const base = { name: 'Laura Gómez', email: 'laura@correo.com', password: 'Memoria2024', confirmPassword: 'Memoria2024', consent: true };

  it('valida los campos del registro', () => {
    expect(validateRegister(base, SEED_USERS)).toEqual({});
    const e = validateRegister({ name: 'L', email: 'malo', password: 'abc', confirmPassword: 'x', consent: false }, SEED_USERS);
    expect(Object.keys(e).sort()).toEqual(['consent', 'email', 'name', 'password']);
    expect(validateRegister({ ...base, confirmPassword: 'Distinta2024' }, SEED_USERS).confirmPassword).toBeDefined();
  });

  it('no permite registrar un correo existente (sin importar mayúsculas)', () => {
    expect(validateRegister({ ...base, email: 'Caminante@Comuna6.org' }, SEED_USERS).email).toMatch(/Ya existe/);
  });

  it('autentica solo con la contraseña correcta', () => {
    expect(authenticate(DEMO_ACCOUNTS.turista.email, DEMO_ACCOUNTS.turista.password, SEED_USERS)?.id).toBe('user-demo-turista');
    expect(authenticate(DEMO_ACCOUNTS.turista.email.toUpperCase(), DEMO_ACCOUNTS.turista.password, SEED_USERS)).not.toBeNull();
    expect(authenticate(DEMO_ACCOUNTS.turista.email, 'incorrecta1', SEED_USERS)).toBeNull();
    expect(authenticate('nadie@correo.com', 'Caminante123', SEED_USERS)).toBeNull();
  });
});

describe('recuperación de contraseña', () => {
  it('genera códigos de 6 dígitos y los guarda como hash', () => {
    for (let i = 0; i < 50; i++) expect(generateResetCode()).toMatch(/^\d{6}$/);
    const h = hashResetCode('A@B.com', '123456');
    expect(h).toBe(hashResetCode('a@b.com', '123456'));
    expect(h).not.toContain('123456');
    expect(h).not.toBe(hashResetCode('a@b.com', '123457'));
  });
});
