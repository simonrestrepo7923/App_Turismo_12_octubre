import type { PointOfInterest, Review, Tour, Visit } from '../types';
import { CATEGORY_BY_ID } from '../data/categories';
import { formatShortDate, slugify } from '../lib/format';

/** Reporte de valoraciones y participación por recorrido (REP-001). */

export interface PointReportRow {
  point: PointOfInterest;
  average: number;
  reviews: number;
  stamps: number;
}

export interface TourReport {
  tour: Tour;
  from: string;
  to: string;
  generatedAt: string;
  average: number;
  reviewCount: number;
  visitCount: number;
  points: PointReportRow[];
}

/** `from` y `to` en formato AAAA-MM-DD (inclusive). */
export function buildTourReport(
  tour: Tour,
  points: PointOfInterest[],
  reviews: Review[],
  visits: Visit[],
  from: string,
  to: string,
): TourReport {
  const start = new Date(from + 'T00:00:00').getTime();
  const end = new Date(to + 'T23:59:59.999').getTime();
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };

  const tourPoints = tour.pointIds.map((id) => points.find((p) => p.id === id)).filter((p): p is PointOfInterest => !!p);
  const pointIds = new Set(tourPoints.map((p) => p.id));

  const tourReviews = reviews.filter(
    (r) => inRange(r.date) && ((r.targetType === 'tour' && r.targetId === tour.id) || (r.targetType === 'point' && pointIds.has(r.targetId))),
  );
  const average = tourReviews.length ? tourReviews.reduce((s, r) => s + r.rating, 0) / tourReviews.length : 0;
  const visitCount = visits.filter((v) => v.tourId === tour.id && !v.pointId && inRange(v.date)).length;

  const rows: PointReportRow[] = tourPoints.map((point) => {
    const pr = tourReviews.filter((r) => r.targetType === 'point' && r.targetId === point.id);
    return {
      point,
      reviews: pr.length,
      average: pr.length ? pr.reduce((s, r) => s + r.rating, 0) / pr.length : 0,
      stamps: visits.filter((v) => v.pointId === point.id && inRange(v.date)).length,
    };
  });

  return {
    tour,
    from,
    to,
    generatedAt: new Date().toISOString(),
    average,
    reviewCount: tourReviews.length,
    visitCount,
    points: rows,
  };
}

/** Genera y descarga el PDF del reporte. jsPDF se carga solo cuando se necesita. */
export async function exportReportPdf(report: TourReport): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const green: [number, number, number] = [1, 45, 29];
  const terracotta: [number, number, number] = [162, 62, 24];
  const muted: [number, number, number] = [65, 72, 68];

  // Encabezado
  doc.setFillColor(...green);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Reporte de valoraciones y participación', M, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Ruta Doce de Octubre · Panel de administración', M, 23);
  doc.text(`Generado: ${formatShortDate(report.generatedAt)}`, W - M, 23, { align: 'right' });

  let y = 48;
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines: string[] = doc.splitTextToSize(report.tour.title, W - 2 * M);
  doc.text(titleLines, M, y);
  y += titleLines.length * 6.5 + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(
    `Categoría: ${CATEGORY_BY_ID[report.tour.category].label}   ·   Periodo: ${formatShortDate(report.from + 'T12:00:00')} – ${formatShortDate(report.to + 'T12:00:00')}`,
    M,
    y,
  );
  y += 12;

  // Indicadores
  const cards = [
    { label: 'Promedio de valoración', value: report.reviewCount ? report.average.toFixed(2) + ' / 5' : 'Sin datos' },
    { label: 'Valoraciones recibidas', value: String(report.reviewCount) },
    { label: 'Visitas registradas', value: String(report.visitCount) },
  ];
  const cardW = (W - 2 * M - 8) / 3;
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 4);
    doc.setDrawColor(193, 200, 194);
    doc.setFillColor(240, 245, 240);
    doc.roundedRect(x, y, cardW, 24, 3, 3, 'FD');
    doc.setTextColor(...terracotta);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(c.value, x + cardW / 2, y + 11, { align: 'center' });
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(c.label, x + cardW / 2, y + 18.5, { align: 'center' });
  });
  y += 36;

  // Tabla por punto
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalle por punto de interés', M, y);
  y += 6;
  const cols = [M, M + 100, M + 130, M + 158];
  doc.setFillColor(...green);
  doc.rect(M, y, W - 2 * M, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  ['Punto de interés', 'Promedio', 'Valoraciones', 'Sellos'].forEach((h, i) => doc.text(h, cols[i] + 2, y + 5.5));
  y += 8;
  doc.setFont('helvetica', 'normal');
  report.points.forEach((row, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(246, 251, 245);
      doc.rect(M, y, W - 2 * M, 8, 'F');
    }
    doc.setTextColor(24, 29, 26);
    const name = row.point.title.length > 52 ? row.point.title.slice(0, 51) + '…' : row.point.title;
    doc.text(name, cols[0] + 2, y + 5.5);
    doc.text(row.reviews ? row.average.toFixed(2) : '—', cols[1] + 2, y + 5.5);
    doc.text(String(row.reviews), cols[2] + 2, y + 5.5);
    doc.text(String(row.stamps), cols[3] + 2, y + 5.5);
    y += 8;
  });
  if (report.points.length === 0) {
    doc.setTextColor(...muted);
    doc.text('Este recorrido no tiene puntos de interés asociados.', M + 2, y + 6);
    y += 10;
  }

  y += 10;
  doc.setTextColor(...muted);
  doc.setFontSize(8.5);
  doc.text(
    doc.splitTextToSize(
      'Las visitas corresponden a recorridos iniciados en la app. Los sellos son puntos visitados y verificados por los caminantes (escaneo QR o marcación manual).',
      W - 2 * M,
    ),
    M,
    y,
  );

  const fileName = `Reporte_${slugify(report.tour.title)}_${report.from}_a_${report.to}.pdf`;
  doc.save(fileName);
  return fileName;
}
