import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentsApi, layersApi, shapesApi } from '@/lib/api';
import type { Layer, CanvasShape, ToolType, Document } from '@/types';
import { generateId } from '@/lib/utils';
import TakeoffHeader from './components/TakeoffHeader';
import TakeoffToolbar from './components/TakeoffToolbar';
import LayerPanel from './components/LayerPanel';
import TakeoffCanvas from './components/TakeoffCanvas';
import EstimatePanel from './components/EstimatePanel';
import { PageLoader } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export type ActiveTab = 'takeoff' | 'estimate';

export default function TakeoffPage() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('takeoff');
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [history, setHistory] = useState<CanvasShape[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState(1.0);
  const [unit, setUnit] = useState('ft');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.get(documentId!),
    enabled: !!documentId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!layers.length) return;
      setIsSaving(true);
      await Promise.all(
        layers.map((layer) => {
          const layerShapes = shapes.filter((s) => s.layerId === layer.id);
          return shapesApi.batchSave(layer.id, layerShapes.map((s) => ({
            type: s.type,
            data: s.data,
            label: s.label,
            color: s.color,
          })));
        })
      );
    },
    onSuccess: () => { toast.success('Saved', { duration: 1500 }); },
    onSettled: () => setIsSaving(false),
  });

  // Load layers + shapes from document
  useEffect(() => {
    if (!document) return;
    setScale(document.scale || 1.0);
    setUnit(document.unit || 'ft');

    const docLayers: Layer[] = document.layers || [];
    setLayers(docLayers);
    if (docLayers.length > 0 && !activeLayerId) {
      setActiveLayerId(docLayers[0].id);
    }

    const allShapes: CanvasShape[] = docLayers.flatMap((l) =>
      (l.shapes || []).map((s) => ({
        id: s.id,
        type: s.type,
        data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data,
        label: s.label || undefined,
        color: s.color || undefined,
        layerId: s.layerId,
      }))
    );
    setShapes(allShapes);
    setHistory([allShapes]);
    setHistoryIndex(0);
  }, [document]);

  // Auto-save debounced
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (historyIndex > 0) saveMutation.mutate();
    }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [shapes]);

  const pushHistory = useCallback((newShapes: CanvasShape[]) => {
    setShapes(newShapes);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newShapes].slice(-50);
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setShapes(history[newIdx]);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setShapes(history[newIdx]);
  }, [history, historyIndex]);

  const addShape = useCallback((shape: Omit<CanvasShape, 'id'>) => {
    const newShape: CanvasShape = { ...shape, id: generateId() };
    pushHistory([...shapes, newShape]);
  }, [shapes, pushHistory]);

  const updateShape = useCallback((id: string, updates: Partial<CanvasShape>) => {
    pushHistory(shapes.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, [shapes, pushHistory]);

  const deleteShape = useCallback((id: string) => {
    pushHistory(shapes.filter((s) => s.id !== id));
  }, [shapes, pushHistory]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers((prev) => prev.map((l) => l.id === layerId ? { ...l, visible: !l.visible } : l));
  }, []);

  const handleSave = () => saveMutation.mutate();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.metaKey || e.ctrlKey) && key === 's') { e.preventDefault(); handleSave(); return; }
      const toolMap: Record<string, ToolType> = { v: 'select', h: 'pan', r: 'rect', p: 'polygon', l: 'line', c: 'circle', m: 'calibrate' };
      if (toolMap[key]) setActiveTool(toolMap[key]);
      if (key === 'delete' || key === 'backspace') {
        // Delete handled in canvas
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  if (isLoading) return <PageLoader label="Loading document..." />;
  if (!document) return <div className="h-full flex items-center justify-center text-slate-400">Document not found</div>;

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const visibleShapes = shapes.filter((s) => {
    const layer = layers.find((l) => l.id === s.layerId);
    return layer?.visible !== false;
  });

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      <TakeoffHeader
        document={document}
        projectId={projectId!}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        isSaving={isSaving}
        scale={scale}
        unit={unit}
        onScaleChange={setScale}
        onUnitChange={setUnit}
        currentPage={currentPage}
        totalPages={document.pageCount}
        onPageChange={setCurrentPage}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      {activeTab === 'takeoff' ? (
        <div className="flex flex-1 overflow-hidden">
          <LayerPanel
            layers={layers}
            setLayers={setLayers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onToggleVisibility={toggleLayerVisibility}
            shapes={shapes}
            scale={scale}
            unit={unit}
            documentId={documentId!}
          />

          <div className="flex-1 relative overflow-hidden bg-[#1a1a2e]">
            <TakeoffCanvas
              documentUrl={document.fileUrl}
              activeTool={activeTool}
              activeLayerId={activeLayerId}
              activeLayerColor={activeLayer?.color || '#2563EB'}
              shapes={visibleShapes}
              allShapes={shapes}
              onAddShape={addShape}
              onUpdateShape={updateShape}
              onDeleteShape={deleteShape}
              scale={scale}
              unit={unit}
              onScaleChange={setScale}
              currentPage={currentPage}
            />
          </div>

          <TakeoffToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
          />
        </div>
      ) : (
        <EstimatePanel
          layers={layers}
          shapes={shapes}
          scale={scale}
          unit={unit}
          documentName={document.name}
        />
      )}
    </div>
  );
}
