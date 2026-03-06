import { useState } from 'react';
import { Download, FileSpreadsheet, AlertCircle, Calculator } from 'lucide-react';
import type { Layer, CanvasShape } from '@/types';
import { calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface Props {
  layers: Layer[];
  shapes: CanvasShape[];
  scale: number;
  unit: string;
  documentName: string;
}

interface EstimateRow {
  layerName: string;
  layerType: string;
  color: string;
  count: number;
  totalMeasurement: string;
  rawValue: number;
  unitPrice: number;
  total: number;
}

function getRawValue(shapes: CanvasShape[], layer: Layer, scale: number) {
  return shapes.filter((s) => s.layerId === layer.id).reduce((sum, s) => {
    if (layer.type === 'AREA') {
      if (s.type === 'RECT') { const d = s.data as { width: number; height: number }; return sum + Math.abs(d.width) * Math.abs(d.height) / (scale * scale); }
      if (s.type === 'POLYGON') { const d = s.data as { points: number[] }; return sum + calcPolygonArea(d.points) / (scale * scale); }
    }
    if (layer.type === 'LINEAR' && s.type === 'LINE') { const d = s.data as { points: number[] }; return sum + calcLineLength(d.points) / scale; }
    return sum;
  }, 0);
}

export default function EstimatePanel({ layers, shapes, scale, unit, documentName }: Props) {
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});

  const rows: EstimateRow[] = layers.map((layer) => {
    const ls   = shapes.filter((s) => s.layerId === layer.id);
    const raw  = getRawValue(shapes, layer, scale);
    const uPrice = unitPrices[layer.id] || 0;
    const total  = raw * uPrice;
    let measure = '—';
    if (layer.type === 'COUNT')  measure = `${ls.length} qty`;
    else if (layer.type === 'AREA')   measure = formatArea(raw * scale * scale, unit, scale);
    else if (layer.type === 'LINEAR') measure = formatLength(raw * scale, unit, scale);
    return { layerName: layer.name, layerType: layer.type, color: layer.color, count: ls.length, totalMeasurement: measure, rawValue: raw, unitPrice: uPrice, total };
  });

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const exportCSV = () => {
    const header = ['Layer', 'Type', 'Count', 'Measurement', `Unit Price (${unit})`, 'Total Cost'];
    const csvRows = rows.map((r) => [r.layerName, r.layerType, r.count, r.totalMeasurement, r.unitPrice.toFixed(2), r.total.toFixed(2)]);
    csvRows.push(['', '', '', '', 'Grand Total', grandTotal.toFixed(2)]);
    const csv = [header, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${documentName.replace(/\s+/g, '-')}-estimate.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-surface">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cost Estimate</h2>
              <p className="text-sm text-slate-500 mt-0.5">{documentName} · Enter unit prices to calculate totals</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button size="sm">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </div>
        </div>

        {shapes.length === 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              No measurements yet. Switch to the <strong>Take-off</strong> tab to draw shapes on the plan.
            </p>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Layers', value: layers.length.toString() },
            { label: 'Total Shapes', value: shapes.length.toString() },
            { label: 'Estimated Total', value: `$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Layer</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Measurement</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit Price ($)</th>
                <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-sm font-semibold text-slate-800">{row.layerName}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 font-medium">
                        {row.layerType}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">{row.count}</td>
                  <td className="p-4 text-sm text-slate-600 font-mono">{row.totalMeasurement}</td>
                  <td className="p-4">
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        className="input pl-7 py-1.5 text-sm w-full font-mono"
                        placeholder="0.00"
                        value={unitPrices[layers[i]?.id] || ''}
                        onChange={(e) => setUnitPrices((prev) => ({
                          ...prev, [layers[i].id]: parseFloat(e.target.value) || 0,
                        }))}
                      />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-bold font-mono text-slate-800">
                      ${row.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-brand-50">
                <td colSpan={4} className="p-4 text-sm font-semibold text-slate-700 text-right">
                  Grand Total
                </td>
                <td className="p-4 text-right">
                  <span className="text-xl font-bold text-brand-700 font-mono">
                    ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Estimates are based on drawn measurements × unit prices. Use Calibrate Scale for best accuracy.
        </p>
      </div>
    </div>
  );
}
