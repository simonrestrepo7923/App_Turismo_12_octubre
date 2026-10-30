import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { findPointByQr, parseQrPayload } from '../services/qr';
import { navigate, buildPath } from '../lib/router';
import { Modal } from './ui/Modal';
import { Icon } from './ui/Icon';

/**
 * Escáner de placas QR (QR-001).
 * - Escenario 1: si el código corresponde a un punto, abre su ficha.
 * - Escenario 2: si el código está dañado o no es de la ruta, informa y sugiere
 *   buscar el lugar manualmente.
 * Usa la cámara trasera cuando está disponible; si no, permite escribir el código.
 */

type CameraState = 'idle' | 'starting' | 'scanning' | 'unavailable' | 'denied';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ open, onClose }) => {
  const { points } = useAppStore();
  const [camera, setCamera] = useState<CameraState>('idle');
  const [invalidCode, setInvalidCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handledRef = useRef(false);
  const decoderRef = useRef<typeof import('jsqr').default | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleResult = useCallback(
    (raw: string) => {
      if (handledRef.current) return;
      const code = parseQrPayload(raw);
      const point = findPointByQr(code, points);
      if (point) {
        handledRef.current = true;
        stopCamera();
        onClose();
        navigate(buildPath(`/qr/${encodeURIComponent(point.qrCode!)}`, {}));
      } else {
        stopCamera();
        setCamera('idle');
        setInvalidCode(raw.trim().slice(0, 60) || '(vacío)');
      }
    },
    [points, onClose, stopCamera],
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const scale = Math.min(1, 640 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = decoderRef.current?.(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (result?.data) {
          handleResult(result.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleResult]);

  const startCamera = useCallback(async () => {
    setInvalidCode(null);
    handledRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    setCamera('starting');
    try {
      // El decodificador de QR se carga solo al abrir el escáner.
      if (!decoderRef.current) decoderRef.current = (await import('jsqr')).default;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setCamera('scanning');
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, [scanFrame]);

  useEffect(() => {
    if (open) {
      setManualCode('');
      setInvalidCode(null);
      void startCamera();
    }
    return stopCamera;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    stopCamera();
    setCamera('idle');
    onClose();
  };

  const demoPoints = points.filter((p) => p.qrCode).slice(0, 3);

  return (
    <Modal open={open} onClose={close} title="Escanear placa QR" icon="qr_code_scanner">
      {invalidCode ? (
        <div className="p-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mb-3">
            <Icon name="qr_code_2" className="text-4xl" />
          </div>
          <h3 className="font-serif text-xl font-bold text-primary mb-1">Código QR no válido</h3>
          <p className="text-sm text-on-surface-variant max-w-xs mb-5">
            No reconocemos este código o está dañado. Puedes buscar el lugar manualmente en el listado de recorridos y puntos.
          </p>
          <div className="w-full flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/explorar?buscar=1');
              }}
              className="w-full py-3 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Icon name="search" className="text-[18px]" />
              Buscar el lugar manualmente
            </button>
            <button type="button" onClick={startCamera} className="w-full py-2.5 rounded-full text-primary text-sm font-bold hover:bg-surface-container">
              Intentar de nuevo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative bg-black h-72 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${camera === 'scanning' ? 'opacity-100' : 'opacity-0'}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            {camera === 'denied' || camera === 'unavailable' ? (
              <Icon name="no_photography" className="text-white/70 text-5xl -mt-10" />
            ) : (
            <div className="relative w-52 h-52 rounded-2xl">
              {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map((c) => (
                <span key={c} className={`absolute w-7 h-7 border-secondary-container rounded-sm ${c}`} />
              ))}
              {camera === 'scanning' && <span className="absolute left-3 right-3 top-1/2 h-0.5 bg-secondary-container shadow-[0_0_10px_#FE8357] animate-scan-line" />}
            </div>
            )}
            {camera !== 'scanning' && (
              <div className="absolute inset-x-6 bottom-5 text-center text-white text-xs leading-relaxed">
                {camera === 'starting' && 'Activando la cámara…'}
                {camera === 'denied' && 'No diste permiso para usar la cámara. Puedes escribir el código impreso en la placa.'}
                {camera === 'unavailable' && 'La cámara no está disponible en este dispositivo. Escribe el código impreso en la placa.'}
              </div>
            )}
            {camera === 'scanning' && (
              <p className="absolute inset-x-6 bottom-4 text-center text-white/90 text-xs">Apunta a la placa de bronce o cerámica con el código QR.</p>
            )}
          </div>

          <div className="p-5 space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleResult(manualCode);
              }}
            >
              <label htmlFor="qr-manual" className="block text-xs font-bold text-on-surface mb-1.5">
                ¿No puedes escanear? Escribe el código de la placa
              </label>
              <div className="flex gap-2">
                <input
                  id="qr-manual"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Ej. QR-DOCE-02"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
                <button type="submit" className="px-4 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50" disabled={!manualCode.trim()}>
                  Abrir
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-outline-variant/50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2">Modo demostración</p>
              <div className="flex flex-wrap gap-2">
                {demoPoints.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleResult(p.qrCode!)}
                    className="px-3 py-1.5 rounded-full border border-outline-variant text-xs font-semibold text-primary hover:bg-surface-container"
                  >
                    {p.qrCode}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleResult('%%placa-dañada%%')}
                  className="px-3 py-1.5 rounded-full border border-error/40 text-xs font-semibold text-error hover:bg-error/5"
                >
                  Simular código dañado
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};
