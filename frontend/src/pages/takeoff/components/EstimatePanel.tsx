import { useState } from 'react';
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
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

function getRawValue(shapes: CanvasShape[], layer: Layer, scale: number): number {
  return shapes.filter((s) => s.layerId === layer.id).reduce((sum, s) => {
    if (layer.type === 'AREA') {
      if (s.type === 'RECT') {
        const d = s.data as { width: number; height: number };
        return sum + Math.abs(d.width) * Math.abs(d.height) / (scale * scale);
      }
      if (s.type === 'POLYGON') {
        const d = s.data as { points: number[] };
        return sum + calcPolygonArea(d.points) / (scale * scale);
      }
    }
    if (layer.type === 'LINEAR' && s.type === 'LINE') {
      const d = s.data as { points: number[] };
      return sum + calcLineLength(d.points) / scale;
    }
    return sum;
  }, 0);
}

export default function EstimatePanel({ layers, shapes, scale, unit, documentName }: Props) {
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});

  const rows: EstimateRow[] = layers.map((layer) => {
    const layerShapes = shapes.filter((s) => s.layerId === layer.id);
    const raw = getRawValue(shapes, layer, scale);
    const uPrice = unitPrices[layer.id] || 0;
    const total = raw * uPrice;

    let measure = '—';
    if (layer.type === 'COUNT') measure = `${layerShapes.length} qty`;
    else if (layer.type === 'AREA') measure = formatArea(raw * scale * scale, unit, scale);
    else if (layer.type === 'LINEAR') measure = formatLength(raw * scale, unit, scale);

    return {
      layerName: layer.name,
      layerType: layer.type,
      color: layer.color,
      count: layerShapes.length,
      totalMeasurement: measure,
      rawValue: raw,
      unitPrice: uPrice,
      total,
    };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  const exportCSV = () => {
    const header = ['Layer', 'Type', 'Count', 'Measurement', `Unit Price (${unit})`, 'Total Cost'];
    const csvRows = rows.map((r) => [
      r.layerName, r.layerType, r.count, r.totalMeasurement,
      r.unitPrice.toFixed(2), r.total.toFixed(2),
    ]);
    csvRows.push(['', '', '', '', 'Grand Total', grandTotal.toFixed(2)]);

    const csv = [header, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName.replace(/\s+/g, '-')}-estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-surface">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Cost Estimate</h2>
            <p className="text-sm text-slate-500 mt-0.5">{documentName} · Enter unit prices to calculate totals</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {shapes.length === 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">No measurements yet. Switch to the Take-off tab to draw shapes on the plan.</p>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Layer</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Measurement</th>
                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit Price ($)</th>
                <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-sm font-medium text-slate-200">{row.layerName}</span>
                      <span className="text-[10px] text-slate-600 bg-surface-card border border-surface-border rounded px-1.5 py-0.5">
                        {row.layerType}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-400">{row.count}</td>
                  <td className="p-4 text-sm text-slate-400 font-mono">{row.totalMeasurement}</td>
                  <td className="p-4">
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input pl-6 py-1.5 text-sm w-full font-mono"
                        placeholder="0.00"
                        value={unitPrices[layers[i]?.id] || ''}
                        onChange={(e) => setUnitPrices((prev) => ({
                          ...prev,
                          [layers[i].id]: parseFloat(e.target.value) || 0,
                        }))}
                      />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-semibold font-mono text-slate-200">
                      ${row.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-hover/30">
                <td colSpan={4} className="p-4 text-sm font-semibold text-slate-300 text-right">Grand Total</td>
                <td className="p-4 text-right">
                  <span className="text-lg font-bold text-brand-400 font-mono">
                    ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-slate-600 mt-4 text-center">
          * Estimates are calculated based on drawn measurements × unit prices. Scale calibration affects accuracy.
        </p>
      </div>
    </div>
  );
}
