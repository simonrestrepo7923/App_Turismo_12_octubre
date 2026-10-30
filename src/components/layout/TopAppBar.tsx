import React from 'react';
import { useAppStore } from '../../store/AppStore';
import { initials } from '../../lib/format';
import { navigate } from '../../lib/router';
import { Icon } from '../ui/Icon';

interface TopAppBarProps {
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenQrScanner: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ unreadCount, onOpenNotifications, onOpenQrScanner }) => {
  const { currentUser, isAdmin } = useAppStore();

  return (
    <header className="lg:hidden bg-surface/95 backdrop-blur-md w-full px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 sticky top-0 z-40 border-b border-outline-variant/40 shadow-xs">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center w-full gap-3">
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          className="flex items-center gap-3 group text-left min-w-0"
          aria-label="Ver perfil y pasaporte"
        >
          <span className="relative shrink-0">
            <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm ring-2 ring-primary-container/20 group-hover:scale-105 transition-transform">
              {currentUser ? initials(currentUser.name) : <Icon name="person" className="text-[22px]" />}
            </span>
            {currentUser && <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full ring-2 ring-surface" />}
          </span>
          <span className="min-w-0">
            <span className="font-serif text-lg md:text-xl font-bold text-primary tracking-tight block leading-tight group-hover:text-secondary transition-colors">
              Doce de Octubre
            </span>
            <span className="text-xs text-on-surface-variant font-medium block truncate">Comuna 6 · Medellín</span>
          </span>
        </button>


        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-container items-center gap-1"
            >
              <Icon name="admin_panel_settings" className="text-[16px]" />
              Panel
            </button>
          )}
          {!currentUser && (
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-secondary text-secondary hover:bg-secondary/10"
            >
              Ingresar
            </button>
          )}
          <button
            type="button"
            onClick={onOpenQrScanner}
            aria-label="Escanear código QR de una placa"
            title="Escanear placa QR"
            className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-surface-container active:scale-95 transition-all"
          >
            <Icon name="qr_code_scanner" className="text-[22px]" />
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={unreadCount > 0 ? `Avisos comunitarios (${unreadCount} sin leer)` : 'Avisos comunitarios'}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-95 transition-all"
          >
            <Icon name="notifications" className="text-[24px]" />
            {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-secondary rounded-full ring-2 ring-surface" />}
          </button>
        </div>
      </div>
    </header>
  );
};
