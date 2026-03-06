import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import * as pdfjsLib from 'pdfjs-dist';
import type { CanvasShape, ToolType, RectData, PolygonData, LineData, CircleData, TextData } from '@/types';
import { calcPolygonCentroid, calcPolygonArea, calcLineLength, formatArea, formatLength } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Module-level PDF caches ──────────────────────────────────────────────────
interface PageData {
  imgEl: HTMLImageElement;
  pdfCanvas: HTMLCanvasElement;
  dims: { width: number; height: number };
}
const HIRES_CACHE    = new Map<string, Map<number, PageData>>();
const THUMB_CACHE    = new Map<string, Array<HTMLImageElement | null>>();
const HIRES_INFLIGHT = new Map<string, Promise<PageData>>();
const DOC_INFLIGHT   = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();
const PDF_DOC_CACHE  = new Map<string, pdfjsLib.PDFDocumentProxy>();
const THUMB_SUBS     = new Map<string, Set<(t: Array<HTMLImageElement | null>) => void>>();
// Per-URL running flag so concurrent calls for different URLs don't block each other
const THUMB_RUNNING  = new Set<string>();

async function loadPdfDoc(url: string): Promise<pdfjsLib.PDFDocumentProxy> {
  if (PDF_DOC_CACHE.has(url)) return PDF_DOC_CACHE.get(url)!;
  if (DOC_INFLIGHT.has(url)) return DOC_INFLIGHT.get(url)!;
  const p = (async () => {
    // Use pdfjs built-in fetching — it handles range requests and CORS correctly
    const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
    PDF_DOC_CACHE.set(url, pdf); DOC_INFLIGHT.delete(url); return pdf;
  })();
  DOC_INFLIGHT.set(url, p); return p;
}

async function renderPage(pdf: pdfjsLib.PDFDocumentProxy, idx: number, s: number): Promise<PageData> {
  const page = await pdf.getPage(idx + 1);
  const vp = page.getViewport({ scale: s });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return new Promise<PageData>((res) => {
    const img = new Image();
    img.onload = () => res({ imgEl: img, pdfCanvas: canvas, dims: { width: vp.width, height: vp.height } });
    img.src = canvas.toDataURL('image/png');
  });
}

function getHiResPage(url: string, idx: number): Promise<PageData> {
  const cached = HIRES_CACHE.get(url)?.get(idx);
  if (cached) return Promise.resolve(cached);
  const key = `${url}:${idx}`;
  if (HIRES_INFLIGHT.has(key)) return HIRES_INFLIGHT.get(key)!;
  const p = loadPdfDoc(url).then(async (pdf) => {
    const data = await renderPage(pdf, idx, 1.5);
    if (!HIRES_CACHE.has(url)) HIRES_CACHE.set(url, new Map());
    HIRES_CACHE.get(url)!.set(idx, data); HIRES_INFLIGHT.delete(key); return data;
  });
  p.catch(() => HIRES_INFLIGHT.delete(key));
  HIRES_INFLIGHT.set(key, p); return p;
}

async function generateThumbs(url: string) {
  if (THUMB_RUNNING.has(url)) return;
  THUMB_RUNNING.add(url);
  try {
    const pdf = await loadPdfDoc(url);
    if (!THUMB_SUBS.has(url)) THUMB_SUBS.set(url, new Set());
    if (!THUMB_CACHE.has(url)) THUMB_CACHE.set(url, new Array(pdf.numPages).fill(null));
    const arr = THUMB_CACHE.get(url)!;
    for (let i = 0; i < pdf.numPages; i++) {
      if (arr[i]) continue;
      try {
        const d = await renderPage(pdf, i, 0.3);
        arr[i] = d.imgEl;
        THUMB_SUBS.get(url)?.forEach((f) => f([...arr]));
      } catch { /* skip bad page */ }
    }
  } finally {
    THUMB_RUNNING.delete(url);
  }
}

async function prefetchPage(url: string, idx: number) {
  try {
    const pdf = await loadPdfDoc(url);
    if (idx < 0 || idx >= pdf.numPages || HIRES_CACHE.get(url)?.has(idx)) return;
    getHiResPage(url, idx).catch(() => {});
  } catch { /* silent */ }
}

function usePdfCanvas(url: string, currentPageIdx: number) {
  // Seed state from module-level caches so re-mounts are instant
  const [pageData,   setPageData]   = useState<PageData | null>(() => HIRES_CACHE.get(url)?.get(currentPageIdx) ?? null);
  const [thumbs,     setThumbs]     = useState<Array<HTMLImageElement | null>>(() => THUMB_CACHE.get(url) ?? []);
  const [totalPages, setTotalPages] = useState<number>(() => PDF_DOC_CACHE.get(url)?.numPages ?? 0);
  const [loading,    setLoading]    = useState(!HIRES_CACHE.get(url)?.has(currentPageIdx) && !!url);
  const [error,      setError]      = useState<string | null>(null);

  // ── Effect 1: always resolve the PDF document (sets totalPages + kicks off thumbs)
  // Runs whenever the URL changes, regardless of page cache state.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // If already cached, apply synchronously then still kick off thumb generation
    const docCached = PDF_DOC_CACHE.get(url);
    if (docCached) {
      setTotalPages(docCached.numPages);
      generateThumbs(url);
    }
    loadPdfDoc(url)
      .then((pdf) => {
        if (cancelled) return;
        setTotalPages(pdf.numPages);
        generateThumbs(url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  // ── Effect 2: render the requested page (uses hi-res cache when available)
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const cached = HIRES_CACHE.get(url)?.get(currentPageIdx);
    if (cached) {
      setPageData(cached);
      setLoading(false);
      prefetchPage(url, currentPageIdx - 1);
      prefetchPage(url, currentPageIdx + 1);
      return;
    }
    setLoading(true); setError(null);
    getHiResPage(url, currentPageIdx)
      .then((data) => {
        if (cancelled) return;
        setPageData(data); setLoading(false);
        prefetchPage(url, currentPageIdx - 1);
        prefetchPage(url, currentPageIdx + 1);
      })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url, currentPageIdx]);

  // ── Effect 3: subscribe to thumbnail updates
  useEffect(() => {
    if (!url) return;
    const ex = THUMB_CACHE.get(url); if (ex) setThumbs([...ex]);
    if (!THUMB_SUBS.has(url)) THUMB_SUBS.set(url, new Set());
    THUMB_SUBS.get(url)!.add(setThumbs);
    return () => { THUMB_SUBS.get(url)?.delete(setThumbs); };
  }, [url]);

  return { pageData, thumbs, totalPages, loading, error };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 900, height: 650 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new ResizeObserver(() => setSize({ width: el.offsetWidth, height: el.offsetHeight }));
    obs.observe(el); setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => obs.disconnect();
  }, [ref]);
  return size;
}

function detectRegion(canvas: HTMLCanvasElement, wx: number, wy: number) {
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const bright = (x: number, y: number) => { if (x<0||y<0||x>=width||y>=height) return 255; const i=(~~y*width+~~x)*4; return (data[i]+data[i+1]+data[i+2])/3; };
  const isWall = (x: number, y: number) => bright(x, y) < 85;
  const MAX = 600; let left=wx, right=wx, top=wy, bottom=wy;
  for (let d=1;d<MAX;d++) { if (isWall(wx-d,wy)) { left=wx-d; break; } }
  for (let d=1;d<MAX;d++) { if (isWall(wx+d,wy)) { right=wx+d; break; } }
  for (let d=1;d<MAX;d++) { if (isWall(wx,wy-d)) { top=wy-d; break; } }
  for (let d=1;d<MAX;d++) { if (isWall(wx,wy+d)) { bottom=wy+d; break; } }
  const w=right-left, h=bottom-top;
  return w>20&&h>20 ? { x:left, y:top, w, h } : null;
}

// ─── Edit handles (resize / vertex editing) ───────────────────────────────────
function EditHandles({ shape, onUpdate }: {
  shape: CanvasShape;
  onUpdate: (newData: unknown) => void;
}) {
  const HS = { fill: 'white', stroke: '#2563EB', strokeWidth: 2, draggable: true, hitStrokeWidth: 12 };

  if (shape.type === 'RECT') {
    const d = shape.data as RectData;
    const x = d.width < 0 ? d.x + d.width : d.x;
    const y = d.height < 0 ? d.y + d.height : d.y;
    const w = Math.abs(d.width), h = Math.abs(d.height);
    const rx = x + w, by = y + h;
    const applyHandle = (id: string, nx: number, ny: number): RectData => {
      let nx2 = x, ny2 = y, nw = w, nh = h;
      if (id.includes('n')) { ny2 = ny; nh = by - ny; }
      if (id.includes('s')) { nh = ny - y; }
      if (id.includes('w')) { nx2 = nx; nw = rx - nx; }
      if (id.includes('e')) { nw = nx - x; }
      return { ...d, x: nx2, y: ny2, width: nw, height: nh };
    };
    return (
      <>
        <Rect x={x} y={y} width={w} height={h} stroke="#2563EB" strokeWidth={1} dash={[4,3]} listening={false} fill="transparent" />
        {[{ id:'nw',cx:x,   cy:y    },{ id:'n', cx:x+w/2,cy:y    },{ id:'ne',cx:x+w,cy:y    },
          { id:'w', cx:x,   cy:y+h/2},                               { id:'e', cx:x+w,cy:y+h/2},
          { id:'sw',cx:x,   cy:y+h  },{ id:'s', cx:x+w/2,cy:y+h  },{ id:'se',cx:x+w,cy:y+h  },
        ].map(hnd => (
          <Circle key={hnd.id} x={hnd.cx} y={hnd.cy} radius={5} {...HS}
            onDragEnd={(e) => { onUpdate(applyHandle(hnd.id, e.target.x(), e.target.y())); e.target.destroy(); }} />
        ))}
      </>
    );
  }

  if (shape.type === 'LINE') {
    const d = shape.data as LineData;
    if (d.points.length < 4) return null;
    const pts = d.points;
    // For multi-point lines (freeform), edit first and last; for 2-point lines edit both
    const editIdxs = d.points.length > 4
      ? [0, Math.floor(pts.length / 4) * 2, pts.length - 2]
      : [0, 2];
    return (
      <>
        {editIdxs.map((pi) => (
          <Circle key={pi} x={pts[pi]} y={pts[pi+1]} radius={5} {...HS}
            onDragEnd={(e) => {
              const np = [...pts]; np[pi] = e.target.x(); np[pi+1] = e.target.y();
              onUpdate({ points: np }); e.target.destroy();
            }} />
        ))}
      </>
    );
  }

  if (shape.type === 'CIRCLE') {
    const d = shape.data as CircleData;
    return (
      <>
        <Circle x={d.x} y={d.y} radius={6} {...HS} fill="#2563EB"
          onDragEnd={(e) => { onUpdate({ ...d, x: e.target.x(), y: e.target.y() }); e.target.destroy(); }} />
        <Circle x={d.x + d.radius} y={d.y} radius={5} {...HS} fill="#EF4444"
          onDragEnd={(e) => { onUpdate({ ...d, radius: Math.max(4, Math.hypot(e.target.x() - d.x, e.target.y() - d.y)) }); e.target.destroy(); }} />
      </>
    );
  }

  if (shape.type === 'POLYGON') {
    const d = shape.data as PolygonData;
    return (
      <>
        {Array.from({ length: d.points.length / 2 }).map((_, i) => (
          <Circle key={i} x={d.points[i*2]} y={d.points[i*2+1]} radius={5} {...HS}
            onDragEnd={(e) => {
              const np = [...d.points]; np[i*2] = e.target.x(); np[i*2+1] = e.target.y();
              onUpdate({ points: np }); e.target.destroy();
            }} />
        ))}
      </>
    );
  }

  return null;
}

// ─── Shape renderer ───────────────────────────────────────────────────────────
function ShapeItem({
  shape, isSelected, activeTool, isDraggable, scale, unit,
  onSelect, onDelete, onUpdateShape, onRename,
}: {
  shape: CanvasShape; isSelected: boolean; activeTool: ToolType;
  isDraggable: boolean; scale: number; unit: string;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
  onUpdateShape: (id: string, updates: Partial<CanvasShape>) => void;
  onRename: (id: string) => void;
}) {
  const color  = shape.color || '#3B82F6';
  const fill   = color + '28';
  const stroke = isSelected ? '#2563EB' : color;
  const sw     = isSelected ? 2.5 : 1.5;
  const dash   = isSelected ? [5, 3] : undefined;

  const click = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (activeTool === 'eraser') { onDelete(shape.id); return; }
    // If already selected → open rename immediately (single-click to edit label)
    if (isSelected && activeTool === 'select') { onRename(shape.id); return; }
    onSelect(shape.id);
  };
  const dblClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (activeTool !== 'eraser') onRename(shape.id);
  };
  const dragEnd = (offsetX: number, offsetY: number) => {
    if (!offsetX && !offsetY) return;
    if (shape.type === 'RECT') {
      const d = shape.data as RectData;
      onUpdateShape(shape.id, { data: { ...d, x: d.x + offsetX, y: d.y + offsetY } });
    } else if (shape.type === 'LINE' || shape.type === 'POLYGON') {
      const d = shape.data as LineData | PolygonData;
      const pts = [...d.points];
      for (let i = 0; i < pts.length; i += 2) { pts[i] += offsetX; pts[i+1] += offsetY; }
      onUpdateShape(shape.id, { data: { ...d, points: pts } });
    } else if (shape.type === 'CIRCLE') {
      const d = shape.data as CircleData;
      onUpdateShape(shape.id, { data: { ...d, x: d.x + offsetX, y: d.y + offsetY } });
    } else if (shape.type === 'TEXT') {
      const d = shape.data as TextData;
      onUpdateShape(shape.id, { data: { ...d, x: d.x + offsetX, y: d.y + offsetY } });
    }
  };

  const groupDragEnd = (e: KonvaEventObject<DragEvent>) => {
    dragEnd(e.target.x(), e.target.y());
    e.target.position({ x: 0, y: 0 });
  };

  if (shape.type === 'TEXT') {
    const d = shape.data as TextData;
    const fs = [d.italic ? 'italic' : '', d.bold ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
    const td = [d.underline && 'underline', d.strikethrough && 'line-through'].filter(Boolean).join(' ');
    return (
      <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
        {isSelected && <Rect x={d.x-4} y={d.y-4} width={(d.width||300)+8} height={(d.fontSize||14)*2+8} stroke="#2563EB" strokeWidth={1} dash={[3,2]} listening={false} fill="transparent" />}
        <Text x={d.x} y={d.y} text={d.text || ''} fontSize={d.fontSize || 14}
          fontStyle={fs} textDecoration={td} fill={d.fill || color}
          width={d.width || 300} wrap="word" />
      </Group>
    );
  }

  // Shared text shadow — white glow makes bold labels readable over any PDF
  const glow = { shadowColor: 'rgba(255,255,255,0.98)', shadowBlur: 12, shadowOffset: { x: 0, y: 0 }, shadowOpacity: 1 };

  // Auto-scale font size to shape dimensions, capped 10–22px
  const autoFs = (w: number, h: number) => Math.max(10, Math.min(22, Math.min(Math.abs(w) / 5, Math.abs(h) / 2.5)));
  // Width for the label text band, proportional to shape but capped
  const autoTw = (w: number) => Math.max(80, Math.min(240, Math.abs(w) * 0.85));

  // Renders metric (top) and optional name label (bottom), centered on cx/cy
  const TwoLineLabel = ({ cx, cy, metric, name, fs, tw }: { cx: number; cy: number; metric: string; name?: string; fs: number; tw: number }) => {
    const lineH = fs * 1.5;
    const totalH = name ? lineH * 2 : lineH;
    const startY = cy - totalH / 2;
    return (
      <>
        <Text x={cx - tw/2} y={startY} text={metric}
          fontSize={fs} fill={stroke} fontStyle="bold" align="center" width={tw}
          listening={false} {...glow} />
        {name && (
          <Text x={cx - tw/2} y={startY + lineH} text={name}
            fontSize={Math.max(9, fs - 2)} fill={stroke} fontStyle="bold" align="center" width={tw}
            listening={false} {...glow} />
        )}
      </>
    );
  };

  if (shape.type === 'RECT') {
    const d = shape.data as RectData;
    const w = Math.abs(d.width), h = Math.abs(d.height);
    const fs = autoFs(w, h);
    const tw = autoTw(w);
    const metric = formatArea(w * h, unit, scale);
    return (
      <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
        <Rect x={d.x} y={d.y} width={d.width} height={d.height}
          fill={fill} stroke={stroke} strokeWidth={sw} dash={dash}
          cornerRadius={d.cornerRadius || 0} hitStrokeWidth={10} />
        <TwoLineLabel cx={d.x + d.width/2} cy={d.y + d.height/2} metric={metric} name={shape.label} fs={fs} tw={tw} />
      </Group>
    );
  }
  if (shape.type === 'POLYGON') {
    const d = shape.data as PolygonData;
    if (d.points.length < 6) return null;
    const c = calcPolygonCentroid(d.points);
    const xs = d.points.filter((_,i) => i%2===0), ys = d.points.filter((_,i) => i%2===1);
    const polyW = Math.max(...xs)-Math.min(...xs), polyH = Math.max(...ys)-Math.min(...ys);
    const fs = autoFs(polyW, polyH);
    const tw = autoTw(polyW);
    const metric = formatArea(calcPolygonArea(d.points), unit, scale);
    return (
      <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
        <Line points={d.points} closed fill={fill} stroke={stroke} strokeWidth={sw} dash={dash} hitStrokeWidth={10} />
        <TwoLineLabel cx={c.x} cy={c.y} metric={metric} name={shape.label} fs={fs} tw={tw} />
      </Group>
    );
  }
  if (shape.type === 'LINE') {
    const d = shape.data as LineData;
    if (d.points.length > 8) {
      return (
        <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
          <Line points={d.points} stroke={stroke} strokeWidth={isSelected ? 3 : 2} lineCap="round" lineJoin="round" hitStrokeWidth={12} />
        </Group>
      );
    }
    const len = formatLength(calcLineLength(d.points), unit, scale);
    const mx=(d.points[0]+d.points[2])/2, my=(d.points[1]+d.points[3])/2;
    const lineH = 16 * 1.5;
    const startY = shape.label ? my - lineH : my - 10;
    return (
      <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
        <Line points={d.points} stroke={stroke} strokeWidth={sw} dash={[8,4]} hitStrokeWidth={12} />
        <Circle x={d.points[0]} y={d.points[1]} radius={4} fill={stroke} listening={false} />
        <Circle x={d.points[2]} y={d.points[3]} radius={4} fill={stroke} listening={false} />
        <Text x={mx-70} y={startY} text={len} fontSize={16} fill={stroke}
          fontStyle="bold" align="center" width={140} listening={false} {...glow} />
        {shape.label && (
          <Text x={mx-70} y={startY + lineH} text={shape.label} fontSize={14} fill={stroke}
            fontStyle="bold" align="center" width={140} listening={false} {...glow} />
        )}
      </Group>
    );
  }
  if (shape.type === 'CIRCLE') {
    const d = shape.data as CircleData;
    const fs = autoFs(d.radius * 2, d.radius * 2);
    const tw = autoTw(d.radius * 2);
    const metric = formatArea(Math.PI * d.radius * d.radius, unit, scale);
    return (
      <Group onClick={click} onTap={click} onDblClick={dblClick} draggable={isDraggable} onDragEnd={groupDragEnd}>
        <Circle x={d.x} y={d.y} radius={d.radius} fill={fill} stroke={stroke} strokeWidth={sw} dash={dash} hitStrokeWidth={10} />
        <TwoLineLabel cx={d.x} cy={d.y} metric={metric} name={shape.label} fs={fs} tw={tw} />
      </Group>
    );
  }
  return null;
}

// ─── Text Edit Modal ──────────────────────────────────────────────────────────
interface TextEditState {
  worldX: number; worldY: number;
  value: string; fontSize: number;
  bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean;
  color: string; editingId: string | null;
}

function TextEditModal({ state, onCommit, onCancel }: {
  state: TextEditState;
  onCommit: (s: TextEditState) => void;
  onCancel: () => void;
}) {
  const [s, setS] = useState(state);
  const commit = () => { if (s.value.trim()) onCommit(s); else onCancel(); };
  const FmtBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn('w-8 h-8 rounded-lg text-sm font-bold transition-colors border',
        active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400')}>
      {children}
    </button>
  );
  return (
    <Modal open onClose={onCancel} title="Add Text" size="sm">
      <div className="space-y-4">
        {/* Formatting toolbar */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FmtBtn active={s.bold} onClick={() => setS(p => ({...p, bold: !p.bold}))}><Bold className="w-3.5 h-3.5 mx-auto" /></FmtBtn>
          <FmtBtn active={s.italic} onClick={() => setS(p => ({...p, italic: !p.italic}))}><Italic className="w-3.5 h-3.5 mx-auto" /></FmtBtn>
          <FmtBtn active={s.underline} onClick={() => setS(p => ({...p, underline: !p.underline}))}><Underline className="w-3.5 h-3.5 mx-auto" /></FmtBtn>
          <FmtBtn active={s.strikethrough} onClick={() => setS(p => ({...p, strikethrough: !p.strikethrough}))}><Strikethrough className="w-3.5 h-3.5 mx-auto" /></FmtBtn>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Size</label>
            <input type="number" value={s.fontSize} min={8} max={72}
              onChange={(e) => setS(p => ({...p, fontSize: Math.max(8, Math.min(72, +e.target.value))}))}
              className="w-14 text-xs border border-slate-200 rounded-lg px-2 py-1 text-center" />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-xs text-slate-500">Color</label>
            <input type="color" value={s.color}
              onChange={(e) => setS(p => ({...p, color: e.target.value}))}
              className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
          </div>
        </div>
        {/* Preview */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[48px]">
          <span style={{
            fontSize: Math.min(s.fontSize, 28),
            fontWeight: s.bold ? 'bold' : 'normal',
            fontStyle: s.italic ? 'italic' : 'normal',
            textDecoration: [s.underline && 'underline', s.strikethrough && 'line-through'].filter(Boolean).join(' '),
            color: s.color,
          }}>
            {s.value || <span className="text-slate-300 font-normal not-italic">Preview…</span>}
          </span>
        </div>
        <textarea
          autoFocus
          value={s.value}
          onChange={(e) => setS(p => ({...p, value: e.target.value}))}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && e.metaKey) commit(); }}
          placeholder="Type your annotation…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder:text-slate-400"
          rows={3}
        />
        <p className="text-[11px] text-slate-400 -mt-1">⌘+Enter to place  ·  Esc to cancel</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" onClick={commit} disabled={!s.value.trim()}>Place Text</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  documentUrl: string;
  activeTool: ToolType;
  activeLayerId: string | null;
  activeLayerColor: string;
  shapes: CanvasShape[];
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onAddShape: (shape: Omit<CanvasShape, 'id'>) => void;
  onUpdateShape: (id: string, updates: Partial<CanvasShape>) => void;
  onDeleteShape: (id: string) => void;
  onRenameShape: (id: string, label: string) => void;
  onPageChange: (page: number) => void;
  scale: number; unit: string; onScaleChange: (s: number) => void;
  currentPage: number;
  metrics?: { area: string; linear: string; count: number };
}

// ─── Rename Shape Modal ───────────────────────────────────────────────────────
const LABEL_MAX = 30;

function RenameShapeModal({ shape, onCommit, onCancel }: {
  shape: CanvasShape;
  onCommit: (label: string) => void;
  onCancel: () => void;
}) {
  const defaultLabel = shape.label || '';
  const [value, setValue] = useState(defaultLabel);
  const remaining = LABEL_MAX - value.length;
  return (
    <Modal open onClose={onCancel} title="Label Element" size="sm">
      <div className="space-y-4">
        <div className="relative">
          <input
            autoFocus
            value={value}
            maxLength={LABEL_MAX}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommit(value);
              if (e.key === 'Escape') onCancel();
            }}
            placeholder={`e.g. ${shape.type === 'RECT' ? 'Living Room' : shape.type === 'LINE' ? 'North Wall' : 'Area 1'}`}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder:text-slate-400 pr-12"
          />
          <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums',
            remaining <= 5 ? 'text-red-400 font-semibold' : 'text-slate-400')}>
            {remaining}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">Leave blank to show the measurement value instead.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" onClick={() => onCommit(value)}>Apply Label</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main canvas ──────────────────────────────────────────────────────────────
export default function TakeoffCanvas({
  documentUrl, activeTool, activeLayerId, activeLayerColor,
  shapes, selectedShapeId, onSelectShape, onAddShape, onUpdateShape, onDeleteShape,
  onRenameShape, onPageChange, scale, unit, onScaleChange, currentPage, metrics,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage>(null);
  const size         = useContainerSize(containerRef as React.RefObject<HTMLDivElement>);
  const pageIdx      = currentPage - 1;
  const { pageData, thumbs, totalPages, loading, error } = usePdfCanvas(documentUrl, pageIdx);
  const dims = pageData?.dims ?? { width: 1200, height: 900 };

  // ── Smooth zoom/pan via refs ────────────────────────────────────────────────
  const scaleRef = useRef(1);
  const [dispScale, setDispScale] = useState(1);
  const [gridPos,   setGridPos]   = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const syncUI = useCallback((s: number, p: { x: number; y: number }) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { setDispScale(s); setGridPos(p); });
  }, []);

  const fitPage = useCallback((w: number, h: number, cW: number, cH: number) => {
    const ts = Math.min((cW - 96) / w, (cH - 96) / h) * 0.9;
    const pos = { x: (cW - w * ts) / 2, y: (cH - h * ts) / 2 };
    stageRef.current?.scale({ x: ts, y: ts }); stageRef.current?.position(pos);
    scaleRef.current = ts; syncUI(ts, pos);
  }, [syncUI]);

  useEffect(() => {
    if (pageData && size.width) fitPage(dims.width, dims.height, size.width, size.height);
  }, [pageData, size.width, size.height]); // eslint-disable-line

  // ── Space bar = temporary pan ───────────────────────────────────────────────
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ── External rename trigger from toolbar Pencil button ──────────────────────
  useEffect(() => {
    const handler = () => { if (selectedShapeId) setRenamingShapeId(selectedShapeId); };
    window.addEventListener('pt:rename-selected', handler as EventListener);
    return () => window.removeEventListener('pt:rename-selected', handler as EventListener);
  }, [selectedShapeId]);
  const isPanning = activeTool === 'pan' || spaceDown;

  // ── Drawing state ──────────────────────────────────────────────────────────
  const [isDrawing,     setIsDrawing]     = useState(false);
  const [drawStart,     setDrawStart]     = useState({ x: 0, y: 0 });
  const [currentRect,   setCurrentRect]   = useState<RectData | null>(null);
  const [currentLine,   setCurrentLine]   = useState<LineData | null>(null);
  const [currentCircle, setCurrentCircle] = useState<CircleData | null>(null);
  const [polygonPts,    setPolygonPts]    = useState<number[]>([]);
  const [freeformPts,   setFreeformPts]   = useState<number[]>([]);
  const [isFreeforming, setIsFreeforming] = useState(false);
  const [freearePts,    setFreearePts]    = useState<number[]>([]);
  const [isFreeArea,    setIsFreeArea]    = useState(false);
  const [mousePos,      setMousePos]      = useState({ x: 0, y: 0 });
  const [calibPts,      setCalibPts]      = useState<number[]>([]);
  const [calibModal,    setCalibModal]    = useState(false);
  const [calibDist,     setCalibDist]     = useState('');
  const [detectPreview, setDetectPreview] = useState<RectData | null>(null);
  const [textEdit,      setTextEdit]      = useState<TextEditState | null>(null);
  const [renamingShapeId, setRenamingShapeId] = useState<string | null>(null);

  useEffect(() => {
    setIsDrawing(false); setCurrentRect(null); setCurrentLine(null); setCurrentCircle(null);
    setPolygonPts([]); setFreeformPts([]); setIsFreeforming(false);
    setFreearePts([]); setIsFreeArea(false); setCalibPts([]); setDetectPreview(null);
  }, [activeTool]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPolygonPts([]); setCalibPts([]); setDetectPreview(null); setTextEdit(null);
      setIsDrawing(false); setIsFreeforming(false); setIsFreeArea(false);
      setCurrentRect(null); setCurrentLine(null); setCurrentCircle(null);
      setFreeformPts([]); setFreearePts([]);
      onSelectShape(null);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onSelectShape]);

  const getPos = useCallback(() => {
    const s = stageRef.current; if (!s) return { x: 0, y: 0 };
    const p = s.getPointerPosition()!;
    return { x: (p.x - s.x()) / s.scaleX(), y: (p.y - s.y()) / s.scaleY() };
  }, []);

  // ── Smooth wheel zoom ──────────────────────────────────────────────────────
  // Math.pow(0.999, deltaY) is proportional to scroll speed — very smooth on trackpads
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const factor = Math.pow(0.999, e.evt.deltaY);
    const old    = scaleRef.current;
    const ptr    = stage.getPointerPosition()!;
    const anchor = { x: (ptr.x - stage.x()) / old, y: (ptr.y - stage.y()) / old };
    const ns     = Math.max(0.03, Math.min(30, old * factor));
    const np     = { x: ptr.x - anchor.x * ns, y: ptr.y - anchor.y * ns };
    stage.scale({ x: ns, y: ns }); stage.position(np);
    scaleRef.current = ns; syncUI(ns, np);
  };

  const zoomBy = (f: number) => {
    const stage = stageRef.current!; const old = scaleRef.current;
    const ctr = { x: size.width/2, y: size.height/2 };
    const anchor = { x: (ctr.x-stage.x())/old, y: (ctr.y-stage.y())/old };
    const ns = Math.max(0.03, Math.min(30, old * f));
    const np = { x: ctr.x - anchor.x*ns, y: ctr.y - anchor.y*ns };
    stage.scale({ x: ns, y: ns }); stage.position(np);
    scaleRef.current = ns; syncUI(ns, np);
  };

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) return;
    const pos = getPos();

    if (activeTool === 'select') { if (e.target === e.target.getStage()) onSelectShape(null); return; }
    if (activeTool === 'eraser') return;
    if (activeTool === 'polygon') { setPolygonPts(p => [...p, pos.x, pos.y]); return; }

    if (activeTool === 'text') {
      setTextEdit({ worldX: pos.x, worldY: pos.y, value: '', fontSize: 14,
        bold: false, italic: false, underline: false, strikethrough: false,
        color: activeLayerColor, editingId: null });
      return;
    }
    if (activeTool === 'freeform') { setIsFreeforming(true); setFreeformPts([pos.x, pos.y]); return; }
    if (activeTool === 'freearea') { setIsFreeArea(true); setFreearePts([pos.x, pos.y]); return; }
    if (activeTool === 'calibrate') {
      setCalibPts(p => { const n = [...p, pos.x, pos.y]; if (n.length >= 4) { setCalibModal(true); return n.slice(0,4); } return n; });
      return;
    }
    if (activeTool === 'detect') {
      if (pageData) { const d = detectRegion(pageData.pdfCanvas, pos.x, pos.y); if (d) setDetectPreview({ x:d.x, y:d.y, width:d.w, height:d.h }); }
      return;
    }
    if (activeTool === 'count') {
      if (!activeLayerId) return;
      onAddShape({ type:'CIRCLE', data:{ x:pos.x, y:pos.y, radius:8 } as CircleData, layerId:activeLayerId, color:activeLayerColor });
      return;
    }
    setIsDrawing(true); setDrawStart(pos);
    if (activeTool === 'rect')   setCurrentRect({ x:pos.x, y:pos.y, width:0, height:0 });
    if (activeTool === 'line')   setCurrentLine({ points:[pos.x, pos.y, pos.x, pos.y] });
    if (activeTool === 'circle') setCurrentCircle({ x:pos.x, y:pos.y, radius:0 });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = getPos(); setMousePos(pos);
    if (isFreeforming) { setFreeformPts(p => [...p, pos.x, pos.y]); return; }
    if (isFreeArea)    { setFreearePts(p => [...p, pos.x, pos.y]); return; }
    if (!isDrawing) return;
    if (activeTool === 'rect')   setCurrentRect({ x:drawStart.x, y:drawStart.y, width:pos.x-drawStart.x, height:pos.y-drawStart.y });
    if (activeTool === 'line')   setCurrentLine({ points:[drawStart.x, drawStart.y, pos.x, pos.y] });
    if (activeTool === 'circle') { const r=Math.hypot(pos.x-drawStart.x, pos.y-drawStart.y); setCurrentCircle({ x:drawStart.x, y:drawStart.y, radius:r }); }
  };

  const handleMouseUp = () => {
    if (!activeLayerId) { setIsDrawing(false); setIsFreeforming(false); setIsFreeArea(false); return; }
    const MIN = 5;
    if (isFreeforming && freeformPts.length >= 6)
      onAddShape({ type:'LINE', data:{ points:freeformPts }, layerId:activeLayerId, color:activeLayerColor });
    if (isFreeArea && freearePts.length >= 8) {
      // Close the path: snap last point to first
      const closed = [...freearePts, freearePts[0], freearePts[1]];
      onAddShape({ type:'POLYGON', data:{ points:closed }, layerId:activeLayerId, color:activeLayerColor });
    }
    setIsFreeforming(false); setFreeformPts([]); setIsFreeArea(false); setFreearePts([]);
    if (isDrawing) {
      if (activeTool==='rect'&&currentRect&&Math.abs(currentRect.width)>MIN&&Math.abs(currentRect.height)>MIN)
        onAddShape({ type:'RECT', data:currentRect, layerId:activeLayerId, color:activeLayerColor });
      if (activeTool==='line'&&currentLine&&calcLineLength(currentLine.points)>MIN)
        onAddShape({ type:'LINE', data:currentLine, layerId:activeLayerId, color:activeLayerColor });
      if (activeTool==='circle'&&currentCircle&&currentCircle.radius>MIN)
        onAddShape({ type:'CIRCLE', data:currentCircle, layerId:activeLayerId, color:activeLayerColor });
    }
    setIsDrawing(false); setCurrentRect(null); setCurrentLine(null); setCurrentCircle(null);
  };

  const handleDblClick = () => {
    if (activeTool==='polygon'&&polygonPts.length>=6&&activeLayerId) {
      onAddShape({ type:'POLYGON', data:{ points:polygonPts }, layerId:activeLayerId, color:activeLayerColor });
      setPolygonPts([]);
    }
  };

  const commitDetect = () => {
    if (!detectPreview||!activeLayerId) return;
    onAddShape({ type:'RECT', data:detectPreview, layerId:activeLayerId, color:activeLayerColor });
    setDetectPreview(null);
  };

  const handleCalibrate = () => {
    const d = parseFloat(calibDist); if (!d||d<=0||calibPts.length<4) return;
    const px = Math.hypot(calibPts[2]-calibPts[0], calibPts[3]-calibPts[1]);
    onScaleChange(px/d); setCalibPts([]); setCalibModal(false); setCalibDist('');
  };

  const commitText = (s: TextEditState) => {
    if (!activeLayerId) return;
    const data: TextData = { x:s.worldX, y:s.worldY, text:s.value, fontSize:s.fontSize,
      bold:s.bold, italic:s.italic, underline:s.underline, strikethrough:s.strikethrough,
      fill:s.color, width:300 };
    if (s.editingId) onUpdateShape(s.editingId, { data });
    else onAddShape({ type:'TEXT', data, layerId:activeLayerId, color:s.color });
    setTextEdit(null);
  };

  const handleUpdateShapeData = useCallback((id: string, newData: unknown) => {
    onUpdateShape(id, { data: newData as CanvasShape['data'] });
  }, [onUpdateShape]);

  // ── Cursor ─────────────────────────────────────────────────────────────────
  const baseCursor = ({ pan:'grab', select:'default', eraser:'cell', rect:'crosshair', polygon:'crosshair',
    line:'crosshair', circle:'crosshair', calibrate:'crosshair', freeform:'crosshair', freearea:'crosshair',
    count:'copy', detect:'cell', text:'text' } as Record<string,string>)[activeTool] ?? 'default';
  const cursor = spaceDown ? 'grab' : baseCursor;

  // ── Engineering dot grid ───────────────────────────────────────────────────
  const GRID = 28;
  const dotGrid = useMemo(() => ({
    backgroundImage: 'radial-gradient(circle, #B8C5D3 1.1px, transparent 1.1px)',
    backgroundSize: `${GRID*dispScale}px ${GRID*dispScale}px`,
    backgroundPosition: `${((gridPos.x%(GRID*dispScale))+(GRID*dispScale))%(GRID*dispScale)}px ${((gridPos.y%(GRID*dispScale))+(GRID*dispScale))%(GRID*dispScale)}px`,
  }), [dispScale, gridPos.x, gridPos.y]);

  const numPages = totalPages || 1;
  const zoomPct  = Math.round(dispScale * 100);
  const isDraggableShape = activeTool === 'select';

  const selectedShape = shapes.find(s => s.id === selectedShapeId) ?? null;

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#ECF0F5]"
      style={{ ...dotGrid, cursor }}>

      {/* ── Loading ── */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading page {currentPage}…</p>
          <p className="text-xs text-slate-400 mt-1">Other pages load in background</p>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/90">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-sm font-semibold text-slate-800 mb-1">Failed to load PDF</p>
          <p className="text-xs text-slate-500 max-w-xs text-center">{error}</p>
        </div>
      )}

      {/* ── Tool hints ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        {activeTool==='polygon'&&polygonPts.length>0&&(
          <div className="bg-amber-50 border border-amber-300 text-amber-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
            {polygonPts.length/2} pts · double-click to close · Esc to cancel
          </div>
        )}
        {activeTool==='calibrate'&&calibPts.length<4&&!calibModal&&(
          <div className="bg-blue-50 border border-blue-300 text-blue-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">
            Click {calibPts.length===0?'start point':'end point'} of a known-length feature
          </div>
        )}
        {activeTool==='eraser'&&<div className="bg-red-50 border border-red-300 text-red-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Click a shape to erase it</div>}
        {activeTool==='freeform'&&<div className="bg-purple-50 border border-purple-300 text-purple-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Hold & drag for freehand stroke</div>}
        {activeTool==='freearea'&&<div className="bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Hold & drag to draw a closed area shape</div>}
        {activeTool==='detect'&&<div className="bg-teal-50 border border-teal-300 text-teal-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Click inside a room to auto-detect its boundary</div>}
        {activeTool==='text'&&<div className="bg-brand-50 border border-brand-300 text-brand-700 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Click anywhere on the plan to place a text annotation</div>}
        {spaceDown&&<div className="bg-slate-100 border border-slate-300 text-slate-600 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm">Panning — release Space to resume tool</div>}
      </div>

      {/* ── Auto-detect confirm ── */}
      {detectPreview&&(
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white border border-teal-300 rounded-xl px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium text-slate-700">Region detected</span>
          <button onClick={commitDetect} className="px-3 py-1 text-xs font-semibold bg-teal-500 text-white rounded-lg hover:bg-teal-600">✓ Add</button>
          <button onClick={()=>setDetectPreview(null)} className="px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
        </div>
      )}

      {/* ── Page thumbnails ── */}
      {numPages>1&&(
        <div className="absolute right-3 top-3 bottom-16 z-20 flex flex-col gap-1.5 overflow-y-auto
                        bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl p-1.5 shadow-md"
          style={{ width:76 }}>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center py-0.5">Pages</p>
          {Array.from({ length:numPages }).map((_,i)=>{
            const thumb=thumbs[i]; const isActive=i===pageIdx;
            return (
              <button key={i} onClick={()=>onPageChange(i+1)}
                className={`relative rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${isActive?'border-brand-500 shadow-md':'border-transparent hover:border-slate-300'}`}
                style={{ width:60, height:78 }} title={`Page ${i+1}`}>
                {thumb ? <img src={thumb.src} alt="" style={{ width:60, height:78, objectFit:'cover', display:'block' }} />
                       : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Loader2 className="w-3 h-3 text-slate-400 animate-spin" /></div>}
                <div className={`absolute bottom-0 inset-x-0 text-[9px] font-bold text-center py-0.5 ${isActive?'bg-brand-500 text-white':'bg-black/30 text-white'}`}>{i+1}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Page navigation ── */}
      {numPages>1&&(
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2
                        bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
          <button onClick={()=>onPageChange(Math.max(1,currentPage-1))} disabled={currentPage<=1}
            className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="text-xs font-semibold text-slate-600 px-1">Page {currentPage} / {numPages}</span>
          <button onClick={()=>onPageChange(Math.min(numPages,currentPage+1))} disabled={currentPage>=numPages}
            className="p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-4 right-3 z-20 flex items-center gap-1
                      bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
        <button onClick={()=>zoomBy(1/1.2)} className="text-slate-500 hover:text-slate-800 w-5 text-center font-mono text-base leading-none">−</button>
        <button onClick={()=>fitPage(dims.width,dims.height,size.width,size.height)}
          className="text-xs font-mono font-semibold text-slate-600 hover:text-slate-900 w-11 text-center">{zoomPct}%</button>
        <button onClick={()=>zoomBy(1.2)} className="text-slate-500 hover:text-slate-800 w-5 text-center font-mono text-base leading-none">+</button>
      </div>

      {/* ── Bottom-left panel: RGB metrics + coordinates ── */}
      <div className="absolute bottom-4 left-3 z-20 bg-white/90 backdrop-blur-sm border border-slate-200
                      rounded-xl px-3 py-2 shadow-sm pointer-events-none flex flex-col gap-1">
        {metrics && (
          <>
            <span className="text-[11px] font-bold font-mono leading-tight"
              style={{ color: '#DC2626' }}>□&nbsp;{metrics.area}</span>
            <span className="text-[11px] font-bold font-mono leading-tight"
              style={{ color: '#16A34A' }}>─&nbsp;{metrics.linear}</span>
            <span className="text-[11px] font-bold font-mono leading-tight"
              style={{ color: '#2563EB' }}>⊕&nbsp;{metrics.count} elements</span>
            <div className="w-full h-px bg-slate-200 my-0.5" />
          </>
        )}
        <span className="text-[11px] font-mono text-slate-500 leading-tight">
          x: {(mousePos.x/(scale||1)).toFixed(1)} {unit} &nbsp; y: {(mousePos.y/(scale||1)).toFixed(1)} {unit}
        </span>
      </div>

      {/* ── Konva stage ── */}
      <Stage ref={stageRef} width={size.width} height={size.height}
        draggable={isPanning}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        onDragEnd={(e) => { const s = e.target as Konva.Stage; syncUI(scaleRef.current, { x:s.x(), y:s.y() }); }}>

        {/* Page background */}
        <Layer listening={false}>
          {pageData ? (
            <>
              <Rect x={6} y={6} width={dims.width} height={dims.height} fill="#C5CDD9" cornerRadius={4} />
              <Rect x={0} y={0} width={dims.width} height={dims.height} fill="white" cornerRadius={2} />
              <KonvaImage image={pageData.imgEl} x={0} y={0} width={dims.width} height={dims.height} />
            </>
          ) : (
            <Rect x={0} y={0} width={dims.width} height={dims.height} fill="#E2E8F0" cornerRadius={4} />
          )}
        </Layer>

        {/* Shapes + handles */}
        <Layer>
          {shapes.map(s => (
            <ShapeItem key={s.id} shape={s} isSelected={selectedShapeId===s.id}
              activeTool={activeTool} isDraggable={isDraggableShape}
              scale={scale} unit={unit}
              onSelect={onSelectShape} onDelete={onDeleteShape} onUpdateShape={onUpdateShape}
              onRename={(id) => setRenamingShapeId(id)} />
          ))}

          {/* Edit handles for selected shape */}
          {selectedShape && activeTool === 'select' && (
            <EditHandles shape={selectedShape} onUpdate={(d) => handleUpdateShapeData(selectedShape.id, d)} />
          )}

          {/* In-progress drawing previews */}
          {currentRect&&<Rect x={currentRect.x} y={currentRect.y} width={currentRect.width} height={currentRect.height} fill={activeLayerColor+'22'} stroke={activeLayerColor} strokeWidth={1.5} dash={[5,3]} />}
          {currentLine&&<Line points={currentLine.points} stroke={activeLayerColor} strokeWidth={2} dash={[8,4]} />}
          {currentCircle&&currentCircle.radius>0&&<Circle x={currentCircle.x} y={currentCircle.y} radius={currentCircle.radius} fill={activeLayerColor+'22'} stroke={activeLayerColor} strokeWidth={1.5} dash={[5,3]} />}
          {polygonPts.length>=2&&(
            <>
              <Line points={[...polygonPts, mousePos.x, mousePos.y]} stroke={activeLayerColor} strokeWidth={1.5} dash={[5,3]} />
              {Array.from({length:polygonPts.length/2}).map((_,i)=>(
                <Circle key={i} x={polygonPts[i*2]} y={polygonPts[i*2+1]} radius={4} fill={activeLayerColor} stroke="white" strokeWidth={1.5} />
              ))}
            </>
          )}
          {freeformPts.length>=4&&<Line points={freeformPts} stroke={activeLayerColor} strokeWidth={2} lineCap="round" lineJoin="round" />}
          {freearePts.length>=4&&<Line points={[...freearePts, freearePts[0], freearePts[1]]} stroke={activeLayerColor} strokeWidth={2} dash={[4,3]} closed fill={activeLayerColor+'15'} />}
          {calibPts.length>=2&&(
            <>
              <Line points={calibPts.length>=4?calibPts:[...calibPts, mousePos.x, mousePos.y]} stroke="#EF4444" strokeWidth={2} dash={[6,3]} />
              <Circle x={calibPts[0]} y={calibPts[1]} radius={5} fill="#EF4444" stroke="white" strokeWidth={1.5} />
              {calibPts.length>=4&&<Circle x={calibPts[2]} y={calibPts[3]} radius={5} fill="#EF4444" stroke="white" strokeWidth={1.5} />}
            </>
          )}
          {detectPreview&&<Rect x={detectPreview.x} y={detectPreview.y} width={detectPreview.width} height={detectPreview.height} fill="#14B8A622" stroke="#14B8A6" strokeWidth={2} dash={[6,3]} />}
        </Layer>
      </Stage>

      {/* ── Text Edit Modal ── */}
      {textEdit && (
        <TextEditModal state={textEdit} onCommit={commitText} onCancel={() => setTextEdit(null)} />
      )}

      {/* ── Rename Shape Modal ── */}
      {renamingShapeId && (() => {
        const s = shapes.find(x => x.id === renamingShapeId);
        if (!s) return null;
        return (
          <RenameShapeModal
            shape={s}
            onCommit={(label) => { onRenameShape(renamingShapeId, label); setRenamingShapeId(null); }}
            onCancel={() => setRenamingShapeId(null)}
          />
        );
      })()}

      {/* ── Calibration modal ── */}
      <Modal open={calibModal} onClose={()=>{ setCalibModal(false); setCalibPts([]); }}
        title="Set Scale" description={`Enter the actual distance (${unit}) between your two clicked points`} size="sm">
        <div className="space-y-4">
          <Input label={`Known distance in ${unit}`} type="number" placeholder="e.g., 20"
            value={calibDist} onChange={e=>setCalibDist(e.target.value)}
            autoFocus onKeyDown={(e:React.KeyboardEvent)=>e.key==='Enter'&&handleCalibrate()} />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={()=>{ setCalibModal(false); setCalibPts([]); }}>Cancel</Button>
            <Button className="flex-1" onClick={handleCalibrate} disabled={!calibDist}>Set Scale</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
