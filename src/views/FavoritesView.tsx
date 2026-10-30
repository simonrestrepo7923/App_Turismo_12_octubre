import React from 'react';
import { useAppStore } from '../store/AppStore';
import { buildPath, navigate } from '../lib/router';
import { TourCard } from '../components/TourCard';
import { Icon } from '../components/ui/Icon';

/** Recorridos guardados por el turista (requiere cuenta, PERFIL-001). */
export const FavoritesView: React.FC = () => {
  const { tours, favoriteTourIds, currentUser } = useAppStore();
  const saved = tours.filter((t) => favoriteTourIds.includes(t.id));

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 pt-4 lg:pt-8 pb-32 lg:pb-12">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold tracking-wide mb-1.5">
          <Icon name="bookmark" className="text-[14px]" />
          TUS RUTAS GUARDADAS
        </span>
        <h1 className="font-serif text-3xl text-primary font-bold tracking-tight">Mis favoritos</h1>
        <p className="text-sm text-on-surface-variant mt-1">Recorridos y memorias que guardaste para tu próxima caminata comunitaria.</p>
      </header>

      {!currentUser ? (
        <Empty
          icon="lock"
          title="Inicia sesión para ver tus favoritos"
          text="Con una cuenta puedes guardar recorridos, sellar tu pasaporte barrial y conservar tu historial de valoraciones."
          action="Iniciar sesión o registrarme"
          onAction={() => navigate(buildPath('/auth', { volver: '/favoritos' }))}
        />
      ) : saved.length === 0 ? (
        <Empty
          icon="bookmark"
          title="Aún no tienes rutas guardadas"
          text="Explora las caminatas históricas, los parques, los sabores y los miradores de Doce de Octubre y guárdalas con el ícono de corazón."
          action="Explorar recorridos"
          onAction={() => navigate('/explorar')}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {saved.map((t) => (
            <TourCard key={t.id} tour={t} />
          ))}
        </div>
      )}
    </div>
  );
};

const Empty: React.FC<{ icon: string; title: string; text: string; action: string; onAction: () => void }> = ({ icon, title, text, action, onAction }) => (
  <div className="p-10 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/60 shadow-xs flex flex-col items-center">
    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline mb-3">
      <Icon name={icon} className="text-3xl" />
    </div>
    <h2 className="font-serif text-xl font-bold text-primary mb-1">{title}</h2>
    <p className="text-sm text-on-surface-variant max-w-sm mb-5 leading-relaxed">{text}</p>
    <button type="button" onClick={onAction} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2">
      {action} <Icon name="arrow_forward" className="text-[16px]" />
    </button>
  </div>
);
