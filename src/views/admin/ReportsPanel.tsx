import React, { useState } from 'react';
import { useAppStore } from '../../store/AppStore';
import { buildTourReport, exportReportPdf, type TourReport } from '../../services/reports';
import { formatShortDate, toDateInput } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { Icon } from '../../components/ui/Icon';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateInput(d);
};

const PRESETS = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '12 meses', days: 365 },
];

/**
 * Reportes de valoraciones y participación (REP-001).
 * Escenario 1: recorrido + rango de fechas → promedio de calificaciones y visitas.
 * Escenario 2: exportación del reporte a PDF.
 */
export const ReportsPanel: React.FC = () => {
  const { tours, points, reviews, visits } = useAppStore();
  const toast = useToast();
  const [tourId, setTourId] = useState(tours[0]?.id ?? '');
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TourReport | null>(null);
  const [exporting, setExporting] = useState(false);

  const generate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const tour = tours.find((t) => t.id === tourId);
    if (!tour) return setError('Selecciona un recorrido.');
    if (!from || !to) return setError('Selecciona las dos fechas del rango.');
    if (from > to) return setError('La fecha inicial no puede ser posterior a la fecha final.');
    setError(null);
    setReport(buildTourReport(tour, points, reviews, visits, from, to));
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const name = await exportReportPdf(report);
      toast(`Reporte exportado: ${name}`, { tone: 'success' });
    } catch {
      toast('No fue posible generar el PDF.', { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none';

  return (
    <section className="space-y-5">
      <form onSubmit={generate} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 space-y-3" noValidate>
        <div>
          <label htmlFor="rep-tour" className="block text-xs font-bold text-on-surface mb-1">Recorrido</label>
          <select id="rep-tour" value={tourId} onChange={(e) => { setTourId(e.target.value); setReport(null); }} className={inputCls}>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rep-from" className="block text-xs font-bold text-on-surface mb-1">Desde</label>
            <input id="rep-from" type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setReport(null); }} className={inputCls} />
          </div>
          <div>
            <label htmlFor="rep-to" className="block text-xs font-bold text-on-surface mb-1">Hasta</label>
            <input id="rep-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setReport(null); }} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-on-surface-variant">Rápido:</span>
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => { setFrom(daysAgo(p.days)); setTo(toDateInput(new Date())); setReport(null); }}
              className="px-2.5 py-1 rounded-full border border-outline-variant text-[11px] font-semibold text-primary hover:bg-surface-container"
            >
              Últimos {p.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs font-semibold text-error flex items-center gap-1"><Icon name="error" className="text-[16px]" />{error}</p>
        )}
        <button type="submit" className="w-full py-3 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2">
          <Icon name="query_stats" className="text-[18px]" /> Generar reporte
        </button>
      </form>

      {report && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <p className="text-xs text-on-surface-variant">
              {formatShortDate(report.from + 'T12:00:00')} – {formatShortDate(report.to + 'T12:00:00')}
            </p>
            <h2 className="font-serif text-xl font-bold text-primary leading-tight">{report.tour.title}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={report.reviewCount ? report.average.toFixed(2) : '—'} label="Promedio de valoración" icon="star" />
            <Stat value={String(report.reviewCount)} label="Valoraciones" icon="reviews" />
            <Stat value={String(report.visitCount)} label="Visitas registradas" icon="directions_walk" />
          </div>

          <div className="rounded-2xl border border-outline-variant/60 overflow-hidden">
            <table className="w-full text-xs">
              <caption className="sr-only">Detalle por punto de interés</caption>
              <thead className="bg-primary text-on-primary">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 font-bold">Punto de interés</th>
                  <th scope="col" className="text-right px-2 py-2 font-bold">Prom.</th>
                  <th scope="col" className="text-right px-2 py-2 font-bold">Valor.</th>
                  <th scope="col" className="text-right px-3 py-2 font-bold">Sellos</th>
                </tr>
              </thead>
              <tbody>
                {report.points.map((row, i) => (
                  <tr key={row.point.id} className={i % 2 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'}>
                    <td className="px-3 py-2 text-on-surface">{row.point.title}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.reviews ? row.average.toFixed(1) : '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.reviews}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.stamps}</td>
                  </tr>
                ))}
                {report.points.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-on-surface-variant">El recorrido no tiene puntos asociados.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={exportPdf} disabled={exporting} className="w-full py-3 rounded-full border-2 border-secondary text-secondary text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/5 disabled:opacity-60">
            <Icon name="picture_as_pdf" className="text-[18px]" /> {exporting ? 'Generando PDF…' : 'Exportar a PDF'}
          </button>
        </div>
      )}
    </section>
  );
};

const Stat: React.FC<{ value: string; label: string; icon: string }> = ({ value, label, icon }) => (
  <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 text-center">
    <Icon name={icon} className="text-secondary text-[20px]" />
    <p className="font-serif text-2xl font-bold text-primary leading-tight tabular-nums">{value}</p>
    <p className="text-[10px] text-on-surface-variant leading-tight">{label}</p>
  </div>
);
