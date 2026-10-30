import React from 'react';

export const fieldInputCls = (invalid?: boolean) =>
  `w-full px-3.5 py-2.5 rounded-xl border bg-surface-container-lowest text-sm outline-none focus:ring-1 ${
    invalid ? 'border-error focus:ring-error' : 'border-outline-variant focus:border-primary focus:ring-primary'
  }`;

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ id, label, required, error, hint, children }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold text-on-surface mb-1">
      {label} {required && <span className="text-error" aria-hidden="true">*</span>}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} className="text-xs text-error font-semibold mt-1">{error}</p>
    ) : (
      hint && <p className="text-[11px] text-on-surface-variant mt-1">{hint}</p>
    )}
  </div>
);

/** Banner con la lista de campos obligatorios faltantes (ADMIN-001, escenario 2). */
export const MissingFieldsBanner: React.FC<{ labels: string[] }> = ({ labels }) =>
  labels.length === 0 ? null : (
    <div role="alert" className="p-3.5 rounded-2xl bg-error/10 border border-error/30 text-error">
      <p className="text-sm font-bold">Completa los campos obligatorios para guardar:</p>
      <ul className="list-disc pl-5 mt-1 text-xs font-semibold space-y-0.5">
        {labels.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
