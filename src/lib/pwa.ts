import { useSyncExternalStore } from 'react';

/**
 * Soporte de app instalable (PWA): registro del service worker, aviso de nueva
 * versión e instalación en la pantalla de inicio.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  canInstall: boolean;
  installed: boolean;
  updateReady: boolean;
  isIos: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

let state: PwaState = {
  canInstall: false,
  installed: typeof window !== 'undefined' && isStandalone(),
  updateReady: false,
  isIos: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent),
};

function set(partial: Partial<PwaState>) {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  set({ canInstall: false, installed: choice.outcome === 'accepted' || state.installed });
  return choice.outcome === 'accepted';
}

export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

export function setupPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => set({ installed: true, canInstall: false }));

  // El service worker solo se usa en producción y en contextos seguros (HTTPS o localhost).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              set({ updateReady: true });
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting;
          set({ updateReady: true });
        }
        reg.addEventListener('updatefound', () => track(reg.installing));
      })
      .catch(() => undefined);
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
