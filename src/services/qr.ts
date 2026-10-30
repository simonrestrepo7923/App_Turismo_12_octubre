import type { PointOfInterest } from '../types';
import { absoluteUrl } from '../lib/router';

/**
 * Códigos QR de las placas (QR-001 y ADMIN-003).
 * El QR contiene una URL de la app (#/qr/<código>), así funciona tanto con el
 * escáner integrado como con la cámara nativa del celular.
 */

export function qrPayload(code: string): string {
  return absoluteUrl(`/qr/${encodeURIComponent(code)}`);
}

/** Extrae el código de una lectura: acepta la URL completa o el código suelto. */
export function parseQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const fromUrl = text.match(/#\/qr\/([^?#\s]+)/);
  if (fromUrl) return decodeURIComponent(fromUrl[1]).toUpperCase();
  if (/^QR-[A-Z0-9-]{2,}$/i.test(text)) return text.toUpperCase();
  return null;
}

export function findPointByQr(code: string | null, points: PointOfInterest[]): PointOfInterest | null {
  if (!code) return null;
  return points.find((p) => p.qrCode?.toUpperCase() === code.toUpperCase()) ?? null;
}

// La librería de generación solo se descarga cuando el administrador la usa.
const loadQrLib = () => import('qrcode').then((m) => m.default);

export async function qrDataUrl(code: string, size = 320): Promise<string> {
  const QRCode = await loadQrLib();
  return QRCode.toDataURL(qrPayload(code), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#012d1d', light: '#ffffff' },
  });
}

/** Genera un PNG listo para imprimir (QR + nombre del punto + código) y lo descarga. */
export async function downloadQrPng(point: PointOfInterest): Promise<void> {
  if (!point.qrCode) throw new Error('El punto no tiene código QR');
  const qrSize = 900;
  const padding = 70;
  const textArea = 230;
  const canvas = document.createElement('canvas');
  canvas.width = qrSize + padding * 2;
  canvas.height = qrSize + padding * 2 + textArea;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const QRCode = await loadQrLib();
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrPayload(point.qrCode), {
    width: qrSize,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#012d1d', light: '#ffffff' },
  });
  ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);

  ctx.fillStyle = '#012d1d';
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px Georgia, serif';
  const title = point.title.length > 34 ? point.title.slice(0, 33) + '…' : point.title;
  ctx.fillText(title, canvas.width / 2, qrSize + padding + 95);
  ctx.fillStyle = '#a23e18';
  ctx.font = 'bold 40px monospace';
  ctx.fillText(point.qrCode, canvas.width / 2, qrSize + padding + 155);
  ctx.fillStyle = '#414844';
  ctx.font = '30px sans-serif';
  ctx.fillText('Ruta Doce de Octubre · Escanea para conocer la historia', canvas.width / 2, qrSize + padding + 205);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${point.qrCode}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
