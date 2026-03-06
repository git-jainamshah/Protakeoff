import { cn } from '@/lib/utils';
import type { ToolType } from '@/types';
import {
  MousePointer2, Hand, Square, Circle, Spline, Minus, Ruler, Eraser
} from 'lucide-react';

interface Props {
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }>; group?: string }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2, group: 'nav' },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: Hand, group: 'nav' },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: Square, group: 'draw' },
  { id: 'polygon', label: 'Polygon', shortcut: 'P', icon: Spline, group: 'draw' },
  { id: 'line', label: 'Line / Ruler', shortcut: 'L', icon: Minus, group: 'draw' },
  { id: 'circle', label: 'Circle', shortcut: 'C', icon: Circle, group: 'draw' },
  { id: 'calibrate', label: 'Calibrate Scale', shortcut: 'M', icon: Ruler, group: 'measure' },
  { id: 'eraser', label: 'Eraser', shortcut: '', icon: Eraser, group: 'edit' },
];

export default function TakeoffToolbar({ activeTool, onToolChange }: Props) {
  const groups = ['nav', 'draw', 'measure', 'edit'];

  return (
    <div className="w-12 flex-shrink-0 bg-surface-sidebar border-l border-surface-border flex flex-col items-center py-3 gap-1">
      {groups.map((group, gi) => (
        <div key={group}>
          {gi > 0 && <div className="w-6 border-t border-surface-border my-2" />}
          {TOOLS.filter((t) => t.group === group).map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              className={cn(
                'tool-btn my-0.5',
                activeTool === tool.id && 'tool-btn-active'
              )}
            >
              <tool.icon className="w-4 h-4" />
              {tool.shortcut && (
                <span className="text-[8px] mt-0.5 opacity-50 leading-none">{tool.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
