import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Group, Text, RegularPolygon } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as pdfjsLib from 'pdfjs-dist';
import type { CanvasShape, ToolType, RectData, PolygonData, LineData, CircleData } from '@/types';
import { generateId, calcPolygonCentroid, calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
  documentUrl: string;
  activeTool: ToolType;
  activeLayerId: string | null;
  activeLayerColor: string;
  shapes: CanvasShape[];
  allShapes: CanvasShape[];
  onAddShape: (shape: Omit<CanvasShape, 'id'>) => void;
  onUpdateShape: (id: string, updates: Partial<CanvasShape>) => void;
  onDeleteShape: (id: string) => void;
  scale: number;
  unit: string;
  onScaleChange: (s: number) => void;
  currentPage: number;
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    obs.observe(el);
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => obs.disconnect();
  }, [ref]);
  return size;
}

function usePdfPage(url: string, pageNum: number) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const load = async () => {
      try {
        const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
        const pdf = await pdfjsLib.getDocument(fullUrl).promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          const dataUrl = canvas.toDataURL('image/png');
          const img = new window.Image();
          img.onload = () => {
            if (!cancelled) {
              setImgEl(img);
              setDims({ width: viewport.width, height: viewport.height });
            }
          };
          img.src = dataUrl;
        }
      } catch (err) {
        console.error('PDF load error:', err);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [url, pageNum]);

  return { imgEl, dims };
}

function ShapeRenderer({
  shape, color, isSelected, scale, unit,
  onSelect, onDelete,
}: {
  shape: CanvasShape;
  color: string;
  isSelected: boolean;
  scale: number;
  unit: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const fill = color + '33';
  const stroke = color;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') onDelete(shape.id);
  };

  if (shape.type === 'RECT') {
    const d = shape.data as RectData;
    const area = formatArea(Math.abs(d.width) * Math.abs(d.height), unit, scale);
    return (
      <Group onClick={() => onSelect(shape.id)}>
        <Rect
          x={d.x} y={d.y} width={d.width} height={d.height}
          fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5}
          dash={isSelected ? [6, 3] : undefined}
          draggable={false}
        />
        <Text
          x={d.x + d.width / 2 - 40} y={d.y + d.height / 2 - 8}
          text={shape.label || area} fontSize={11} fill={stroke}
          fontStyle="500" align="center" width={80}
        />
      </Group>
    );
  }

  if (shape.type === 'POLYGON') {
    const d = shape.data as PolygonData;
    if (d.points.length < 6) return null;
    const area = formatArea(calcPolygonArea(d.points), unit, scale);
    const center = calcPolygonCentroid(d.points);
    return (
      <Group onClick={() => onSelect(shape.id)}>
        <Line
          points={d.points} closed={true}
          fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5}
          dash={isSelected ? [6, 3] : undefined}
        />
        <Text
          x={center.x - 40} y={center.y - 8}
          text={shape.label || area} fontSize={11} fill={stroke}
          fontStyle="500" align="center" width={80}
        />
      </Group>
    );
  }

  if (shape.type === 'LINE') {
    const d = shape.data as LineData;
    const len = formatLength(calcLineLength(d.points), unit, scale);
    const midX = (d.points[0] + d.points[2]) / 2;
    const midY = (d.points[1] + d.points[3]) / 2;
    return (
      <Group onClick={() => onSelect(shape.id)}>
        <Line
          points={d.points} stroke={stroke} strokeWidth={isSelected ? 3 : 2}
          dash={[8, 4]}
        />
        {/* End markers */}
        <Circle x={d.points[0]} y={d.points[1]} radius={3} fill={stroke} />
        <Circle x={d.points[2]} y={d.points[3]} radius={3} fill={stroke} />
        <Text
          x={midX - 35} y={midY - 16}
          text={shape.label || len} fontSize={11} fill={stroke}
          fontStyle="500" align="center" width={70}
          padding={2}
        />
      </Group>
    );
  }

  if (shape.type === 'CIRCLE') {
    const d = shape.data as CircleData;
    const area = formatArea(Math.PI * d.radius * d.radius, unit, scale);
    return (
      <Group onClick={() => onSelect(shape.id)}>
        <Circle
          x={d.x} y={d.y} radius={d.radius}
          fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5}
          dash={isSelected ? [6, 3] : undefined}
        />
        <Text
          x={d.x - 40} y={d.y - 8}
          text={shape.label || area} fontSize={11} fill={stroke}
          fontStyle="500" align="center" width={80}
        />
      </Group>
    );
  }

  return null;
}

export default function TakeoffCanvas({
  documentUrl, activeTool, activeLayerId, activeLayerColor,
  shapes, onAddShape, onUpdateShape, onDeleteShape,
  scale, unit, onScaleChange, currentPage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerSize = useContainerSize(containerRef as React.RefObject<HTMLDivElement>);
  const { imgEl, dims } = usePdfPage(documentUrl, currentPage);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<RectData | null>(null);
  const [currentLine, setCurrentLine] = useState<LineData | null>(null);
  const [currentCircle, setCurrentCircle] = useState<CircleData | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Scale calibration
  const [calibPoints, setCalibPoints] = useState<number[]>([]);
  const [calibModalOpen, setCalibModalOpen] = useState(false);
  const [calibDistance, setCalibDistance] = useState('');

  // Fit PDF to canvas on load
  useEffect(() => {
    if (!dims.width || !containerSize.width) return;
    const fitScale = Math.min(
      (containerSize.width - 80) / dims.width,
      (containerSize.height - 80) / dims.height
    ) * 0.9;
    setStageScale(fitScale);
    setStagePos({
      x: (containerSize.width - dims.width * fitScale) / 2,
      y: (containerSize.height - dims.height * fitScale) / 2,
    });
  }, [dims.width, dims.height, containerSize.width, containerSize.height]);

  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition()!;
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const scaleBy = 1.12;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped = Math.max(0.05, Math.min(10, newScale));
    const newPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    stage.scale({ x: clamped, y: clamped });
    stage.position(newPos);
    setStageScale(clamped);
    setStagePos(newPos);
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'pan') return;
    if (activeTool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }

    const pos = getPointerPos();

    if (activeTool === 'polygon') {
      setPolygonPoints((prev) => [...prev, pos.x, pos.y]);
      return;
    }

    if (activeTool === 'calibrate') {
      setCalibPoints((prev) => {
        const next = [...prev, pos.x, pos.y];
        if (next.length === 4) {
          setCalibModalOpen(true);
          return next;
        }
        return next;
      });
      return;
    }

    setIsDrawing(true);
    setDrawStart(pos);

    if (activeTool === 'rect') setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    if (activeTool === 'line') setCurrentLine({ points: [pos.x, pos.y, pos.x, pos.y] });
    if (activeTool === 'circle') setCurrentCircle({ x: pos.x, y: pos.y, radius: 0 });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = getPointerPos();
    setMousePos(pos);

    if (!isDrawing) return;

    if (activeTool === 'rect' && currentRect) {
      setCurrentRect({ x: drawStart.x, y: drawStart.y, width: pos.x - drawStart.x, height: pos.y - drawStart.y });
    }
    if (activeTool === 'line' && currentLine) {
      setCurrentLine({ points: [drawStart.x, drawStart.y, pos.x, pos.y] });
    }
    if (activeTool === 'circle' && currentCircle) {
      const dx = pos.x - drawStart.x;
      const dy = pos.y - drawStart.y;
      setCurrentCircle({ x: drawStart.x, y: drawStart.y, radius: Math.sqrt(dx * dx + dy * dy) });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !activeLayerId) { setIsDrawing(false); return; }

    const MIN_SIZE = 5;

    if (activeTool === 'rect' && currentRect) {
      if (Math.abs(currentRect.width) > MIN_SIZE && Math.abs(currentRect.height) > MIN_SIZE) {
        onAddShape({ type: 'RECT', data: currentRect, layerId: activeLayerId, color: activeLayerColor });
      }
      setCurrentRect(null);
    }

    if (activeTool === 'line' && currentLine) {
      const len = calcLineLength(currentLine.points);
      if (len > MIN_SIZE) {
        onAddShape({ type: 'LINE', data: currentLine, layerId: activeLayerId, color: activeLayerColor });
      }
      setCurrentLine(null);
    }

    if (activeTool === 'circle' && currentCircle) {
      if (currentCircle.radius > MIN_SIZE) {
        onAddShape({ type: 'CIRCLE', data: currentCircle, layerId: activeLayerId, color: activeLayerColor });
      }
      setCurrentCircle(null);
    }

    setIsDrawing(false);
  };

  const handleDblClick = () => {
    if (activeTool === 'polygon' && polygonPoints.length >= 6 && activeLayerId) {
      onAddShape({ type: 'POLYGON', data: { points: polygonPoints }, layerId: activeLayerId, color: activeLayerColor });
      setPolygonPoints([]);
    }
  };

  const handleCalibrate = () => {
    const dist = parseFloat(calibDistance);
    if (!dist || dist <= 0 || calibPoints.length < 4) return;

    const px = Math.sqrt(
      Math.pow(calibPoints[2] - calibPoints[0], 2) +
      Math.pow(calibPoints[3] - calibPoints[1], 2)
    );
    onScaleChange(px / dist);
    setCalibPoints([]);
    setCalibModalOpen(false);
    setCalibDistance('');
  };

  const cursor = activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';

  const zoomPercent = Math.round(stageScale * 100);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ cursor }}>
      {/* Zoom indicator */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-surface-sidebar/90 backdrop-blur-sm border border-surface-border rounded-lg px-3 py-1.5">
        <button onClick={() => {
          const ns = Math.max(0.05, stageScale / 1.2);
          stageRef.current?.scale({ x: ns, y: ns });
          setStageScale(ns);
        }} className="text-slate-500 hover:text-slate-300 text-sm font-mono">−</button>
        <span className="text-xs text-slate-400 w-10 text-center font-mono">{zoomPercent}%</span>
        <button onClick={() => {
          const ns = Math.min(10, stageScale * 1.2);
          stageRef.current?.scale({ x: ns, y: ns });
          setStageScale(ns);
        }} className="text-slate-500 hover:text-slate-300 text-sm font-mono">+</button>
      </div>

      {/* Polygon in-progress hint */}
      {activeTool === 'polygon' && polygonPoints.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
          {polygonPoints.length / 2} points — double-click to close
        </div>
      )}

      {/* Calibrate hint */}
      {activeTool === 'calibrate' && calibPoints.length < 4 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
          Click {calibPoints.length === 0 ? 'start' : 'end'} point of known distance
        </div>
      )}

      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={activeTool === 'pan'}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        onDragEnd={(e) => {
          const stage = e.target as Konva.Stage;
          setStagePos({ x: stage.x(), y: stage.y() });
        }}
      >
        {/* PDF Background Layer */}
        <Layer>
          {imgEl && dims.width && (
            <KonvaImage
              image={imgEl}
              x={0} y={0}
              width={dims.width}
              height={dims.height}
            />
          )}
          {!imgEl && (
            <Rect x={0} y={0} width={dims.width || 800} height={dims.height || 600} fill="#1a1a2e" />
          )}
        </Layer>

        {/* Shapes Layer */}
        <Layer>
          {shapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              color={shape.color || activeLayerColor}
              isSelected={selectedId === shape.id}
              scale={scale}
              unit={unit}
              onSelect={setSelectedId}
              onDelete={onDeleteShape}
            />
          ))}

          {/* In-progress shapes */}
          {currentRect && (
            <Rect
              x={currentRect.x} y={currentRect.y}
              width={currentRect.width} height={currentRect.height}
              fill={activeLayerColor + '22'}
              stroke={activeLayerColor}
              strokeWidth={1.5}
              dash={[6, 3]}
            />
          )}

          {currentLine && (
            <Line
              points={currentLine.points}
              stroke={activeLayerColor} strokeWidth={2} dash={[8, 4]}
            />
          )}

          {currentCircle && currentCircle.radius > 0 && (
            <Circle
              x={currentCircle.x} y={currentCircle.y}
              radius={currentCircle.radius}
              fill={activeLayerColor + '22'}
              stroke={activeLayerColor}
              strokeWidth={1.5}
              dash={[6, 3]}
            />
          )}

          {/* Polygon in-progress */}
          {polygonPoints.length >= 2 && (
            <>
              <Line
                points={[...polygonPoints, mousePos.x, mousePos.y]}
                stroke={activeLayerColor} strokeWidth={1.5}
                dash={[6, 3]}
              />
              {/* Vertex dots */}
              {Array.from({ length: polygonPoints.length / 2 }).map((_, i) => (
                <Circle
                  key={i}
                  x={polygonPoints[i * 2]} y={polygonPoints[i * 2 + 1]}
                  radius={3} fill={activeLayerColor}
                />
              ))}
            </>
          )}

          {/* Calibration points */}
          {calibPoints.length >= 2 && (
            <>
              <Line
                points={calibPoints.length >= 4 ? calibPoints : [...calibPoints, mousePos.x, mousePos.y]}
                stroke="#FF4444" strokeWidth={2} dash={[6, 3]}
              />
              <Circle x={calibPoints[0]} y={calibPoints[1]} radius={4} fill="#FF4444" />
              {calibPoints.length >= 4 && <Circle x={calibPoints[2]} y={calibPoints[3]} radius={4} fill="#FF4444" />}
            </>
          )}
        </Layer>
      </Stage>

      {/* Calibration Modal */}
      <Modal open={calibModalOpen} onClose={() => { setCalibModalOpen(false); setCalibPoints([]); }}
        title="Set Scale" description="Enter the real-world distance between your two clicked points"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={`Distance in ${unit}`}
            type="number"
            placeholder="e.g., 20"
            value={calibDistance}
            onChange={(e) => setCalibDistance(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setCalibModalOpen(false); setCalibPoints([]); }}>Cancel</Button>
            <Button className="flex-1" onClick={handleCalibrate} disabled={!calibDistance}>Set Scale</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
