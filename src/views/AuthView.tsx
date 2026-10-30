import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { DEMO_ACCOUNTS, LOGIN_MAX_FAILURES, RESET_CODE_TTL_MINUTES, isValidEmail, passwordError, type RegisterInput } from '../services/auth';
import { IMG } from '../data/images';
import { navigate } from '../lib/router';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';
import { AuthField, PasswordField, authInputCls } from '../components/PasswordField';
import { DemoMailbox } from '../components/DemoMailbox';

/**
 * Registro, inicio de sesión y recuperación de contraseña (PERFIL-001).
 * Escenario 1: registro exitoso → crea la cuenta y lleva a la pantalla principal.
 * Escenario 2: credenciales incorrectas → mensaje de error y posibilidad de reintentar
 *              (con bloqueo temporal tras varios intentos fallidos).
 */

type Mode = 'login' | 'register' | 'recover' | 'new-password';

export const AuthView: React.FC<{ initialMode: Mode; returnTo: string | null }> = ({ initialMode, returnTo }) => {
  const { continueAsGuest, remote } = useAppStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [prefill, setPrefill] = useState<{ email: string; password: string } | null>(null);

  const finish = (path: string) => navigate(path, { replace: true });

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] xl:grid-cols-[minmax(0,1fr)_600px]">
      {/* Panel ilustrado (computador) */}
      <aside className="hidden lg:flex relative overflow-hidden bg-primary text-on-primary" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${IMG.authHero}')` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/30" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <span className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary-container" /> Comuna 6 · Medellín
          </span>
          <div className="max-w-lg">
            <p className="text-secondary-fixed font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
              <Icon name="hiking" /> Cartografía comunitaria
            </p>
            <h1 className="font-serif text-5xl xl:text-6xl font-bold leading-[1.05]">Ruta Doce de Octubre</h1>
            <p className="font-serif italic text-2xl text-primary-fixed-dim mt-2">Historias que se caminan</p>
            <ul className="mt-10 space-y-4 text-sm text-on-primary/90">
              {[
                ['map', 'Recorridos sobre el mapa real del barrio, con rutas a pie y GPS.'],
                ['qr_code_scanner', 'Escanea las placas QR para abrir la historia de cada lugar.'],
                ['local_activity', 'Sella tu pasaporte barrial y guarda tus recorridos favoritos.'],
              ].map(([icon, text]) => (
                <li key={icon} className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <Icon name={icon} className="text-[20px]" />
                  </span>
                  <span className="pt-2">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-on-primary/70">Plataforma de cartografía cultural y comunitaria · Red Barrial de Historia y Memoria Viva</p>
        </div>
      </aside>

      <main className="w-full max-w-md mx-auto lg:max-w-none lg:mx-0 flex flex-col justify-center px-4 sm:px-8 lg:px-14 xl:px-20 pt-4 pb-10 lg:py-12">
        {/* Encabezado ilustrado (celular) */}
        <header className="lg:hidden relative w-full h-48 rounded-3xl overflow-hidden shadow-xs border border-outline-variant/30 bg-primary mb-5">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${IMG.authHero}')` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent" />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/90 shadow-xs text-xs font-bold text-primary">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            Comuna 6 · Medellín
          </span>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary-fixed flex items-center gap-1.5">
              <Icon name="hiking" className="text-base" /> Cartografía comunitaria
            </p>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-white leading-tight">Ruta Doce de Octubre</h1>
            <p className="font-serif italic text-primary-fixed-dim text-sm">Historias que se caminan</p>
          </div>
        </header>

        <div className="w-full max-w-md mx-auto">
          {mode === 'new-password' ? (
            <NewPasswordForm
              onDone={() => {
                setMode('login');
                navigate('/auth', { replace: true });
              }}
              onRestart={() => setMode('recover')}
            />
          ) : mode === 'recover' ? (
            <RecoverForm
              initialEmail={email}
              onBack={(done) => {
                if (done) setPrefill({ email: done, password: '' });
                setMode('login');
              }}
            />
          ) : (
            <>
              <div className="mb-5">
                <p className="inline-flex items-center gap-1.5 text-secondary text-xs font-bold mb-1">
                  <Icon name="local_activity" className="text-base" /> Pasaporte barrial
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold leading-tight">{mode === 'login' ? 'Bienvenido, caminante' : 'Crea tu cuenta'}</h2>
                <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                  {mode === 'login'
                    ? 'Accede a tus recorridos comunitarios, pasaporte cultural y relatos orales del barrio Doce de Octubre.'
                    : 'Guarda tus recorridos favoritos, sella tu pasaporte barrial y comparte tus valoraciones.'}
                </p>
              </div>

              <div role="tablist" aria-label="Iniciar sesión o crear cuenta" className="p-1 mb-4 rounded-full bg-surface-container border border-outline-variant/50 flex">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                      mode === m ? (m === 'login' ? 'bg-primary text-on-primary shadow-xs' : 'bg-secondary text-on-secondary shadow-xs') : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    <Icon name={m === 'login' ? 'login' : 'person_add'} className="text-base" />
                    {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  </button>
                ))}
              </div>

              <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-6 border border-outline-variant/40 shadow-xs">
                {mode === 'login' ? (
                  <LoginForm
                    key={prefill?.email ?? 'login'}
                    initialEmail={prefill?.email ?? email}
                    initialPassword={prefill?.password ?? ''}
                    onEmailChange={setEmail}
                    onForgot={() => setMode('recover')}
                    onDone={(admin) => finish(admin ? '/admin' : returnTo || '/inicio')}
                  />
                ) : (
                  <RegisterForm initialEmail={email} onDone={() => finish('/inicio')} />
                )}

                <div className="mt-5 pt-4 border-t border-outline-variant/30 text-center">
                  <p className="text-xs text-on-surface-variant mb-2">¿Estás de visita corta en Medellín?</p>
                  <button
                    type="button"
                    onClick={() => {
                      continueAsGuest();
                      finish(returnTo || '/inicio');
                    }}
                    className="w-full py-2.5 px-3 rounded-full border border-secondary text-secondary text-sm font-bold hover:bg-secondary-fixed/30 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="travel_explore" className="text-base" />
                    Continuar como visitante libre
                  </button>
                </div>
              </div>

              {!remote && (<div className="mt-4 rounded-2xl border border-dashed border-outline-variant p-3">
                <button type="button" onClick={() => setShowDemo((s) => !s)} className="w-full flex items-center justify-between text-xs font-bold text-primary" aria-expanded={showDemo}>
                  <span className="flex items-center gap-1.5">
                    <Icon name="science" className="text-[16px]" />
                    Cuentas de prueba
                  </span>
                  <Icon name={showDemo ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} className="text-[18px]" />
                </button>
                {showDemo && (
                  <div className="mt-2.5 space-y-2 text-xs">
                    {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setPrefill({ email: DEMO_ACCOUNTS[k].email, password: DEMO_ACCOUNTS[k].password });
                        }}
                        className="w-full text-left p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high"
                      >
                        <span className="font-bold text-primary">{k === 'admin' ? 'Administrador' : 'Turista'}</span>
                        <span className="block font-mono text-on-surface-variant break-all">
                          {DEMO_ACCOUNTS[k].email} · {DEMO_ACCOUNTS[k].password}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>)}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

// ── Inicio de sesión ──────────────────────────────────────────────────────────
const LoginForm: React.FC<{
  initialEmail: string;
  initialPassword: string;
  onEmailChange: (e: string) => void;
  onForgot: () => void;
  onDone: (admin: boolean) => void;
}> = ({ initialEmail, initialPassword, onEmailChange, onForgot, onDone }) => {
  const { login } = useAppStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lockedFor, setLockedFor] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const id = window.setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [lockedFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email) || !password) {
      setError('Escribe tu correo y tu contraseña para continuar.');
      return;
    }
    setBusy(true);
    const r = await login(email, password, remember);
    setBusy(false);
    if (!r.ok) {
      if (r.reason === 'unconfirmed') {
        setError('Tu cuenta aún no está confirmada. Abre el enlace que te llegó al correo.');
        return;
      }
      if (r.reason === 'network') {
        setError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
        return;
      }
      setPassword('');
      passwordRef.current?.focus();
      if (r.reason === 'locked') {
        setLockedFor(r.seconds);
        setError(null);
      } else {
        setError(
          `Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.${
            r.attemptsLeft < LOGIN_MAX_FAILURES - 1 ? ` Te quedan ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'intento' : 'intentos'}.` : ''
          }`,
        );
      }
      return;
    }
    toast(r.user.role === 'admin' ? 'Sesión iniciada como administrador.' : `¡Hola de nuevo, ${r.user.name.split(' ')[0]}!`, { tone: 'success' });
    onDone(r.user.role === 'admin');
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {lockedFor > 0 ? (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
          <Icon name="lock_clock" className="text-[18px]" />
          <span>
            Demasiados intentos fallidos. Por seguridad, espera {lockedFor} s o{' '}
            <button type="button" onClick={onForgot} className="underline">
              recupera tu contraseña
            </button>
            .
          </span>
        </div>
      ) : (
        error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
            <Icon name="error" className="text-[18px]" />
            <span>{error}</span>
          </div>
        )
      )}
      <AuthField id="login-email" label="Correo electrónico" icon="mail">
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            onEmailChange(e.target.value);
            setError(null);
          }}
          placeholder="ejemplo@comuna6.org"
          className={authInputCls(!!error)}
        />
      </AuthField>
      <PasswordField
        id="login-pass"
        label="Contraseña"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError(null);
        }}
        autoComplete="current-password"
        placeholder="Tu contraseña"
        invalid={!!error}
        inputRef={passwordRef}
        extra={
          <button type="button" onClick={onForgot} className="text-xs text-secondary font-semibold hover:underline">
            ¿Olvidaste tu contraseña?
          </button>
        }
      />
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-on-surface-variant">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />
        Recordarme en este dispositivo
      </label>
      <button
        type="submit"
        disabled={lockedFor > 0 || busy}
        className="w-full h-12 rounded-full bg-primary hover:bg-primary-container text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {busy ? 'Entrando…' : 'Iniciar sesión'} <Icon name="arrow_forward" className="text-base" />
      </button>
    </form>
  );
};

// ── Registro ──────────────────────────────────────────────────────────────────
const RegisterForm: React.FC<{ initialEmail: string; onDone: () => void }> = ({ initialEmail, onDone }) => {
  const { register } = useAppStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<RegisterInput>({ name: '', email: initialEmail, password: '', confirmPassword: '', consent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});

  const set = <K extends keyof RegisterInput>(k: K, v: RegisterInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await register(form);
    setBusy(false);
    if ('pending' in r) {
      setPending(true);
      return;
    }
    if ('errors' in r) {
      setErrors(r.errors);
      const first = Object.keys(r.errors)[0];
      document.getElementById(`reg-${first}`)?.focus();
      return;
    }
    toast(`¡Bienvenido, ${r.user.name.split(' ')[0]}! Tu cuenta fue creada.`, { tone: 'success' });
    onDone();
  };

  if (pending) {
    return (
      <div role="status" className="p-4 rounded-2xl bg-primary-fixed/40 text-sm text-primary leading-relaxed">
        <Icon name="mark_email_read" className="text-[22px] mb-1" />
        <p className="font-bold">Revisa tu correo</p>
        <p>Te enviamos un enlace a <strong className="break-all">{form.email.trim().toLowerCase()}</strong> para confirmar tu cuenta. Después vuelve aquí e inicia sesión.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <AuthField id="reg-name" label="Nombre completo" icon="badge" error={errors.name}>
        <input id="reg-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Juan Pablo Cartagena" className={authInputCls(!!errors.name)} aria-invalid={!!errors.name} />
      </AuthField>
      <AuthField id="reg-email" label="Correo electrónico" icon="mail" error={errors.email}>
        <input
          id="reg-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="caminante@comuna6.org"
          className={authInputCls(!!errors.email)}
          aria-invalid={!!errors.email}
        />
      </AuthField>
      <PasswordField id="reg-password" label="Contraseña" value={form.password} onChange={(v) => set('password', v)} error={errors.password} autoComplete="new-password" placeholder="Crea una contraseña" showRules />
      <PasswordField id="reg-confirmPassword" label="Confirmar contraseña" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} error={errors.confirmPassword} autoComplete="new-password" placeholder="Repite la contraseña" />
      <div>
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input id="reg-consent" type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span className="text-xs text-on-surface-variant leading-snug">
            Acepto unirme a la red comunitaria y el tratamiento de mis datos para usar la app, conforme a los términos de preservación patrimonial y memoria barrial.
          </span>
        </label>
        {errors.consent && <p className="text-xs text-error font-semibold mt-1" role="alert">{errors.consent}</p>}
      </div>
      <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-secondary hover:bg-secondary/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-60">
        {busy ? 'Creando cuenta…' : 'Crear cuenta de explorador'} <Icon name="arrow_forward" className="text-base" />
      </button>
    </form>
  );
};

// ── Recuperación de contraseña ────────────────────────────────────────────────
const RecoverForm: React.FC<{ initialEmail: string; onBack: (doneEmail?: string) => void }> = ({ initialEmail, onBack }) => {
  const { requestPasswordReset, confirmPasswordReset, resetResendIn, outbox, remote, recoveryLinkExpired } = useAppStore();
  const [busy, setBusy] = useState(false);
  const codeLen = remote ? 8 : 6;
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string; general?: string }>({});
  const [mailbox, setMailbox] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sent, setSent] = useState(false);
  const send = async () => {
    if (busy) return;
    if (!isValidEmail(email)) {
      setErrors({ email: 'Escribe el correo con el que te registraste.' });
      return;
    }
    setBusy(true);
    const r = await requestPasswordReset(email);
    setBusy(false);
    if (!r.ok) {
      if (r.reason === 'error') {
        setErrors({ email: r.message, general: r.message });
        return;
      }
      setResendIn(r.seconds);
      setStep('code');
      return;
    }
    setErrors({});
    setStep('code');
    setSent(true);
    setResendIn(resetResendIn(email) || 30);
    toast('Si el correo está registrado, te enviamos un código.', {
      action: r.emailSent ? { label: 'Ver correo', onClick: () => setMailbox(true) } : undefined,
    });
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!(remote ? /^\d{6,8}$/ : /^\d{6}$/).test(code.trim())) next.code = remote ? 'Escribe el código que llegó a tu correo.' : 'El código tiene 6 dígitos.';
    const pwErr = passwordError(password);
    if (pwErr) next.password = pwErr;
    else if (password !== confirm) next.confirm = 'Las contraseñas no coinciden.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    const r = await confirmPasswordReset(email, code, password, confirm);
    setBusy(false);
    if (r.ok) {
      toast('Contraseña actualizada. Ya puedes iniciar sesión.', { tone: 'success' });
      onBack(email);
      return;
    }
    const messages: Record<string, string> = {
      'no-request': 'No hay una solicitud vigente para este correo. Pide un código nuevo.',
      expired: `El código venció (dura ${RESET_CODE_TTL_MINUTES} minutos). Pide uno nuevo.`,
      'too-many': 'Demasiados intentos con un código incorrecto. Pide un código nuevo.',
      weak: passwordError(password) ?? 'Contraseña no válida.',
      mismatch: 'Las contraseñas no coinciden.',
      'bad-code': 'El código no es correcto o ya venció. Revisa el correo o pide uno nuevo.',
    };
    if (r.reason === 'invalid-code') setErrors({ code: `Código incorrecto. Te quedan ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'intento' : 'intentos'}.` });
    else if (r.reason === 'error') setErrors({ general: r.message });
    else setErrors({ general: messages[r.reason] });
  };

  const unreadForEmail = outbox.filter((m) => m.to === email.trim().toLowerCase() && !m.read).length;

  return (
    <div>
      <button type="button" onClick={() => onBack()} className="inline-flex items-center gap-1 text-sm font-bold text-primary mb-4 hover:underline">
        <Icon name="arrow_back" className="text-[18px]" /> Volver a iniciar sesión
      </button>
      <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold leading-tight">Recupera tu contraseña</h2>
      <ol className="flex items-center gap-2 text-[11px] font-bold mt-3 mb-5" aria-label="Pasos">
        <li className={`flex items-center gap-1 ${step === 'email' ? 'text-secondary' : 'text-primary'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'email' ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>
            {step === 'email' ? '1' : <Icon name="check" className="text-[13px]" />}
          </span>
          Tu correo
        </li>
        <span className="flex-1 h-px bg-outline-variant" />
        <li className={`flex items-center gap-1 ${step === 'code' ? 'text-secondary' : 'text-outline'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'code' ? 'bg-secondary text-white' : 'bg-surface-container-high'}`}>2</span>
          Código y nueva contraseña
        </li>
      </ol>

      <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-6 border border-outline-variant/40 shadow-xs">
        {remote && step === 'code' && sent ? (
          <div className="space-y-4">
            <div role="status" className="p-3 rounded-xl bg-primary-fixed/40 text-sm text-primary leading-relaxed">
              <p className="font-bold flex items-center gap-1.5"><Icon name="mark_email_read" className="text-[18px]" /> Revisa tu correo</p>
              <p className="mt-1">
                Si <strong className="break-all">{email.trim().toLowerCase()}</strong> está registrado, te llegará un correo de Supabase con un enlace. Ábrelo <strong>en este mismo navegador</strong> y ahí podrás escribir tu nueva contraseña. Revisa también la carpeta de spam.
              </p>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep('email'); setSent(false); }} className="font-semibold text-on-surface-variant hover:text-primary">
                Cambiar correo
              </button>
              <button type="button" onClick={send} disabled={resendIn > 0} className="font-bold text-primary disabled:text-outline">
                {resendIn > 0 ? `Reenviar en ${resendIn} s` : 'Reenviar correo'}
              </button>
            </div>
          </div>
        ) : step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="space-y-4"
            noValidate
          >
            {recoveryLinkExpired && (
              <p role="alert" className="p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
                El enlace del correo ya venció o ya se usó. Pide uno nuevo.
              </p>
            )}
            <p className="text-sm text-on-surface-variant">
              {remote ? 'Escribe el correo de tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.' : 'Escribe el correo de tu cuenta. Te enviaremos un código para crear una nueva contraseña.'}
            </p>
            {errors.general && (
              <p role="alert" className="p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
                {errors.general}
              </p>
            )}
            <AuthField id="rec-email" label="Correo electrónico" icon="mail" error={errors.email}>
              <input
                id="rec-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({});
                }}
                placeholder="ejemplo@comuna6.org"
                className={authInputCls(!!errors.email)}
              />
            </AuthField>
            <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? 'Enviando…' : remote ? 'Enviar enlace' : 'Enviar código'} <Icon name="send" className="text-base" />
            </button>
          </form>
        ) : (
          <form onSubmit={confirmReset} className="space-y-4" noValidate>
            <div className="p-3 rounded-xl bg-primary-fixed/40 text-xs text-primary leading-relaxed">
              {remote ? (
                <>Si <strong className="break-all">{email.trim().toLowerCase()}</strong> está registrado, te enviamos un correo con un código. Revisa también la carpeta de spam.</>
              ) : (
                <>
                  Si <strong className="break-all">{email.trim().toLowerCase()}</strong> está registrado, enviamos un código que vence en {RESET_CODE_TTL_MINUTES} minutos.
                  <button type="button" onClick={() => setMailbox(true)} className="mt-2 flex items-center gap-1 font-bold underline underline-offset-2">
                    <Icon name="mail" className="text-[16px]" /> Abrir buzón de demostración{unreadForEmail > 0 ? ` (${unreadForEmail} nuevo${unreadForEmail > 1 ? 's' : ''})` : ''}
                  </button>
                </>
              )}
            </div>
            {errors.general && (
              <p role="alert" className="p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
                {errors.general}
              </p>
            )}
            <AuthField id="rec-code" label="Código de verificación" icon="pin" error={errors.code}>
              <input
                id="rec-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={codeLen}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, codeLen));
                  setErrors((er) => ({ ...er, code: undefined, general: undefined }));
                }}
                placeholder="000000"
                className={`${authInputCls(!!errors.code)} font-mono tracking-[0.4em] text-lg`}
              />
            </AuthField>
            <PasswordField id="rec-pass" label="Nueva contraseña" value={password} onChange={(v) => { setPassword(v); setErrors((er) => ({ ...er, password: undefined })); }} error={errors.password} autoComplete="new-password" showRules />
            <PasswordField id="rec-confirm" label="Confirmar nueva contraseña" value={confirm} onChange={(v) => { setConfirm(v); setErrors((er) => ({ ...er, confirm: undefined })); }} error={errors.confirm} autoComplete="new-password" />
            <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-secondary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? 'Guardando…' : 'Cambiar contraseña'} <Icon name="lock_reset" className="text-base" />
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setStep('email')} className="font-semibold text-on-surface-variant hover:text-primary">
                Cambiar correo
              </button>
              <button type="button" onClick={send} disabled={resendIn > 0} className="font-bold text-primary disabled:text-outline">
                {resendIn > 0 ? `Reenviar código en ${resendIn} s` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}
      </div>
      {!remote && <DemoMailbox open={mailbox} onClose={() => setMailbox(false)} email={email} onUseCode={(c) => setCode(c)} />}
    </div>
  );
};

// ── Nueva contraseña (después de abrir el enlace del correo) ──────────────────
const NewPasswordForm: React.FC<{ onDone: () => void; onRestart: () => void }> = ({ onDone, onRestart }) => {
  const { recovering, finishRecovery } = useAppStore();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'password' | 'confirm' | 'general'; message: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await finishRecovery(password, confirm);
    setBusy(false);
    if (!r.ok) {
      setError({ field: r.field, message: r.message });
      return;
    }
    toast('Contraseña actualizada. Ya puedes iniciar sesión.', { tone: 'success' });
    onDone();
  };

  return (
    <div>
      <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold leading-tight mb-4">Crea tu nueva contraseña</h2>
      <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-6 border border-outline-variant/40 shadow-xs">
        {!recovering ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">Para cambiar la contraseña, abre el enlace que te llegó al correo. Si ya lo usaste o venció, pide uno nuevo.</p>
            <button type="button" onClick={onRestart} className="w-full h-12 rounded-full bg-primary text-white font-bold text-sm">
              Pedir un enlace nuevo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error?.field === 'general' && (
              <p role="alert" className="p-3 rounded-xl bg-error/10 text-error text-xs font-semibold">
                {error.message}
              </p>
            )}
            <PasswordField id="np-pass" label="Nueva contraseña" value={password} onChange={(v) => { setPassword(v); setError(null); }} error={error?.field === 'password' ? error.message : undefined} autoComplete="new-password" showRules />
            <PasswordField id="np-confirm" label="Confirmar nueva contraseña" value={confirm} onChange={(v) => { setConfirm(v); setError(null); }} error={error?.field === 'confirm' ? error.message : undefined} autoComplete="new-password" />
            <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-secondary text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? 'Guardando…' : 'Guardar nueva contraseña'} <Icon name="lock_reset" className="text-base" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
