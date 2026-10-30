import React, { useEffect } from 'react';
import { useAppStore } from '../store/AppStore';
import { normalizeEmail } from '../services/auth';
import { formatShortDate } from '../lib/format';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { Icon } from './ui/Icon';

/**
 * Buzón de demostración. La app no tiene servidor de correo, así que los correos
 * que «envía» (bienvenida, código de recuperación, aviso de cambio de contraseña)
 * se pueden leer aquí. En producción llegarían al correo real de la persona.
 */
export const DemoMailbox: React.FC<{ open: boolean; onClose: () => void; email?: string; onUseCode?: (code: string) => void }> = ({
  open,
  onClose,
  email,
  onUseCode,
}) => {
  const { outbox, markEmailRead } = useAppStore();
  const toast = useToast();
  const mails = email ? outbox.filter((m) => m.to === normalizeEmail(email)) : outbox;

  useEffect(() => {
    if (open) mails.filter((m) => !m.read).forEach((m) => markEmailRead(m.id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} onClose={onClose} title="Buzón de demostración" icon="mail" tone="light" maxWidth="max-w-md">
      <div className="p-4 space-y-3">
        <p className="text-xs text-on-surface-variant flex gap-2 p-3 rounded-xl bg-surface-container-low">
          <Icon name="info" className="text-[16px] text-secondary shrink-0" />
          <span>
            Esta versión no tiene servidor de correo: aquí ves los mensajes que la app enviaría a{' '}
            {email ? <strong className="break-all">{normalizeEmail(email)}</strong> : 'las cuentas registradas'}.
          </span>
        </p>
        {mails.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">No hay correos para esta dirección.</p>
        ) : (
          mails.map((m) => (
            <article key={m.id} className="p-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-primary">{m.subject}</h3>
                <span className="text-[10px] text-outline shrink-0">{formatShortDate(m.date)}</span>
              </div>
              <p className="text-[11px] text-outline mb-2 break-all">Para: {m.to}</p>
              <p className="text-sm text-on-surface-variant leading-relaxed">{m.body}</p>
              {m.code && (
                <div className="mt-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-primary-fixed/40">
                  <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{m.code}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(m.code!).then(() => toast('Código copiado.', { tone: 'success' }));
                      }}
                      className="px-3 py-1.5 rounded-full border border-primary text-primary text-xs font-bold"
                    >
                      Copiar
                    </button>
                    {onUseCode && (
                      <button
                        type="button"
                        onClick={() => {
                          onUseCode(m.code!);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold"
                      >
                        Usar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </Modal>
  );
};
