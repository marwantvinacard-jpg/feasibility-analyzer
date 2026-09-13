import React from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { PreservationControls } from '../types';

interface PreservationControlsPanelProps {
  controls: PreservationControls;
  setControls: React.Dispatch<React.SetStateAction<PreservationControls>>;
}

export const PreservationControlsPanel: React.FC<PreservationControlsPanelProps> = ({
  controls,
  setControls,
}) => {
  const toggleControl = (key: keyof PreservationControls) => {
    setControls(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const preserveAll = () => {
    setControls({
      walls: true,
      flooring: true,
      ceilings: true,
      windows: true,
      doors: true,
      lighting: true,
      artwork: true,
      sofas: true,
      tables: true,
      curtains: true,
      columns: true,
      structuralElements: true
    });
  };

  const preserveStructuralOnly = () => {
    setControls({
      walls: false,
      flooring: false,
      ceilings: false,
      windows: true,
      doors: true,
      lighting: false,
      artwork: false,
      sofas: false,
      tables: false,
      curtains: false,
      columns: true,
      structuralElements: true
    });
  };

  const unfreezeAll = () => {
    setControls({
      walls: false,
      flooring: false,
      ceilings: false,
      windows: false,
      doors: false,
      lighting: false,
      artwork: false,
      sofas: false,
      tables: false,
      curtains: false,
      columns: false,
      structuralElements: false
    });
  };

  const preservationItems: { key: keyof PreservationControls; label: string; desc: string }[] = [
    { key: 'walls', label: 'Wall Structures & Geometry', desc: 'Lock wall positions and structural partitions' },
    { key: 'flooring', label: 'Flooring Material', desc: 'Lock current floor tile, wood, or stone texture' },
    { key: 'ceilings', label: 'Ceiling & Beams', desc: 'Lock ceiling height, beams, and cove structure' },
    { key: 'windows', label: 'Windows & Glazing', desc: 'Lock window frames, glass openings, and view angle' },
    { key: 'doors', label: 'Doors & Portals', desc: 'Lock doorway frames, archways, and threshold positions' },
    { key: 'lighting', label: 'Existing Lighting Fixtures', desc: 'Lock current sconces, chandeliers, and spotlights' },
    { key: 'artwork', label: 'Artwork & Wall Decor', desc: 'Lock wall paintings, mirrors, and sculptural pieces' },
    { key: 'sofas', label: 'Sofas & Primary Seating', desc: 'Lock sofa placement, shape, and upholstery' },
    { key: 'tables', label: 'Tables & Credenzas', desc: 'Lock coffee tables, desks, and console tables' },
    { key: 'curtains', label: 'Curtains & Window Treatments', desc: 'Lock drapes, blinds, and sheer fabrics' },
    { key: 'columns', label: 'Structural Columns & Pillars', desc: 'Lock load-bearing pillars and arch columns' },
    { key: 'structuralElements', label: 'Core Architectural Shell', desc: 'Lock overall room proportions and perspective' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Preset Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-400" />
              Element Preservation Controls
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Check the elements you want to KEEP UNTOUCHED during AI generation. Unchecked elements will be reimagined.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={preserveStructuralOnly}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Lock size={13} />
              <span>Preserve Structural Shell</span>
            </button>
            <button
              onClick={preserveAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <CheckSquare size={13} />
              <span>Lock Everything</span>
            </button>
            <button
              onClick={unfreezeAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Unlock size={13} />
              <span>Unfreeze All</span>
            </button>
          </div>
        </div>

        {/* Interactive Checkbox Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {preservationItems.map(item => {
            const isLocked = controls[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggleControl(item.key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  isLocked
                    ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5">
                  {isLocked ? (
                    <CheckSquare size={18} className="text-emerald-400" />
                  ) : (
                    <Square size={18} className="text-slate-600" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-xs ${isLocked ? 'text-emerald-200' : 'text-slate-300'}`}>
                      {item.label}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                        isLocked ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isLocked ? 'LOCKED' : 'MODIFY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
