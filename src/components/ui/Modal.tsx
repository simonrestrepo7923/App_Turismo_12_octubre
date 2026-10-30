import React, { useEffect } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  /** Encabezado oscuro (verde) o claro. */
  tone?: 'dark' | 'light';
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, icon, children, tone = 'dark', maxWidth = 'max-w-md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/55 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface-container-lowest w-full ${maxWidth} rounded-t-3xl sm:rounded-3xl overflow-hidden border border-outline-variant shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up`}
      >
        <div
          className={`px-5 py-4 flex items-center justify-between gap-3 shrink-0 ${
            tone === 'dark' ? 'bg-primary text-on-primary' : 'bg-surface border-b border-outline-variant/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <Icon name={icon} className={tone === 'dark' ? 'text-secondary-fixed' : 'text-secondary'} />}
            <h2 className={`font-serif text-lg font-bold truncate ${tone === 'dark' ? 'text-white' : 'text-primary'}`}>{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              tone === 'dark' ? 'hover:bg-white/10 text-white/85' : 'hover:bg-surface-container text-on-surface-variant'
            }`}
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, confirmLabel, onConfirm, onCancel, danger }) => (
  <Modal open={open} onClose={onCancel} title={title} icon={danger ? 'warning' : 'help'} tone="light" maxWidth="max-w-sm">
    <div className="p-5 space-y-5">
      <div className="text-sm text-on-surface-variant leading-relaxed">{message}</div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-5 py-2.5 rounded-full text-sm font-bold text-white ${danger ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary-container'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);
