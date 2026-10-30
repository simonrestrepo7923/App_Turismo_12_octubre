import React, { useMemo, useState } from 'react';
import type { PointOfInterest, Tour } from '../../types';
import { CATEGORY_BY_ID } from '../../data/categories';
import { useAppStore } from '../../store/AppStore';
import { formatRating, getRating, getToursForPoint } from '../../store/selectors';
import { normalizeText } from '../../lib/format';
import { buildPath, navigate } from '../../lib/router';
import { ConfirmDialog } from '../../components/ui/Modal';
import { SafeImage } from '../../components/ui/SafeImage';
import { useToast } from '../../components/ui/Toast';
import { Icon } from '../../components/ui/Icon';
import { QrDialog } from './QrDialog';
import { ReportsPanel } from './ReportsPanel';

type AdminTab = 'recorridos' | 'puntos' | 'reportes';

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'recorridos', label: 'Recorridos', icon: 'route' },
  { id: 'puntos', label: 'Puntos', icon: 'pin_drop' },
  { id: 'reportes', label: 'Reportes', icon: 'monitoring' },
];

/** Panel de gestión de contenidos para el rol Administrador. */
export const AdminView: React.FC<{ tab: string | null }> = ({ tab }) => {
  const { tours, points, ratings, deleteTour, deletePoint, resetDemoData, remote } = useAppStore();
  const toast = useToast();
  const active: AdminTab = TABS.some((t) => t.id === tab) ? (tab as AdminTab) : 'recorridos';
  const [pendingTour, setPendingTour] = useState<Tour | null>(null);
  const [pendingPoint, setPendingPoint] = useState<PointOfInterest | null>(null);
  const [qrPoint, setQrPoint] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPoints = useMemo(() => {
    const q = normalizeText(search.trim());
    return q ? points.filter((p) => normalizeText(`${p.title} ${p.kindLabel} ${p.qrCode ?? ''}`).includes(q)) : points;
  }, [points, search]);

  const setTab = (t: AdminTab) => navigate(buildPath('/admin', { tab: t }), { replace: true });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-16">
      <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">Gestión de contenidos</p>
          <h1 className="font-serif text-3xl font-bold text-primary">Panel de administración</h1>
        </div>
        <div className="flex gap-2 text-center">
          <Kpi value={tours.length} label="recorridos" />
          <Kpi value={points.length} label="puntos" />
          <Kpi value={points.filter((p) => p.qrCode).length} label="con QR" />
        </div>
      </div>

      <div role="tablist" className="flex gap-1 p-1 rounded-2xl bg-surface-container mb-5 overflow-x-auto hide-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-max px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              active === t.id ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Icon name={t.icon} className="text-[18px]" />
            {t.label}
          </button>
        ))}
      </div>

      {active === 'recorridos' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant">Los recorridos publicados aparecen de inmediato en Explorar.</p>
            <button type="button" onClick={() => navigate('/admin/recorridos/nuevo')} className="px-4 py-2.5 rounded-full bg-secondary text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs">
              <Icon name="add" className="text-[18px]" /> Nuevo recorrido
            </button>
          </div>
          {tours.map((t) => {
            const r = getRating(ratings, 'tour', t.id);
            return (
              <article key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/60">
                <SafeImage src={t.coverImage} alt={t.coverAlt} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-primary leading-snug line-clamp-2">{t.title}</h2>
                  <p className="text-xs text-on-surface-variant truncate">
                    {CATEGORY_BY_ID[t.category].label} · {t.pointIds.length} puntos · ★ {formatRating(r.average)} ({r.count})
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <RowButton icon="visibility" label={`Ver ${t.title} en la app`} onClick={() => navigate(`/recorrido/${t.id}`)} />
                  <RowButton icon="edit" label={`Editar ${t.title}`} onClick={() => navigate(`/admin/recorridos/${t.id}`)} />
                  <RowButton icon="delete" label={`Eliminar ${t.title}`} danger onClick={() => setPendingTour(t)} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      {active === 'puntos' && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar punto o código QR…"
                aria-label="Buscar punto de interés"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button type="button" onClick={() => navigate('/admin/puntos/nuevo')} className="px-4 py-2.5 rounded-full bg-secondary text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs">
              <Icon name="add" className="text-[18px]" /> Nuevo punto
            </button>
          </div>
          {filteredPoints.map((p) => {
            const inTours = getToursForPoint(p.id, tours);
            return (
              <article key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/60">
                <SafeImage src={p.images[0]} alt={p.imageAlt} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-primary leading-snug line-clamp-2">{p.title}</h2>
                  <p className="text-xs text-on-surface-variant truncate">{inTours.length ? inTours.map((t) => t.title.split(':')[0]).join(' · ') : 'Sin recorrido asignado'}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${p.qrCode ? 'bg-primary-fixed text-primary' : 'bg-secondary-fixed text-on-secondary-fixed'}`}>
                    <Icon name="qr_code_2" className="text-[12px]" />
                    {p.qrCode ?? 'Sin QR'}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <RowButton icon="qr_code_2" label={p.qrCode ? `Ver o descargar QR de ${p.title}` : `Generar QR de ${p.title}`} onClick={() => setQrPoint(p.id)} highlight={!p.qrCode} />
                  <RowButton icon="edit" label={`Editar ${p.title}`} onClick={() => navigate(`/admin/puntos/${p.id}`)} />
                  <RowButton icon="delete" label={`Eliminar ${p.title}`} danger onClick={() => setPendingPoint(p)} />
                </div>
              </article>
            );
          })}
          {filteredPoints.length === 0 && <p className="text-sm text-on-surface-variant text-center py-6">No hay puntos que coincidan con la búsqueda.</p>}
        </section>
      )}

      {active === 'reportes' && <ReportsPanel />}

      <div className="mt-10 pt-5 border-t border-outline-variant/50 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant max-w-md">Los datos se guardan en este navegador. Puedes volver al contenido original de demostración cuando quieras.</p>
        <button type="button" onClick={() => setConfirmReset(true)} className="px-4 py-2 rounded-full border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container flex items-center gap-1">
          <Icon name="restart_alt" className="text-[16px]" /> {remote ? 'Recargar datos de la base de datos' : 'Restablecer datos de demostración'}
        </button>
      </div>

      <ConfirmDialog
        open={!!pendingTour}
        danger
        title="Eliminar recorrido"
        message={<>¿Eliminar «{pendingTour?.title}»? Dejará de aparecer en la app. Sus puntos de interés se conservan.</>}
        confirmLabel="Eliminar"
        onCancel={() => setPendingTour(null)}
        onConfirm={() => {
          if (pendingTour) {
            deleteTour(pendingTour.id);
            toast('Recorrido eliminado.', { tone: 'success' });
          }
          setPendingTour(null);
        }}
      />
      <ConfirmDialog
        open={!!pendingPoint}
        danger
        title="Eliminar punto de interés"
        message={
          pendingPoint && (
            <>
              ¿Eliminar «{pendingPoint.title}»? Se retirará del mapa
              {getToursForPoint(pendingPoint.id, tours).length > 0
                ? ` y de ${getToursForPoint(pendingPoint.id, tours).length === 1 ? 'el recorrido' : 'los recorridos'}: ${getToursForPoint(pendingPoint.id, tours).map((t) => t.title).join(', ')}.`
                : '.'}{' '}
              Esta acción no se puede deshacer.
            </>
          )
        }
        confirmLabel="Eliminar punto"
        onCancel={() => setPendingPoint(null)}
        onConfirm={() => {
          if (pendingPoint) {
            deletePoint(pendingPoint.id);
            toast('Punto eliminado del mapa y de sus recorridos.', { tone: 'success' });
          }
          setPendingPoint(null);
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        title={remote ? 'Recargar datos' : 'Restablecer datos'}
        message={remote ? 'Se volverán a traer los recorridos, puntos y valoraciones guardados en la base de datos. No se borra nada.' : 'Se borrarán los recorridos, puntos, cuentas, valoraciones y visitas creados en este navegador, y se cargará el contenido original.'}
        confirmLabel={remote ? 'Recargar' : 'Restablecer'}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemoData();
          setConfirmReset(false);
          toast(remote ? 'Datos recargados.' : 'Datos de demostración restablecidos.', { tone: 'success' });
        }}
      />
      <QrDialog pointId={qrPoint} onClose={() => setQrPoint(null)} />
    </div>
  );
};

const Kpi: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/60 min-w-16">
    <p className="font-serif text-xl font-bold text-primary leading-none">{value}</p>
    <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
  </div>
);

const RowButton: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean; highlight?: boolean }> = ({ icon, label, onClick, danger, highlight }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
      danger ? 'text-error hover:bg-error/10' : highlight ? 'bg-secondary text-white hover:bg-secondary/90' : 'text-primary hover:bg-surface-container'
    }`}
  >
    <Icon name={icon} className="text-[19px]" />
  </button>
);
