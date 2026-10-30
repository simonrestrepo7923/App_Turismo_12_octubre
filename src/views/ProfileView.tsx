import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { CATEGORY_BY_ID } from '../data/categories';
import { getTourPoints } from '../store/selectors';
import { formatShortDate, initials } from '../lib/format';
import { buildPath, navigate } from '../lib/router';
import { StarDisplay } from '../components/ui/StarRating';
import { Icon } from '../components/ui/Icon';
import { AccountSettings } from './AccountSettings';

type Tab = 'pasaporte' | 'insignias' | 'valoraciones' | 'cuenta' | 'red';

/** Perfil del caminante: pasaporte de sellos, insignias e historial de valoraciones. */
export const ProfileView: React.FC<{ onOpenProposeModal: () => void; onShowInstallHelp: () => void }> = ({ onOpenProposeModal, onShowInstallHelp }) => {
  const { currentUser, isAdmin, logout, tours, points, visits, reviews } = useAppStore();
  const [tab, setTab] = useState<Tab>('pasaporte');

  const myVisits = useMemo(
    () => (currentUser ? visits.filter((v) => v.userId === currentUser.id && v.pointId).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [visits, currentUser],
  );
  const myReviews = useMemo(
    () => (currentUser ? reviews.filter((r) => r.userId === currentUser.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [reviews, currentUser],
  );
  const stamped = new Set(myVisits.map((v) => v.pointId));

  const badges = useMemo(() => {
    const visitedPoints = points.filter((p) => stamped.has(p.id));
    const count = (cat: string) => visitedPoints.filter((p) => p.category === cat).length;
    const toursDone = tours.filter((t) => t.pointIds.length > 0 && t.pointIds.every((id) => stamped.has(id))).length;
    return [
      { id: 'b1', title: 'Pionero de pasajes', description: 'Sella tu primer punto de interés.', icon: 'flag', unlocked: visitedPoints.length >= 1 },
      { id: 'b2', title: 'Vida de parque', description: 'Visita 3 parques o escenarios deportivos.', icon: 'park', unlocked: count('recreacion') >= 3 },
      { id: 'b3', title: 'Paladar campesino', description: 'Visita 2 paradas gastronómicas.', icon: 'restaurant', unlocked: count('gastronomia') >= 2 },
      { id: 'b4', title: 'Vigía del Picacho', description: 'Llega a 2 miradores del barrio.', icon: 'landscape', unlocked: count('miradores') >= 2 },
      { id: 'b5', title: 'Caminante completo', description: 'Completa todos los puntos de un recorrido.', icon: 'military_tech', unlocked: toursDone >= 1 },
      { id: 'b6', title: 'Voz de la comunidad', description: 'Publica 3 valoraciones.', icon: 'campaign', unlocked: myReviews.length >= 3 },
    ];
  }, [points, tours, stamped, myReviews.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-6 py-14 text-center flex flex-col items-center pb-32">
        <span className="w-20 h-20 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-4">
          <Icon name="local_activity" className="text-4xl" />
        </span>
        <h1 className="font-serif text-2xl font-bold text-primary mb-2">Tu pasaporte barrial</h1>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
          Crea una cuenta para guardar tus recorridos favoritos, sellar los puntos que visitas y conservar tu historial de valoraciones.
        </p>
        <div className="w-full flex flex-col gap-2">
          <button type="button" onClick={() => navigate(buildPath('/auth', { modo: 'registro', volver: '/perfil' }))} className="w-full py-3 rounded-full bg-secondary text-white text-sm font-bold">
            Crear cuenta
          </button>
          <button type="button" onClick={() => navigate(buildPath('/auth', { volver: '/perfil' }))} className="w-full py-3 rounded-full border border-primary text-primary text-sm font-bold">
            Ya tengo cuenta · Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pasaporte', label: `Pasaporte (${myVisits.length})` },
    { id: 'insignias', label: 'Insignias' },
    { id: 'valoraciones', label: `Valoraciones (${myReviews.length})` },
    { id: 'cuenta', label: 'Cuenta' },
    { id: 'red', label: 'Acerca de la red' },
  ];

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-4 lg:pt-8 pb-32 lg:pb-12">
      <div className="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-outline-variant/60 shadow-xs mb-6 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <span className="w-20 h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-serif text-2xl font-bold ring-4 ring-primary-fixed/40">
            {initials(currentUser.name)}
          </span>
          <div>
            <p className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary uppercase tracking-wider mb-1">
              <Icon name={isAdmin ? 'admin_panel_settings' : 'military_tech'} className="text-sm" />
              {isAdmin ? 'Administrador de contenidos' : `Caminante barrial · nivel ${1 + Math.floor(myVisits.length / 3)}`}
            </p>
            <h1 className="font-serif text-2xl font-bold text-primary">{currentUser.name}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">{currentUser.email}</p>
            <p className="text-xs text-primary font-medium mt-1">Miembro desde {formatShortDate(currentUser.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {isAdmin && (
            <button type="button" onClick={() => navigate('/admin')} className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center gap-1">
              <Icon name="dashboard" className="text-[16px]" /> Panel de administración
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/auth', { replace: true });
            }}
            className="px-4 py-2 rounded-full border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div role="tablist" className="flex items-center gap-1 border-b border-outline-variant/60 mb-6 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
              tab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pasaporte' && (
        <section className="space-y-6">
          {tours.filter((t) => t.pointIds.length > 0).map((t) => {
            const tp = getTourPoints(t, points);
            const done = tp.filter((p) => stamped.has(p.id)).length;
            if (done === 0) return null;
            return (
              <div key={t.id} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button type="button" onClick={() => navigate(`/recorrido/${t.id}`)} className="text-xs font-bold text-primary text-left hover:underline">{t.title}</button>
                  <span className="text-xs font-bold text-secondary shrink-0">{done} de {tp.length}</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="bg-primary-container h-full rounded-full" style={{ width: `${(done / tp.length) * 100}%` }} />
                </div>
              </div>
            );
          })}

          {myVisits.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-outline-variant">
              <Icon name="approval" className="text-4xl text-outline mb-2" />
              <p className="text-sm font-bold text-on-surface">Aún no tienes sellos</p>
              <p className="text-xs text-on-surface-variant mt-1 mb-4">Escanea el código QR de cada placa o marca la visita desde el mapa para sellar tu pasaporte.</p>
              <button type="button" onClick={() => navigate('/explorar')} className="px-5 py-2 rounded-full bg-primary text-white text-xs font-bold">Elegir un recorrido</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myVisits.map((v) => {
                const p = points.find((pt) => pt.id === v.pointId);
                if (!p) return null;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate(`/punto/${p.id}`)}
                    className="text-left bg-surface-container-lowest p-4 rounded-2xl border border-secondary/30 shadow-xs relative overflow-hidden hover:border-secondary"
                  >
                    <Icon name="verified" className="absolute top-2 right-2 text-6xl text-secondary opacity-15" />
                    <span className="text-[10px] uppercase font-bold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full">Sello verificado</span>
                    <h3 className="font-serif text-base font-bold text-primary mt-2">{p.title}</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{CATEGORY_BY_ID[p.category].label}</p>
                    <p className="mt-3 pt-2 border-t border-outline-variant/30 text-[11px] text-outline">Sellado el {formatShortDate(v.date)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'insignias' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badges.map((b) => (
            <div key={b.id} className={`p-4 rounded-2xl border flex items-start gap-3.5 ${b.unlocked ? 'bg-surface-container-lowest border-outline-variant/70 shadow-xs' : 'bg-surface-container-low/50 border-outline-variant/40 opacity-60'}`}>
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${b.unlocked ? 'bg-secondary-fixed text-secondary' : 'bg-surface-container text-outline'}`}>
                <Icon name={b.icon} className="text-2xl" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-sm font-bold text-primary">{b.title}</h3>
                  <span className={`text-[10px] font-bold px-1.5 rounded ${b.unlocked ? 'text-primary bg-primary-fixed' : 'text-outline'}`}>{b.unlocked ? 'Obtenida' : 'Bloqueada'}</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'valoraciones' && (
        <section className="space-y-3">
          {myReviews.length === 0 ? (
            <p className="text-sm text-on-surface-variant p-6 text-center rounded-2xl border border-dashed border-outline-variant">
              Aún no has valorado lugares ni recorridos. Tus opiniones ayudan a otros visitantes.
            </p>
          ) : (
            myReviews.map((r) => {
              const name = r.targetType === 'tour' ? tours.find((t) => t.id === r.targetId)?.title : points.find((p) => p.id === r.targetId)?.title;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(r.targetType === 'tour' ? `/recorrido/${r.targetId}` : `/punto/${r.targetId}`)}
                  className="w-full text-left p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 hover:border-primary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-primary truncate">{name ?? 'Contenido retirado'}</span>
                    <StarDisplay value={r.rating} className="text-[14px]" />
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{r.comment}</p>
                  <p className="text-[11px] text-outline mt-1.5">{r.targetType === 'tour' ? 'Recorrido' : 'Punto de interés'} · {formatShortDate(r.date)}</p>
                </button>
              );
            })
          )}
        </section>
      )}

      {tab === 'cuenta' && <AccountSettings onShowInstallHelp={onShowInstallHelp} />}

      {tab === 'red' && (
        <section className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/60 shadow-xs space-y-4">
          <h2 className="font-serif text-xl font-bold text-primary">Ruta Doce de Octubre · Historias que se caminan</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Esta cartografía comunitaria es un proceso vivo de investigación-acción participativa, promovido por la Mesa de Cultura Comunitaria, líderes fundadores y colectivos juveniles de la Comuna 6 de Medellín.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            A través de códigos QR, señalización patrimonial y audioguías con las voces de quienes levantaron el barrio, transformamos las calles en un museo abierto de dignidad, paz y memoria colectiva.
          </p>
          <div className="pt-4 border-t border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-primary">¿Tienes un relato para sumar?</p>
              <p className="text-[11px] text-on-surface-variant">Postula una nueva estación para la próxima edición.</p>
            </div>
            <button type="button" onClick={onOpenProposeModal} className="px-4 py-2 rounded-full border border-secondary text-secondary text-xs font-bold hover:bg-secondary/10">
              Proponer punto
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
