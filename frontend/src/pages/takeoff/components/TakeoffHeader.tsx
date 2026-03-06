import { cn } from '@/lib/utils';
import type { ActiveTab } from '../TakeoffPage';
import type { Document } from '@/types';
import {
  ArrowLeft, Save, Undo2, Redo2, Layers, Calculator,
  ChevronLeft, ChevronRight, Loader2, Settings2
} from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Props {
  document: Document;
  projectId: string;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  isSaving: boolean;
  scale: number;
  unit: string;
  onScaleChange: (s: number) => void;
  onUnitChange: (u: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onBack: () => void;
}

const TABS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'takeoff', label: 'Take-off', icon: Layers },
  { id: 'estimate', label: 'Estimate', icon: Calculator },
];

export default function TakeoffHeader({
  document, activeTab, onTabChange, canUndo, canRedo,
  onUndo, onRedo, onSave, isSaving, scale, unit,
  onScaleChange, onUnitChange, currentPage, totalPages, onPageChange, onBack,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localScale, setLocalScale] = useState(String(scale));

  return (
    <>
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-surface-sidebar border-b border-surface-border gap-4">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="btn-ghost p-1.5 rounded flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0">
              <Layers className="w-3 h-3 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate leading-tight">{document.name}</p>
              <p className="text-[10px] text-slate-600 leading-none">ProTakeOff · v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-1 bg-surface-card rounded-lg p-1 border border-surface-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Page Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 bg-surface-card border border-surface-border rounded-md px-2 py-1">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="btn-ghost p-0.5 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs text-slate-400 px-1">{currentPage}/{totalPages}</span>
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="btn-ghost p-0.5 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Scale indicator */}
          <button
            onClick={() => { setLocalScale(String(scale)); setSettingsOpen(true); }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
          >
            <Settings2 className="w-3 h-3" />
            1px = {(1 / scale).toFixed(2)} {unit}
          </button>

          {/* Undo/Redo */}
          <button onClick={onUndo} disabled={!canUndo} className="btn-ghost p-1.5 rounded disabled:opacity-30" title="Undo (⌘Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="btn-ghost p-1.5 rounded disabled:opacity-30" title="Redo (⌘⇧Z)">
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Save */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              isSaving
                ? 'bg-surface-card text-slate-500 border border-surface-border cursor-wait'
                : 'bg-brand-600 text-white hover:bg-brand-500'
            )}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Scale Settings Modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Document Settings" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Unit</label>
            <div className="grid grid-cols-3 gap-2">
              {['ft', 'm', 'in'].map((u) => (
                <button
                  key={u}
                  onClick={() => onUnitChange(u)}
                  className={cn(
                    'py-2 rounded-md text-sm font-medium border transition-colors',
                    unit === u
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-surface-card border-surface-border text-slate-400 hover:border-slate-500'
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Scale (pixels per unit)"
            type="number"
            value={localScale}
            onChange={(e) => setLocalScale(e.target.value)}
            hint="e.g., 50 means 1 ft = 50 pixels on screen"
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              onScaleChange(parseFloat(localScale) || 1);
              setSettingsOpen(false);
            }}>Apply</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
