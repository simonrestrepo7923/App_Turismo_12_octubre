import React from 'react';
import { useAppStore } from '../../store/AppStore';
import { initials } from '../../lib/format';
import { navigate } from '../../lib/router';
import { promptInstall, usePwa } from '../../lib/pwa';
import { Icon } from '../ui/Icon';
import type { MainTab } from './BottomNavBar';

interface SideNavProps {
  activeTab: MainTab | null;
  unreadCount: number;
  savedCount: number;
  onOpenNotifications: () => void;
  onOpenQrScanner: () => void;
  onOpenPropose: () => void;
  onShowInstallHelp: () => void;
}

const LINKS: { tab: MainTab; label: string; icon: string; path: string }[] = [
  { tab: 'inicio', label: 'Inicio', icon: 'home', path: '/inicio' },
  { tab: 'explorar', label: 'Explorar recorridos', icon: 'explore', path: '/explorar' },
  { tab: 'mapa', label: 'Mapa del barrio', icon: 'map', path: '/mapa' },
  { tab: 'favoritos', label: 'Favoritos', icon: 'bookmark', path: '/favoritos' },
  { tab: 'perfil', label: 'Pasaporte y perfil', icon: 'local_activity', path: '/perfil' },
];

/** Navegación lateral para pantallas de computador (≥ 1024 px). */
export const SideNav: React.FC<SideNavProps> = ({ activeTab, unreadCount, savedCount, onOpenNotifications, onOpenQrScanner, onOpenPropose, onShowInstallHelp }) => {
  const { currentUser, isAdmin, logout } = useAppStore();
  const pwa = usePwa();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-surface-container-lowest border-r border-outline-variant/60" aria-label="Menú principal">
      <button type="button" onClick={() => navigate('/inicio')} className="flex items-center gap-3 px-5 pt-6 pb-5 text-left">
        <span className="w-11 h-11 rounded-2xl bg-primary text-secondary-container flex items-center justify-center shadow-sm">
          <Icon name="pin_drop" fill className="text-[24px]" />
        </span>
        <span>
          <span className="block font-serif text-lg font-bold text-primary leading-tight">Doce de Octubre</span>
          <span className="block text-xs text-on-surface-variant">Comuna 6 · Medellín</span>
        </span>
      </button>

      <nav className="px-3 space-y-1" aria-label="Secciones">
        {LINKS.map((l) => {
          const active = activeTab === l.tab;
          return (
            <button
              key={l.tab}
              type="button"
              onClick={() => navigate(l.path)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                active ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
              }`}
            >
              <Icon name={l.icon} fill={active} className="text-[22px]" />
              <span className="flex-1 text-left">{l.label}</span>
              {l.tab === 'favoritos' && savedCount > 0 && (
                <span className={`text-[11px] font-bold px-2 rounded-full ${active ? 'bg-white/20' : 'bg-secondary text-white'}`}>{savedCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-5 my-4 h-px bg-outline-variant/60" />

      <div className="px-3 space-y-1">
        <SideAction icon="qr_code_scanner" label="Escanear placa QR" onClick={onOpenQrScanner} />
        <SideAction icon="notifications" label="Avisos comunitarios" onClick={onOpenNotifications} badge={unreadCount} />
        <SideAction icon="record_voice_over" label="Proponer un punto" onClick={onOpenPropose} />
        {isAdmin && <SideAction icon="admin_panel_settings" label="Panel de administración" onClick={() => navigate('/admin')} />}
        {!pwa.installed && (pwa.canInstall || pwa.isIos) && (
          <SideAction icon="install_desktop" label="Instalar la app" onClick={() => (pwa.canInstall ? void promptInstall() : onShowInstallHelp())} />
        )}
      </div>

      <div className="mt-auto p-4">
        {currentUser ? (
          <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/50">
            <button type="button" onClick={() => navigate('/perfil')} className="flex items-center gap-3 w-full text-left">
              <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shrink-0">{initials(currentUser.name)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-primary truncate">{currentUser.name}</span>
                <span className="block text-[11px] text-on-surface-variant truncate">{currentUser.email}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/auth', { replace: true });
              }}
              className="mt-3 w-full py-2 rounded-full border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container flex items-center justify-center gap-1"
            >
              <Icon name="logout" className="text-[16px]" /> Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-primary text-on-primary">
            <p className="text-sm font-bold">Tu pasaporte barrial</p>
            <p className="text-xs text-on-primary-container mt-1 mb-3">Crea una cuenta para guardar favoritos y sellar los puntos que visites.</p>
            <button type="button" onClick={() => navigate('/auth')} className="w-full py-2 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
              Ingresar o crear cuenta
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

const SideAction: React.FC<{ icon: string; label: string; onClick: () => void; badge?: number }> = ({ icon, label, onClick, badge }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
    <Icon name={icon} className="text-[20px]" />
    <span className="flex-1 text-left">{label}</span>
    {!!badge && <span className="min-w-5 h-5 px-1 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center justify-center">{badge}</span>}
  </button>
);
