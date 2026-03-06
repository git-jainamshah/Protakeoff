import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentsApi, shapesApi } from '@/lib/api';
import type { Layer, CanvasShape, ToolType, Document } from '@/types';
import { generateId, calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import TakeoffHeader from './components/TakeoffHeader';
import TakeoffToolbar from './components/TakeoffToolbar';
import LayerPanel from './components/LayerPanel';
import TakeoffCanvas from './components/TakeoffCanvas';
import EstimatePanel from './components/EstimatePanel';
import { PageLoader } from '@/components/ui/Spinner';
import { Undo2, Redo2, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export type ActiveTab = 'takeoff' | 'estimate';

// ─── Quick metrics helper ─────────────────────────────────────────────────────
function computeMetrics(shapes: CanvasShape[], layers: Layer[], scale: number, unit: string) {
  let totalArea = 0, totalLinear = 0, count = 0;
  shapes.forEach((s) => {
    const layer = layers.find((l) => l.id === s.layerId);
    if (!layer) return;
    count++;
    if (layer.type === 'AREA') {
      if (s.type === 'RECT') { const d = s.data as { width: number; height: number }; totalArea += Math.abs(d.width) * Math.abs(d.height); }
      if (s.type === 'POLYGON') { const d = s.data as { points: number[] }; totalArea += calcPolygonArea(d.points); }
    }
    if (layer.type === 'LINEAR' && s.type === 'LINE') {
      const d = s.data as { points: number[] }; totalLinear += calcLineLength(d.points);
    }
  });
  return {
    area: formatArea(totalArea, unit, scale),
    linear: formatLength(totalLinear, unit, scale),
    count,
  };
}

export default function TakeoffPage() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();

  const [activeTab,     setActiveTab]     = useState<ActiveTab>('takeoff');
  const [activeTool,    setActiveTool]    = useState<ToolType>('pan');
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [layers,        setLayers]        = useState<Layer[]>([]);
  const [shapes,        setShapes]        = useState<CanvasShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // History (refs — no stale closure issue)
  const historyRef      = useRef<CanvasShape[][]>([[]]);
  const historyIndexRef = useRef<number>(0);
  const [historyState,  setHistoryState]  = useState({ index: 0, length: 1 });

  const [scale,     setScale]    = useState(1.0);
  const [unit,      setUnit]     = useState('ft');
  const [isSaving,  setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.get(documentId!),
    enabled: !!documentId,
  });

  const saveMutation = useMutation({
    mutationFn: async (s: CanvasShape[]) => {
      if (!layers.length) return;
      setIsSaving(true);
      await Promise.all(
        layers.map((l) => {
          const ls = s.filter((x) => x.layerId === l.id);
          return shapesApi.batchSave(l.id, ls.map((x) => ({ type: x.type, data: x.data, label: x.label, color: x.color, page: x.page ?? 1 })));
        }),
      );
    },
    onSuccess: () => toast.success('Saved', { duration: 1500, id: 'autosave' }),
    onSettled: () => setIsSaving(false),
  });

  useEffect(() => {
    if (!document) return;
    setScale(document.scale || 1.0);
    setUnit(document.unit || 'ft');
    const docLayers = document.layers || [];
    setLayers(docLayers);
    if (docLayers.length > 0) setActiveLayerId((p) => p || docLayers[0].id);
    const all: CanvasShape[] = docLayers.flatMap((l) =>
      (l.shapes || []).map((s) => ({
        id: s.id, type: s.type,
        data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data,
        label: s.label || undefined, color: s.color || undefined,
        page: (s as { page?: number }).page ?? 1,
        layerId: s.layerId,
      })),
    );
    setShapes(all);
    historyRef.current = [all]; historyIndexRef.current = 0; setHistoryState({ index: 0, length: 1 });
  }, [document]);

  const triggerAutoSave = useCallback((latest: CanvasShape[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveMutation.mutate(latest), 3000);
  }, []); // eslint-disable-line

  const pushHistory = useCallback((newShapes: CanvasShape[]) => {
    const idx = historyIndexRef.current;
    const trimmed = historyRef.current.slice(0, idx + 1);
    trimmed.push(newShapes);
    if (trimmed.length > 50) trimmed.shift();
    historyRef.current = trimmed;
    const ni = trimmed.length - 1;
    historyIndexRef.current = ni;
    setShapes(newShapes);
    setHistoryState({ index: ni, length: trimmed.length });
    triggerAutoSave(newShapes);
  }, [triggerAutoSave]);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const ni = idx - 1;
    historyIndexRef.current = ni;
    setShapes(historyRef.current[ni]); setSelectedShapeId(null);
    setHistoryState({ index: ni, length: historyRef.current.length });
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const ni = idx + 1;
    historyIndexRef.current = ni;
    setShapes(historyRef.current[ni]); setSelectedShapeId(null);
    setHistoryState({ index: ni, length: historyRef.current.length });
  }, []);

  const addShape = useCallback((shape: Omit<CanvasShape, 'id'>) =>
    pushHistory([...historyRef.current[historyIndexRef.current], { ...shape, id: generateId(), page: currentPage }]), [pushHistory, currentPage]);

  const updateShape = useCallback((id: string, updates: Partial<CanvasShape>) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, ...updates } : s)), [pushHistory]);

  const deleteShape = useCallback((id: string) => {
    pushHistory(historyRef.current[historyIndexRef.current].filter((s) => s.id !== id));
    setSelectedShapeId((p) => p === id ? null : p);
  }, [pushHistory]);

  const renameShape = useCallback((id: string, label: string) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, label: label || undefined } : s)), [pushHistory]);

  const colorShape = useCallback((id: string, color: string) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, color } : s)), [pushHistory]);

  const deleteSelected = useCallback(() => { if (selectedShapeId) deleteShape(selectedShapeId); }, [selectedShapeId, deleteShape]);

  const handleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveMutation.mutate(historyRef.current[historyIndexRef.current]);
  }, [saveMutation]);

  const toggleLayerVisibility = useCallback((id: string) =>
    setLayers((p) => p.map((l) => l.id === id ? { ...l, visible: !l.visible } : l)), []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && (key === 'y')) { e.preventDefault(); redo(); return; }
      if (mod && key === 's') { e.preventDefault(); handleSave(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) { e.preventDefault(); deleteSelected(); return; }
      const toolMap: Record<string, ToolType> = {
        v: 'select', h: 'pan', r: 'rect', p: 'polygon', l: 'line',
        c: 'circle', m: 'calibrate', e: 'eraser', f: 'freeform', n: 'count',
        d: 'detect', t: 'text', a: 'freearea',
      };
      if (!mod && toolMap[key]) setActiveTool(toolMap[key]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo, handleSave, deleteSelected]);

  // Quick metrics
  const metrics = useMemo(
    () => computeMetrics(shapes, layers, scale, unit),
    [shapes, layers, scale, unit],
  );

  if (isLoading) return <PageLoader label="Loading document..." />;
  if (!document) return <div className="h-full flex items-center justify-center text-slate-500">Document not found</div>;

  const activeLayer   = layers.find((l) => l.id === activeLayerId);
  const visibleShapes = shapes.filter((s) =>
    (s.page ?? 1) === currentPage &&
    layers.find((l) => l.id === s.layerId)?.visible !== false
  );
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.length - 1;

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      <TakeoffHeader
        document={document} projectId={projectId!}
        activeTab={activeTab} onTabChange={setActiveTab}
        canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
        onSave={handleSave} isSaving={isSaving}
        scale={scale} unit={unit} onScaleChange={setScale} onUnitChange={setUnit}
        currentPage={currentPage} totalPages={document.pageCount}
        onPageChange={setCurrentPage}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      {activeTab === 'takeoff' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Layers panel */}
          <LayerPanel
            layers={layers} setLayers={setLayers}
            activeLayerId={activeLayerId} onSelectLayer={setActiveLayerId}
            onToggleVisibility={toggleLayerVisibility}
            shapes={shapes} scale={scale} unit={unit} documentId={documentId!}
          />

          {/* Canvas container — all overlays live here */}
          <div className="flex-1 relative overflow-hidden">
            <TakeoffCanvas
              documentUrl={document.fileUrl}
              activeTool={activeTool}
              activeLayerId={activeLayerId}
              activeLayerColor={activeLayer?.color || '#2563EB'}
              shapes={visibleShapes}
              selectedShapeId={selectedShapeId}
              onSelectShape={setSelectedShapeId}
              onAddShape={addShape}
              onUpdateShape={updateShape}
              onDeleteShape={deleteShape}
              onRenameShape={renameShape}
              onPageChange={setCurrentPage}
              scale={scale} unit={unit} onScaleChange={setScale}
              currentPage={currentPage}
              metrics={metrics}
            />

            {/* ── Floating bottom toolbar ── */}
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30">
              <TakeoffToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            </div>

            {/* ── Undo / Redo / Delete / Shape controls overlay ── */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
              {/* Base row: undo / redo / delete */}
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
                <button onClick={undo} disabled={!canUndo}
                  title="Undo (⌘Z)" className={cn('p-1.5 rounded-lg transition-colors', canUndo ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed')}>
                  <Undo2 className="w-4 h-4" />
                </button>
                <button onClick={redo} disabled={!canRedo}
                  title="Redo (⌘⇧Z)" className={cn('p-1.5 rounded-lg transition-colors', canRedo ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed')}>
                  <Redo2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <button onClick={deleteSelected} disabled={!selectedShapeId}
                  title="Delete selected (Del)" className={cn('p-1.5 rounded-lg transition-colors', selectedShapeId ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Shape controls row — only when a shape is selected */}
              {selectedShapeId && (() => {
                const sel = visibleShapes.find(s => s.id === selectedShapeId);
                const PRESETS = [
                  '#EF4444','#F97316','#EAB308','#22C55E','#14B8A6',
                  '#3B82F6','#6366F1','#8B5CF6','#EC4899','#64748B',
                ];
                return (
                  <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-2.5 py-2 shadow-sm">
                    {/* Rename label button */}
                    <button
                      onClick={() => {
                        const found = visibleShapes.find(s => s.id === selectedShapeId);
                        if (found) {
                          const newLabel = prompt('Label this element:', found.label || '');
                          if (newLabel !== null) renameShape(selectedShapeId, newLabel);
                        }
                      }}
                      title="Edit label (or click shape)"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-slate-200" />
                    {/* Color presets */}
                    <div className="flex items-center gap-1">
                      {PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => colorShape(selectedShapeId, c)}
                          title={c}
                          className={cn(
                            'w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 flex-shrink-0',
                            sel?.color === c ? 'border-slate-700 scale-125' : 'border-white shadow-sm',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      ) : (
        <EstimatePanel layers={layers} shapes={shapes} scale={scale} unit={unit} documentName={document.name} />
      )}
    </div>
  );
}
