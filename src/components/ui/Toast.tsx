import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: ToastAction;
}

type ShowToast = (message: string, options?: { tone?: ToastItem['tone']; action?: ToastAction; durationMs?: number }) => void;

const ToastContext = createContext<ShowToast | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, options = {}) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone: options.tone ?? 'info', action: options.action }]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? (options.action ? 5000 : 3200));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed top-3 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg text-sm animate-slide-down ${
              t.tone === 'error'
                ? 'bg-error text-white'
                : t.tone === 'success'
                  ? 'bg-primary text-on-primary'
                  : 'bg-on-surface text-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">
              {t.tone === 'error' ? 'error' : t.tone === 'success' ? 'check_circle' : 'info'}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 font-bold text-secondary-fixed underline-offset-2 hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
