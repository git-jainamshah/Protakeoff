import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import { layersApi } from '@/lib/api';
import type { Layer, CanvasShape } from '@/types';
import {
  Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronRight,
  Square, Spline, Minus, Circle, MoreVertical
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface Props {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  shapes: CanvasShape[];
  scale: number;
  unit: string;
  documentId: string;
}

const TYPE_COLORS = { AREA: 'text-green-400', LINEAR: 'text-blue-400', COUNT: 'text-yellow-400' };
const LAYER_COLORS = ['#EF4444', '#22C55E', '#EAB308', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6'];

function shapeIcon(type: string) {
  if (type === 'RECT') return <Square className="w-3 h-3" />;
  if (type === 'POLYGON') return <Spline className="w-3 h-3" />;
  if (type === 'LINE') return <Minus className="w-3 h-3" />;
  return <Circle className="w-3 h-3" />;
}

function getMeasurement(shape: CanvasShape, layer: Layer, scale: number, unit: string): string {
  if (layer.type === 'AREA') {
    if (shape.type === 'RECT') {
      const d = shape.data as { width: number; height: number };
      return formatArea(Math.abs(d.width) * Math.abs(d.height), unit, scale);
    }
    if (shape.type === 'POLYGON') {
      const d = shape.data as { points: number[] };
      return formatArea(calcPolygonArea(d.points), unit, scale);
    }
  }
  if (layer.type === 'LINEAR') {
    if (shape.type === 'LINE') {
      const d = shape.data as { points: number[] };
      return formatLength(calcLineLength(d.points), unit, scale);
    }
  }
  if (layer.type === 'COUNT') return 'qty';
  return '—';
}

function getLayerTotal(layer: Layer, shapes: CanvasShape[], scale: number, unit: string): string {
  const ls = shapes.filter((s) => s.layerId === layer.id);
  if (layer.type === 'COUNT') return `${ls.length} qty`;
  if (layer.type === 'AREA') {
    const total = ls.reduce((sum, s) => {
      if (s.type === 'RECT') {
        const d = s.data as { width: number; height: number };
        return sum + Math.abs(d.width) * Math.abs(d.height);
      }
      if (s.type === 'POLYGON') {
        const d = s.data as { points: number[] };
        return sum + calcPolygonArea(d.points);
      }
      return sum;
    }, 0);
    return formatArea(total, unit, scale);
  }
  if (layer.type === 'LINEAR') {
    const total = ls.reduce((sum, s) => {
      if (s.type === 'LINE') {
        const d = s.data as { points: number[] };
        return sum + calcLineLength(d.points);
      }
      return sum;
    }, 0);
    return formatLength(total, unit, scale);
  }
  return '—';
}

export default function LayerPanel({ layers, setLayers, activeLayerId, onSelectLayer, onToggleVisibility, shapes, scale, unit, documentId }: Props) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState(LAYER_COLORS[0]);
  const [newLayerType, setNewLayerType] = useState('AREA');

  const createMutation = useMutation({
    mutationFn: () => layersApi.create(documentId, { name: newLayerName, color: newLayerColor, type: newLayerType }),
    onSuccess: (layer) => {
      setLayers((prev) => [...prev, { ...layer, shapes: [] }]);
      onSelectLayer(layer.id);
      setAddOpen(false);
      setNewLayerName('');
      toast.success('Layer created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => layersApi.delete(id),
    onSuccess: (_, id) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      toast.success('Layer deleted');
    },
  });

  const toggleLayer = (layerId: string) => {
    setCollapsed((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  return (
    <div className="w-52 flex-shrink-0 flex flex-col bg-surface-sidebar border-r border-surface-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-border">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Layers</span>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-ghost p-1 rounded"
          title="Add layer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {layers.map((layer) => {
          const layerShapes = shapes.filter((s) => s.layerId === layer.id);
          const isActive = layer.id === activeLayerId;
          const isCollapsed = collapsed[layer.id];

          return (
            <div key={layer.id} className="group/layer">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors select-none',
                  isActive ? 'bg-brand-950/40 border-l-2 border-brand-500' : 'hover:bg-surface-hover border-l-2 border-transparent'
                )}
                onClick={() => onSelectLayer(layer.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLayer(layer.id); }}
                  className="text-slate-600 hover:text-slate-400 flex-shrink-0"
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: layer.color }}
                />

                <div className="flex-1 min-w-0">
                  <p className={cn('text-[11px] font-medium truncate leading-tight', isActive ? 'text-slate-100' : 'text-slate-400')}>
                    {layer.name}
                  </p>
                  <p className={cn('text-[10px] leading-none mt-0.5', TYPE_COLORS[layer.type as keyof typeof TYPE_COLORS] || 'text-slate-600')}>
                    {getLayerTotal(layer, shapes, scale, unit)}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover/layer:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-300"
                    title="Toggle visibility"
                  >
                    {layer.visible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete layer?')) deleteMutation.mutate(layer.id); }}
                    className="p-0.5 rounded text-slate-500 hover:text-red-400"
                    title="Delete layer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {!isCollapsed && layerShapes.length > 0 && (
                <div className="pl-6 pb-1">
                  {layerShapes.map((shape, idx) => (
                    <div
                      key={shape.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-600 hover:text-slate-400 hover:bg-surface-hover cursor-pointer transition-colors"
                    >
                      <span className="flex-shrink-0">{shapeIcon(shape.type)}</span>
                      <span className="flex-1 text-[10px] truncate">
                        {shape.label || `${shape.type.charAt(0) + shape.type.slice(1).toLowerCase()} ${idx + 1}`}
                      </span>
                      <span className="text-[9px] text-slate-700">
                        {getMeasurement(shape, layer, scale, unit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Layer Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Layer" size="sm">
        <div className="space-y-4">
          <Input
            label="Layer name"
            placeholder="Walls, Flooring, etc."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['AREA', 'LINEAR', 'COUNT'].map((t) => (
                <button key={t} onClick={() => setNewLayerType(t)}
                  className={cn('py-2 rounded-md text-xs font-medium border transition-colors',
                    newLayerType === t ? 'bg-brand-600 border-brand-600 text-white' : 'bg-surface-card border-surface-border text-slate-400 hover:border-slate-500'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {LAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewLayerColor(c)}
                  className={cn('w-6 h-6 rounded-md transition-transform', newLayerColor === c && 'scale-125 ring-2 ring-white/30')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!newLayerName.trim()}>
              Add Layer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
