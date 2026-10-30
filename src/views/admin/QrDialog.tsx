import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/AppStore';
import { downloadQrPng, qrDataUrl, qrPayload } from '../../services/qr';
import { navigate } from '../../lib/router';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Icon } from '../../components/ui/Icon';

/**
 * Generación y descarga del código QR de un punto (ADMIN-003).
 * Escenario 1: crea un código único vinculado a la ficha del punto.
 * Escenario 2: descarga la imagen lista para imprimir.
 */
export const QrDialog: React.FC<{ pointId: string | null; onClose: () => void }> = ({ pointId, onClose }) => {
  const { points, generateQrCode } = useAppStore();
  const toast = useToast();
  const point = points.find((p) => p.id === pointId) ?? null;
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    if (point?.qrCode) qrDataUrl(point.qrCode).then((url) => !cancelled && setImage(url));
    return () => {
      cancelled = true;
    };
  }, [point?.qrCode]);

  const download = async () => {
    if (!point) return;
    setBusy(true);
    try {
      await downloadQrPng(point);
      toast(`Se descargó ${point.qrCode}.png listo para imprimir.`, { tone: 'success' });
    } catch {
      toast('No fue posible generar la imagen del QR.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!point} onClose={onClose} title="Código QR del punto" icon="qr_code_2" maxWidth="max-w-sm">
      {point && (
        <div className="p-5 text-center">
          <p className="text-sm font-bold text-primary">{point.title}</p>
          {point.qrCode ? (
            <>
              <div className="mx-auto my-4 w-56 h-56 rounded-2xl border border-outline-variant bg-white p-3 flex items-center justify-center">
                {image ? <img src={image} alt={`Código QR ${point.qrCode}`} className="w-full h-full" /> : <Icon name="hourglass_empty" className="text-outline text-3xl" />}
              </div>
              <p className="font-mono text-sm font-bold text-secondary">{point.qrCode}</p>
              <p className="text-[11px] text-on-surface-variant break-all mt-1">{qrPayload(point.qrCode)}</p>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={download} disabled={busy} className="w-full py-3 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  <Icon name="download" className="text-[18px]" /> {busy ? 'Preparando…' : 'Descargar QR (PNG para imprimir)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/punto/${point.id}`);
                  }}
                  className="w-full py-2.5 rounded-full text-primary text-sm font-bold hover:bg-surface-container"
                >
                  Ver la ficha vinculada
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto my-5 w-20 h-20 rounded-2xl bg-secondary-fixed text-secondary flex items-center justify-center">
                <Icon name="qr_code_2" className="text-5xl" />
              </div>
              <p className="text-sm text-on-surface-variant mb-5">
                Este punto aún no tiene código. Al generarlo se crea un código único que abre su ficha informativa al escanearlo.
              </p>
              <button
                type="button"
                onClick={() => {
                  const code = generateQrCode(point.id);
                  toast(`Código ${code} generado y vinculado a la ficha.`, { tone: 'success' });
                }}
                className="w-full py-3 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Icon name="add" className="text-[18px]" /> Generar código QR
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
