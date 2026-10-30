import React from 'react';
import { navigate } from '../../lib/router';
import { Icon } from '../ui/Icon';

export type MainTab = 'inicio' | 'explorar' | 'mapa' | 'favoritos' | 'perfil';

interface BottomNavBarProps {
  activeTab: MainTab | null;
  savedCount: number;
}

const TABS: { tab: MainTab; label: string; icon: string; path: string; aria: string }[] = [
  { tab: 'inicio', label: 'Inicio', icon: 'home', path: '/inicio', aria: 'Inicio' },
  { tab: 'explorar', label: 'Explorar', icon: 'explore', path: '/explorar', aria: 'Explorar recorridos' },
  { tab: 'mapa', label: 'Mapa', icon: 'map', path: '/mapa', aria: 'Mapa interactivo' },
  { tab: 'favoritos', label: 'Favoritos', icon: 'bookmark', path: '/favoritos', aria: 'Recorridos favoritos' },
  { tab: 'perfil', label: 'Perfil', icon: 'person', path: '/perfil', aria: 'Perfil y pasaporte' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, savedCount }) => (
  <nav
    className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-surface-container-lowest border-t border-outline-variant/60 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]"
    aria-label="Navegación inferior"
  >
    <div className="max-w-[540px] md:max-w-2xl mx-auto flex justify-around items-center">
      {TABS.map(({ tab, label, icon, path, aria }) => {
        const active = activeTab === tab;
        if (tab === 'mapa') {
          return (
            <button
              key={tab}
              type="button"
              onClick={() => navigate(path)}
              aria-label={aria}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center -mt-5 active:scale-95 transition-transform px-2"
            >
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ring-4 ring-surface-container-lowest transition-all ${
                  active ? 'bg-secondary text-on-secondary scale-105' : 'bg-primary text-on-primary hover:bg-primary-container'
                }`}
              >
                <Icon name={icon} fill={active} className="text-[26px]" />
              </span>
              <span className={`text-[11px] mt-1 font-bold ${active ? 'text-secondary' : 'text-primary'}`}>{label}</span>
            </button>
          );
        }
        return (
          <button
            key={tab}
            type="button"
            onClick={() => navigate(path)}
            aria-label={aria}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center py-1 px-3 active:scale-95 transition-all ${
              active ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary font-medium'
            }`}
          >
            <span className="relative">
              <Icon name={icon} fill={active} className="text-[24px]" />
              {tab === 'favoritos' && savedCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-secondary text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </span>
            <span className="text-[11px] mt-0.5 tracking-tight">{label}</span>
            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${active ? 'bg-primary' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  </nav>
);
