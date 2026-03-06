import { cn } from '@/lib/utils';
import type { ToolType } from '@/types';
import {
  MousePointer2, Hand, Square, Circle, Spline, Minus,
  Ruler, Eraser, Pencil, Crosshair, MapPin, Type, Lasso,
} from 'lucide-react';

interface ToolDef {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  description: string;
}

// Tool groups — rendered with dividers between groups
const GROUPS: ToolDef[][] = [
  [
    { id: 'select',    label: 'Select',         shortcut: 'V', icon: MousePointer2, description: 'Select & inspect shapes' },
    { id: 'pan',       label: 'Pan',            shortcut: 'H', icon: Hand,          description: 'Drag to pan the canvas' },
  ],
  [
    { id: 'rect',      label: 'Rectangle',      shortcut: 'R', icon: Square,        description: 'Draw a rectangular area' },
    { id: 'polygon',   label: 'Polygon',        shortcut: 'P', icon: Spline,        description: 'Click vertices · double-click to close' },
    { id: 'circle',    label: 'Circle',         shortcut: 'C', icon: Circle,        description: 'Drag outward from center' },
    { id: 'line',      label: 'Line Measure',   shortcut: 'L', icon: Minus,         description: 'Measure straight distances' },
    { id: 'freeform',  label: 'Pencil Stroke',  shortcut: 'F', icon: Pencil,        description: 'Freehand open stroke markup' },
    { id: 'freearea',  label: 'Freeform Area',  shortcut: 'A', icon: Lasso,         description: 'Draw any closed shape freehand' },
    { id: 'count',     label: 'Count Marker',   shortcut: 'N', icon: MapPin,        description: 'Click to place count pins' },
    { id: 'text',      label: 'Text Label',     shortcut: 'T', icon: Type,          description: 'Add formatted text annotation' },
  ],
  [
    { id: 'detect',    label: 'Auto-Detect',    shortcut: 'D', icon: Crosshair,     description: 'Click a room to detect its walls' },
  ],
  [
    { id: 'calibrate', label: 'Calibrate Scale', shortcut: 'M', icon: Ruler,        description: 'Set real-world scale from two points' },
  ],
  [
    { id: 'eraser',    label: 'Eraser',         shortcut: 'E', icon: Eraser,        description: 'Click a shape to delete it' },
  ],
];

interface Props {
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;
}

// Rich upward tooltip
function UpTooltip({ label, shortcut, description }: { label: string; shortcut: string; description: string }) {
  return (
    <div className={cn(
      'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-44',
      'bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-xl',
      'opacity-0 group-hover/tool:opacity-100 scale-95 group-hover/tool:scale-100',
      'transition-all duration-150 origin-bottom',
    )}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold">{label}</span>
        <kbd className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">{shortcut}</kbd>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{description}</p>
      {/* Downward arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
    </div>
  );
}

export default function TakeoffToolbar({ activeTool, onToolChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl px-2 py-1.5 shadow-lg">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />}
          {group.map((tool) => (
            <div key={tool.id} className="relative group/tool">
              <button
                onClick={() => onToolChange(tool.id)}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150',
                  activeTool === tool.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                )}
                aria-label={tool.label}
              >
                <tool.icon className="w-4 h-4" strokeWidth={activeTool === tool.id ? 2.5 : 2} />
              </button>
              <UpTooltip label={tool.label} shortcut={tool.shortcut} description={tool.description} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
