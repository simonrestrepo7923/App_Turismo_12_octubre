import React, { useEffect } from 'react';
import { useAppStore } from '../store/AppStore';
import { findPointByQr } from '../services/qr';
import { buildPath, navigate } from '../lib/router';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';

/**
 * Destino de los enlaces #/qr/<código> (escáner integrado o cámara del celular).
 * QR-001 escenario 1: abre automáticamente la ficha y sella la visita si hay sesión.
 * QR-001 escenario 2: si el código no existe, lo informa y sugiere búsqueda manual.
 */
export const QrResolveView: React.FC<{ code: string; onScanAgain: () => void }> = ({ code, onScanAgain }) => {
  const { points, tours, currentUser, recordVisit } = useAppStore();
  const toast = useToast();
  const point = findPointByQr(code, points);

  useEffect(() => {
    if (!point) return;
    const tour = tours.find((t) => t.pointIds.includes(point.id));
    if (currentUser) {
      recordVisit({ pointId: point.id, tourId: tour?.id });
      toast(`Placa reconocida: «${point.title}» quedó sellado en tu pasaporte.`, { tone: 'success' });
    } else {
      toast(`Placa reconocida: ${point.title}.`, { tone: 'success' });
    }
    navigate(buildPath(`/punto/${point.id}`, { recorrido: tour?.id }), { replace: true });
  }, [point?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (point) return null;

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center flex flex-col items-center pb-32">
      <span className="w-20 h-20 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
        <Icon name="qr_code_2" className="text-5xl" />
      </span>
      <h1 className="font-serif text-2xl font-bold text-primary mb-2">Código QR no válido</h1>
      <p className="text-sm text-on-surface-variant mb-1">
        El código <span className="font-mono font-bold">{code}</span> no corresponde a ningún punto de la ruta o la placa está dañada.
      </p>
      <p className="text-sm text-on-surface-variant mb-6">Puedes buscar el lugar manualmente.</p>
      <div className="w-full flex flex-col gap-2">
        <button type="button" onClick={() => navigate('/explorar?buscar=1', { replace: true })} className="w-full py-3 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center gap-2">
          <Icon name="search" className="text-[18px]" /> Buscar el lugar manualmente
        </button>
        <button type="button" onClick={onScanAgain} className="w-full py-3 rounded-full border border-primary text-primary text-sm font-bold">
          Escanear otra placa
        </button>
      </div>
    </div>
  );
};
