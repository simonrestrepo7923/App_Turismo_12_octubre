import React, { useState } from 'react';
import { passwordRules, passwordStrength } from '../services/auth';
import { Icon } from './ui/Icon';

export const authInputCls = (invalid?: boolean) =>
  `w-full pl-10 pr-3 py-3 rounded-xl bg-surface border text-on-surface text-sm outline-none focus:ring-2 transition-colors ${
    invalid ? 'border-error focus:ring-error/30' : 'border-outline-variant focus:border-primary focus:ring-primary/20'
  }`;

interface FieldProps {
  id: string;
  label: string;
  icon: string;
  error?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** Campo de formulario con ícono, etiqueta y mensaje de error accesible. */
export const AuthField: React.FC<FieldProps> = ({ id, label, icon, error, extra, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label htmlFor={id} className="block text-xs font-bold text-on-surface">{label}</label>
      {extra}
    </div>
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
        <Icon name={icon} className="text-[18px]" />
      </span>
      {children}
    </div>
    {error && (
      <p id={`${id}-error`} role="alert" className="text-xs text-error font-semibold mt-1">
        {error}
      </p>
    )}
  </div>
);

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  /** Muestra la lista de requisitos y la fortaleza. */
  showRules?: boolean;
  extra?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Marca el campo en rojo sin mostrar un mensaje propio. */
  invalid?: boolean;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({ id, label, value, onChange, error, autoComplete, placeholder, showRules, extra, inputRef, invalid }) => {
  const [shown, setShown] = useState(false);
  const strength = passwordStrength(value);
  return (
    <div>
      <AuthField id={id} label={label} icon="lock" error={error} extra={extra}>
        <input
          id={id}
          ref={inputRef}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error || invalid}
          aria-describedby={error ? `${id}-error` : showRules ? `${id}-rules` : undefined}
          className={`${authInputCls(!!error || invalid)} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-outline hover:text-on-surface"
        >
          <Icon name={shown ? 'visibility_off' : 'visibility'} className="text-[18px]" />
        </button>
      </AuthField>
      {showRules && (
        <div id={`${id}-rules`} className="mt-2 space-y-2">
          {value && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-on-surface-variant">Fortaleza</span>
                <span className={`font-bold ${strength.level === 3 ? 'text-primary' : strength.level === 2 ? 'text-on-tertiary-container' : 'text-error'}`}>{strength.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 h-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`h-full rounded-full ${
                      strength.level >= n ? (strength.level === 1 ? 'bg-error' : strength.level === 2 ? 'bg-tertiary-fixed-dim' : 'bg-primary-container') : 'bg-outline-variant/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {passwordRules(value).map((r) => (
              <li key={r.id} className={`text-[11px] flex items-center gap-1 ${r.ok ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                <Icon name={r.ok ? 'check_circle' : 'radio_button_unchecked'} className="text-[14px]" fill={r.ok} />
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
