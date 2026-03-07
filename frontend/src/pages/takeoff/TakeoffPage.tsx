import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    // Aggregate by shape geometry — not filtered by layer type
    if (s.type === 'RECT')    { const d = s.data as { width: number; height: number }; totalArea    += Math.abs(d.width) * Math.abs(d.height); }
    if (s.type === 'POLYGON') { const d = s.data as { points: number[] };               totalArea    += calcPolygonArea(d.points); }
    if (s.type === 'CIRCLE')  { const d = s.data as { radius: number };                 totalArea    += Math.PI * d.radius * d.radius; }
    if (s.type === 'LINE')    { const d = s.data as { points: number[] };               totalLinear  += calcLineLength(d.points); }
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
  const queryClient = useQueryClient();

  const [activeTab,     setActiveTab]     = useState<ActiveTab>('takeoff');
  const [activeTool,    setActiveTool]    = useState<ToolType>('pan');
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [layers,        setLayers]        = useState<Layer[]>([]);
  const [shapes,        setShapes]        = useState<CanvasShape[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Derived: single-selection ID (null when 0 or multiple selected)
  const selectedShapeId = selectedIds.length === 1 ? selectedIds[0] : null;

  // History (refs — no stale closure issue)
  const historyRef      = useRef<CanvasShape[][]>([[]]);
  const historyIndexRef = useRef<number>(0);
  const [historyState,  setHistoryState]  = useState({ index: 0, length: 1 });

  const [scale,     setScale]    = useState(1.0);
  const [unit,      setUnit]     = useState('ft');
  const [isSaving,  setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on click-outside
  // NOTE: use window.document here — "document" is shadowed by the React Query PDF document result
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handler);
    return () => window.document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen]);

  // Close picker when selection changes
  useEffect(() => { setColorPickerOpen(false); }, [selectedIds]);

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

  // Persists scale/unit changes to the database immediately
  const saveDocSettingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDocSettings = useCallback((newScale: number, newUnit: string) => {
    if (!documentId) return;
    if (saveDocSettingsTimer.current) clearTimeout(saveDocSettingsTimer.current);
    saveDocSettingsTimer.current = setTimeout(() => {
      documentsApi.update(documentId, { scale: newScale, unit: newUnit })
        .then(() => queryClient.invalidateQueries({ queryKey: ['document', documentId] }))
        .catch(() => {}); // silent — scale/unit are already updated in local state
    }, 600);
  }, [documentId, queryClient]);

  const handleScaleChange = useCallback((newScale: number) => {
    setScale(newScale);
    saveDocSettings(newScale, unit);
  }, [unit, saveDocSettings]);

  const handleUnitChange = useCallback((newUnit: string) => {
    setUnit(newUnit);
    saveDocSettings(scale, newUnit);
  }, [scale, saveDocSettings]);

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
    setShapes(historyRef.current[ni]); setSelectedIds([]);
    setHistoryState({ index: ni, length: historyRef.current.length });
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const ni = idx + 1;
    historyIndexRef.current = ni;
    setShapes(historyRef.current[ni]); setSelectedIds([]);
    setHistoryState({ index: ni, length: historyRef.current.length });
  }, []);

  const addShape = useCallback((shape: Omit<CanvasShape, 'id'>) =>
    pushHistory([...historyRef.current[historyIndexRef.current], { ...shape, id: generateId(), page: currentPage }]), [pushHistory, currentPage]);

  const updateShape = useCallback((id: string, updates: Partial<CanvasShape>) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, ...updates } : s)), [pushHistory]);

  const deleteShape = useCallback((id: string) => {
    pushHistory(historyRef.current[historyIndexRef.current].filter((s) => s.id !== id));
    setSelectedIds((p) => p.filter(x => x !== id));
  }, [pushHistory]);

  const renameShape = useCallback((id: string, label: string) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, label: label || undefined } : s)), [pushHistory]);

  const colorShape = useCallback((id: string, color: string) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) => s.id === id ? { ...s, color } : s)), [pushHistory]);

  // Applies a color to ALL currently selected shapes in one history push
  const colorSelectedShapes = useCallback((color: string) =>
    pushHistory(historyRef.current[historyIndexRef.current].map((s) =>
      selectedIds.includes(s.id) ? { ...s, color } : s)), [pushHistory, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    pushHistory(historyRef.current[historyIndexRef.current].filter((s) => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  }, [selectedIds, pushHistory]);

  const handleSelectShape = useCallback((id: string | null, additive?: boolean) => {
    if (!id) { setSelectedIds([]); return; }
    if (additive) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  }, []);

  const handleSelectMany = useCallback((ids: string[]) => setSelectedIds(ids), []);

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
        scale={scale} unit={unit} onScaleChange={handleScaleChange} onUnitChange={handleUnitChange}
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
            onNavigateToPage={setCurrentPage}
          />

          {/* Canvas container — all overlays live here */}
          <div className="flex-1 relative overflow-hidden">
            <TakeoffCanvas
              documentUrl={document.fileUrl}
              activeTool={activeTool}
              activeLayerId={activeLayerId}
              activeLayerColor={activeLayer?.color || '#2563EB'}
              shapes={visibleShapes}
              selectedShapeIds={selectedIds}
              onSelectShape={handleSelectShape}
              onSelectMany={handleSelectMany}
              onAddShape={addShape}
              onUpdateShape={updateShape}
              onDeleteShape={deleteShape}
              onRenameShape={renameShape}
              onPageChange={setCurrentPage}
              scale={scale} unit={unit} onScaleChange={handleScaleChange}
              currentPage={currentPage}
              metrics={metrics}
            />

            {/* ── Floating bottom toolbar ── */}
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30">
              <TakeoffToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            </div>

            {/* ── Undo / Redo / Delete / Shape controls overlay ── */}
            {(() => {
              const PRESETS = ['#EF4444','#F97316','#EAB308','#22C55E','#14B8A6','#3B82F6','#6366F1','#8B5CF6','#EC4899','#64748B'];
              const sel = selectedShapeId ? visibleShapes.find(s => s.id === selectedShapeId) : null;
              const currentColor = sel?.color || '#3B82F6';
              const hasSelection = selectedIds.length > 0;
              const multiSelect = selectedIds.length > 1;
              return (
                <div className="absolute top-3 left-3 z-40 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
                  <button onClick={undo} disabled={!canUndo}
                    title="Undo (⌘Z)" className={cn('p-1.5 rounded-lg transition-colors', canUndo ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed')}>
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button onClick={redo} disabled={!canRedo}
                    title="Redo (⌘⇧Z)" className={cn('p-1.5 rounded-lg transition-colors', canRedo ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed')}>
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  <button onClick={deleteSelected} disabled={!hasSelection}
                    title="Delete selected (Del)" className={cn('p-1.5 rounded-lg transition-colors', hasSelection ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed')}>
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {hasSelection && (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-0.5" />

                      {/* Selection count badge */}
                      {multiSelect && (
                        <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg">
                          {selectedIds.length} selected
                        </span>
                      )}

                      {/* Rename (single-select only) */}
                      {!multiSelect && (
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('pt:rename-selected'))}
                          title="Label element (double-click element)"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Color dot → popup (works for single and multi) */}
                      <div className="relative" ref={colorPickerRef}>
                        <button
                          onClick={() => setColorPickerOpen(o => !o)}
                          title="Change colour"
                          className={cn('p-1 rounded-lg transition-colors hover:bg-slate-100', colorPickerOpen && 'bg-slate-100')}
                        >
                          <div className="w-5 h-5 rounded-full border-2 border-white shadow"
                            style={{ backgroundColor: multiSelect ? '#6366F1' : currentColor }} />
                        </button>
                        {colorPickerOpen && (
                          <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl" style={{ width: 168 }}>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 text-center">
                              {multiSelect ? `${selectedIds.length} Elements` : 'Element Colour'}
                            </p>
                            <div className="grid grid-cols-5 gap-2">
                              {PRESETS.map(c => (
                                <button key={c}
                                  onClick={() => { colorSelectedShapes(c); setColorPickerOpen(false); }}
                                  title={c}
                                  className={cn('w-6 h-6 rounded-full transition-all',
                                    !multiSelect && currentColor === c
                                      ? 'ring-2 ring-offset-2 ring-slate-800'
                                      : 'hover:ring-2 hover:ring-offset-1 hover:ring-slate-400')}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      ) : (
        <EstimatePanel layers={layers} shapes={shapes} scale={scale} unit={unit} documentName={document.name} documentId={documentId!} />
      )}
    </div>
  );
}
