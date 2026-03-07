import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cn, calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import { layersApi } from '@/lib/api';
import type { Layer, CanvasShape } from '@/types';
import {
  Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronRight,
  Square, Spline, Minus, Circle, PanelLeftClose, PanelLeftOpen, Layers, Check, X,
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
  onNavigateToPage: (page: number) => void;
}

const TYPE_CHIP: Record<string, string> = {
  AREA:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  LINEAR: 'bg-blue-50 text-blue-700 border-blue-200',
  COUNT:  'bg-amber-50 text-amber-700 border-amber-200',
};

const LAYER_COLORS = [
  '#EF4444','#22C55E','#EAB308','#3B82F6',
  '#8B5CF6','#EC4899','#F97316','#14B8A6',
];

function shapeIcon(type: string) {
  if (type === 'RECT')    return <Square className="w-3 h-3" />;
  if (type === 'POLYGON') return <Spline className="w-3 h-3" />;
  if (type === 'LINE')    return <Minus className="w-3 h-3" />;
  return <Circle className="w-3 h-3" />;
}

// Shape measurement based on shape geometry — independent of which layer type it's in
function getMeasurement(shape: CanvasShape, _layer: Layer, scale: number, unit: string) {
  if (shape.type === 'RECT')    { const d = shape.data as { width: number; height: number }; return formatArea(Math.abs(d.width) * Math.abs(d.height), unit, scale); }
  if (shape.type === 'POLYGON') { const d = shape.data as { points: number[] };               return formatArea(calcPolygonArea(d.points), unit, scale); }
  if (shape.type === 'CIRCLE')  { const d = shape.data as { radius: number };                 return formatArea(Math.PI * d.radius * d.radius, unit, scale); }
  if (shape.type === 'LINE')    { const d = shape.data as { points: number[] };               return formatLength(calcLineLength(d.points), unit, scale); }
  return '—';
}

// Layer total aggregates all shape geometries regardless of layer type
function getLayerTotal(layer: Layer, shapes: CanvasShape[], scale: number, unit: string) {
  const ls = shapes.filter((s) => s.layerId === layer.id);
  if (layer.type === 'COUNT') return `${ls.length} qty`;

  let area = 0, length = 0;
  ls.forEach((s) => {
    if (s.type === 'RECT')    { const d = s.data as { width: number; height: number }; area   += Math.abs(d.width) * Math.abs(d.height); }
    if (s.type === 'POLYGON') { const d = s.data as { points: number[] };               area   += calcPolygonArea(d.points); }
    if (s.type === 'CIRCLE')  { const d = s.data as { radius: number };                 area   += Math.PI * d.radius * d.radius; }
    if (s.type === 'LINE')    { const d = s.data as { points: number[] };               length += calcLineLength(d.points); }
  });

  const parts: string[] = [];
  if (area > 0)   parts.push(formatArea(area, unit, scale));
  if (length > 0) parts.push(formatLength(length, unit, scale));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export default function LayerPanel({
  layers, setLayers, activeLayerId, onSelectLayer, onToggleVisibility, shapes, scale, unit, documentId, onNavigateToPage,
}: Props) {
  const [panelOpen, setPanelOpen]     = useState(true);
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen]         = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState(LAYER_COLORS[0]);
  const [newLayerType, setNewLayerType]   = useState('AREA');
  // Layer renaming
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => layersApi.update(id, { name }),
    onSuccess: (_, { id, name }) => {
      setLayers((prev) => prev.map((l) => l.id === id ? { ...l, name } : l));
      setRenamingLayerId(null);
    },
  });

  const commitRename = () => {
    if (!renamingLayerId || !renameValue.trim()) { setRenamingLayerId(null); return; }
    renameMutation.mutate({ id: renamingLayerId, name: renameValue.trim() });
  };

  // ── Collapsed view — narrow icon strip ───────────────────────────────────────
  if (!panelOpen) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col items-center bg-white border-r border-slate-200 py-2 gap-1">
        <button
          onClick={() => setPanelOpen(true)}
          title="Expand layers"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="w-px h-3 bg-slate-200 mx-auto my-0.5" />
        {/* Layer color dots */}
        {layers.map((l) => (
          <button
            key={l.id}
            onClick={() => { setPanelOpen(true); onSelectLayer(l.id); }}
            title={l.name}
            className={cn(
              'w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110',
              l.id === activeLayerId ? 'border-slate-600 scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: l.color }}
          />
        ))}
        <button
          onClick={() => { setPanelOpen(true); setAddOpen(true); }}
          title="Add layer"
          className="mt-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Layers</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setAddOpen(true)}
            className="btn-ghost p-1 rounded-lg" title="Add layer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="btn-ghost p-1 rounded-lg" title="Collapse panel"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto py-1">
        {layers.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6 px-3">
            No layers yet. Click + to add one.
          </p>
        )}
        {layers.map((layer) => {
          const layerShapes  = shapes.filter((s) => s.layerId === layer.id);
          const isActive     = layer.id === activeLayerId;
          const isCollapsed  = collapsed[layer.id];
          const isVisible    = layer.visible !== false;

          return (
            <div key={layer.id} className="group/layer">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-colors select-none border-l-2',
                  isActive
                    ? 'bg-brand-50 border-brand-500'
                    : 'hover:bg-slate-50 border-transparent',
                )}
                onClick={() => onSelectLayer(layer.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setCollapsed((p) => ({ ...p, [layer.id]: !p[layer.id] })); }}
                  className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: layer.color }} />

                <div className="flex-1 min-w-0" onDoubleClick={(e) => { e.stopPropagation(); setRenamingLayerId(layer.id); setRenameValue(layer.name); setTimeout(() => renameInputRef.current?.focus(), 50); }}>
                  {renamingLayerId === layer.id ? (
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        maxLength={40}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingLayerId(null); }}
                        onBlur={commitRename}
                        className="flex-1 text-xs font-semibold border border-brand-400 rounded px-1 py-0.5 focus:outline-none bg-white min-w-0"
                      />
                      <button onMouseDown={commitRename} className="p-0.5 text-emerald-600"><Check className="w-3 h-3" /></button>
                      <button onMouseDown={() => setRenamingLayerId(null)} className="p-0.5 text-slate-400"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <p className={cn('text-xs font-semibold truncate', isActive ? 'text-brand-700' : 'text-slate-700')} title="Double-click to rename">
                      {layer.name}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('text-[9px] font-semibold border rounded px-1 py-px', TYPE_CHIP[layer.type] || 'bg-slate-50 text-slate-500 border-slate-200')}>
                      {layer.type}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate font-medium">
                      {getLayerTotal(layer, shapes, scale, unit)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover/layer:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                    className={cn('p-0.5 rounded hover:text-slate-600', isVisible ? 'text-slate-400' : 'text-slate-300')}
                  >
                    {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete layer?')) deleteMutation.mutate(layer.id); }}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {!isCollapsed && layerShapes.length > 0 && (
                <div className="pl-8 pb-1 border-l-2 border-transparent ml-2">
                  {layerShapes.map((shape, idx) => {
                    const shapePage = (shape as { page?: number }).page ?? 1;
                    return (
                      <div key={shape.id}
                        onClick={() => onNavigateToPage(shapePage)}
                        title={`Page ${shapePage} — click to navigate`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                        <span className="flex-shrink-0 text-slate-400">{shapeIcon(shape.type)}</span>
                        <span className="flex-1 text-[10px] truncate">
                          {shape.label || `${shape.type.charAt(0) + shape.type.slice(1).toLowerCase()} ${idx + 1}`}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono flex-shrink-0">
                          {getMeasurement(shape, layer, scale, unit)}
                        </span>
                        <span className="text-[9px] font-bold bg-slate-100 text-slate-500 rounded px-1 flex-shrink-0">
                          p.{shapePage}
                        </span>
                      </div>
                    );
                  })}
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['AREA', 'LINEAR', 'COUNT'].map((t) => (
                <button key={t} onClick={() => setNewLayerType(t)}
                  className={cn('py-2 rounded-lg text-sm font-semibold border transition-colors',
                    newLayerType === t
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {LAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewLayerColor(c)}
                  className={cn('w-7 h-7 rounded-lg transition-transform border-2',
                    newLayerColor === c ? 'scale-125 border-slate-600' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={createMutation.isPending}
              onClick={() => createMutation.mutate()} disabled={!newLayerName.trim()}>
              Add Layer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
