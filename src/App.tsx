import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ANNOUNCEMENTS } from './data/announcements';
import { AppStoreProvider, useAppStore } from './store/AppStore';
import { AudioProvider } from './store/AudioContext';
import { LocationProvider } from './store/LocationContext';
import { navigate, useRoute, type Route } from './lib/router';
import { applyUpdate, usePwa } from './lib/pwa';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Icon } from './components/ui/Icon';
import { ErrorBoundary, PageLoader } from './components/ErrorBoundary';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNavBar, type MainTab } from './components/layout/BottomNavBar';
import { SideNav } from './components/layout/SideNav';
import { AudioPlayerDrawer } from './components/AudioPlayerDrawer';
import { QrScannerModal } from './components/QrScannerModal';
import { NotificationModal } from './components/NotificationModal';
import { ProposePointModal } from './components/ProposePointModal';
import { InstallHelpModal } from './components/InstallHelpModal';
import { AuthView } from './views/AuthView';
import { HomeView } from './views/HomeView';
import { ExploreView } from './views/ExploreView';
import { TourDetailView } from './views/TourDetailView';
import { PointDetailView } from './views/PointDetailView';
import { FavoritesView } from './views/FavoritesView';
import { ProfileView } from './views/ProfileView';
import { QrResolveView } from './views/QrResolveView';

// Las pantallas más pesadas (mapa y administración) se descargan solo cuando se abren.
const MapView = lazy(() => import('./views/MapView').then((m) => ({ default: m.MapView })));
const AdminView = lazy(() => import('./views/admin/AdminView').then((m) => ({ default: m.AdminView })));
const TourFormView = lazy(() => import('./views/admin/TourFormView').then((m) => ({ default: m.TourFormView })));
const PointFormView = lazy(() => import('./views/admin/PointFormView').then((m) => ({ default: m.PointFormView })));

export const App: React.FC = () => (
  <ToastProvider>
    <AppStoreProvider>
      <LocationProvider>
        <AudioProvider>
          <Shell />
        </AudioProvider>
      </LocationProvider>
    </AppStoreProvider>
  </ToastProvider>
);

export default App;

/** Pestaña de navegación resaltada para cada sección. */
function tabFor(route: Route): MainTab | null {
  switch (route.segments[0]) {
    case 'inicio':
      return 'inicio';
    case 'explorar':
    case 'recorrido':
    case 'punto':
      return 'explorar';
    case 'mapa':
      return 'mapa';
    case 'favoritos':
      return 'favoritos';
    case 'perfil':
      return 'perfil';
    default:
      return null;
  }
}

const TITLES: Record<string, string> = {
  inicio: 'Inicio',
  explorar: 'Explorar recorridos',
  mapa: 'Mapa',
  favoritos: 'Favoritos',
  perfil: 'Pasaporte y perfil',
  auth: 'Ingresar',
  admin: 'Administración',
};

const Shell: React.FC = () => {
  const route = useRoute();
  const { tours, points, currentUser, isAdmin, onboarded, favoriteTourIds, readAnnouncementIds } = useAppStore();
  const pwa = usePwa();
  const toast = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);

  const [section, id, sub] = route.segments;
  const isAuth = section === 'auth';
  const isAdminArea = section === 'admin';
  const isMap = section === 'mapa';
  const isImmersive = section === 'recorrido' || section === 'punto' || isMap;

  // Avisa si algo no se pudo guardar o cargar desde la base de datos (Supabase).
  useEffect(() => {
    const onError = (e: Event) => toast(`No se pudo ${(e as CustomEvent<string>).detail}. Revisa tu conexión.`, { tone: 'error' });
    window.addEventListener('ruta12:sync-error', onError);
    return () => window.removeEventListener('ruta12:sync-error', onError);
  }, [toast]);

  // Redirecciones de entrada.
  useEffect(() => {
    if (route.path === '/') navigate(currentUser || onboarded ? (isAdmin ? '/admin' : '/inicio') : '/auth', { replace: true });
    else if (isAuth && currentUser) navigate(isAdmin ? '/admin' : '/inicio', { replace: true });
  }, [route.path, currentUser, onboarded, isAdmin, isAuth]);

  // Cada pantalla nueva empieza arriba y actualiza el título de la pestaña del navegador.
  useEffect(() => {
    if (!isMap) window.scrollTo({ top: 0 });
    const detail =
      section === 'recorrido' ? tours.find((t) => t.id === id)?.title : section === 'punto' ? points.find((p) => p.id === id)?.title : undefined;
    document.title = `${detail ?? TITLES[section ?? ''] ?? 'Ruta Doce de Octubre'} · Ruta Doce de Octubre`;
  }, [route.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso de nueva versión de la app instalada.
  useEffect(() => {
    if (pwa.updateReady) toast('Hay una nueva versión de la app.', { action: { label: 'Actualizar', onClick: applyUpdate }, durationMs: 15000 });
  }, [pwa.updateReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = ANNOUNCEMENTS.filter((a) => !readAnnouncementIds.includes(a.id)).length;
  const routeKey = route.path + '?' + route.query.toString();

  let content: React.ReactNode;
  switch (section) {
    case undefined:
      content = null;
      break;
    case 'auth': {
      const modo = route.query.get('modo');
      content = <AuthView key={routeKey} initialMode={modo === 'registro' ? 'register' : modo === 'recuperar' ? 'recover' : modo === 'nueva-clave' ? 'new-password' : 'login'} returnTo={route.query.get('volver')} />;
      break;
    }
    case 'inicio':
      content = <HomeView onShowInstallHelp={() => setInstallHelp(true)} />;
      break;
    case 'explorar':
      content = (
        <ExploreView
          key={routeKey}
          initialQuery={route.query.get('q') ?? ''}
          initialCategory={route.query.get('cat')}
          openFilters={route.query.has('filtros')}
          focusSearch={route.query.has('buscar')}
          onOpenProposeModal={() => setProposeOpen(true)}
        />
      );
      break;
    case 'recorrido': {
      const tour = tours.find((t) => t.id === id);
      content = tour ? <TourDetailView key={tour.id} tour={tour} /> : <NotFound message="Este recorrido no existe o fue retirado." />;
      break;
    }
    case 'punto':
      content = id ? <PointDetailView key={id} pointId={id} tourContextId={route.query.get('recorrido')} /> : <NotFound />;
      break;
    case 'mapa':
      content = (
        <MapView
          key={routeKey}
          tourId={id ?? null}
          focusPointId={route.query.get('punto')}
          destinationId={route.query.get('destino')}
          onOpenQrScanner={() => setQrOpen(true)}
        />
      );
      break;
    case 'favoritos':
      content = <FavoritesView />;
      break;
    case 'perfil':
      content = <ProfileView onOpenProposeModal={() => setProposeOpen(true)} onShowInstallHelp={() => setInstallHelp(true)} />;
      break;
    case 'qr':
      content = id ? <QrResolveView key={id} code={id} onScanAgain={() => setQrOpen(true)} /> : <NotFound />;
      break;
    case 'admin':
      if (!isAdmin) content = <AdminGate />;
      else if (id === 'recorridos') content = <TourFormView key={routeKey} tourId={sub && sub !== 'nuevo' ? sub : null} />;
      else if (id === 'puntos') content = <PointFormView key={routeKey} pointId={sub && sub !== 'nuevo' ? sub : null} />;
      else content = <AdminView tab={route.query.get('tab')} />;
      break;
    default:
      content = <NotFound />;
  }

  const page = (
    <ErrorBoundary resetKey={route.path}>
      <Suspense fallback={<PageLoader label={isMap ? 'Cargando el mapa…' : 'Cargando…'} />}>{content}</Suspense>
    </ErrorBoundary>
  );

  if (isAuth) {
    return <div className="min-h-screen bg-background text-on-surface font-sans">{page}</div>;
  }

  if (isAdminArea) {
    return (
      <div className="min-h-screen bg-background text-on-surface font-sans">
        <AdminHeader />
        <main id="contenido">{page}</main>
      </div>
    );
  }

  const activeTab = tabFor(route);
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans lg:pl-64">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:px-4 focus:py-2 focus:rounded-full focus:bg-primary focus:text-white">
        Saltar al contenido
      </a>
      <SideNav
        activeTab={activeTab}
        unreadCount={unread}
        savedCount={favoriteTourIds.length}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenQrScanner={() => setQrOpen(true)}
        onOpenPropose={() => setProposeOpen(true)}
        onShowInstallHelp={() => setInstallHelp(true)}
      />
      {!isImmersive && <TopAppBar unreadCount={unread} onOpenNotifications={() => setNotificationsOpen(true)} onOpenQrScanner={() => setQrOpen(true)} />}
      <main id="contenido" className="flex-1 w-full flex flex-col">
        {page}
      </main>
      <AudioPlayerDrawer placement={isMap ? 'top' : 'bottom'} />
      <BottomNavBar activeTab={activeTab} savedCount={favoriteTourIds.length} />
      <QrScannerModal open={qrOpen} onClose={() => setQrOpen(false)} />
      <NotificationModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} announcements={ANNOUNCEMENTS} />
      <ProposePointModal open={proposeOpen} onClose={() => setProposeOpen(false)} />
      <InstallHelpModal open={installHelp} onClose={() => setInstallHelp(false)} />
    </div>
  );
};

const AdminHeader: React.FC = () => {
  const { currentUser, logout, isAdmin } = useAppStore();
  return (
    <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/admin')} className="flex items-center gap-2.5 min-w-0 text-left">
          <span className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <Icon name="admin_panel_settings" className="text-[20px]" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif font-bold leading-tight">Ruta Doce de Octubre</span>
            <span className="block text-[11px] text-on-primary-container truncate">{currentUser?.name ?? 'Panel de administración'}</span>
          </span>
        </button>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => navigate('/inicio')} className="px-3 py-2 rounded-full text-xs font-bold hover:bg-white/10 flex items-center gap-1">
              <Icon name="mobile" className="text-[16px]" /> <span className="hidden sm:inline">Ver app</span>
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/auth', { replace: true });
              }}
              aria-label="Cerrar sesión"
              className="px-3 py-2 rounded-full text-xs font-bold hover:bg-white/10 flex items-center gap-1"
            >
              <Icon name="logout" className="text-[16px]" /> <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const AdminGate: React.FC = () => (
  <div className="max-w-md mx-auto px-6 py-16 text-center flex flex-col items-center">
    <Icon name="lock" className="text-5xl text-outline mb-3" />
    <h1 className="font-serif text-2xl font-bold text-primary mb-2">Acceso restringido</h1>
    <p className="text-sm text-on-surface-variant mb-6">El panel de gestión de contenidos es solo para cuentas con rol de administrador.</p>
    <button type="button" onClick={() => navigate('/auth?volver=/admin')} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
      Ingresar como administrador
    </button>
  </div>
);

const NotFound: React.FC<{ message?: string }> = ({ message = 'La página que buscas no existe.' }) => (
  <div className="max-w-md mx-auto px-6 py-16 text-center flex flex-col items-center pb-32">
    <Icon name="explore_off" className="text-5xl text-outline mb-3" />
    <h1 className="font-serif text-2xl font-bold text-primary mb-2">No encontramos esta página</h1>
    <p className="text-sm text-on-surface-variant mb-6">{message}</p>
    <button type="button" onClick={() => navigate('/inicio')} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
      Volver al inicio
    </button>
  </div>
);
