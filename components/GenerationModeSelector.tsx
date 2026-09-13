import React from 'react';
import {
  Zap,
  Sparkles,
  Crown,
  Layers,
  Armchair,
  Lightbulb,
  Building,
  RefreshCw,
  Aperture,
  CheckCircle2,
  Palette,
  Leaf,
  Waves,
  Landmark,
  BrainCircuit
} from 'lucide-react';
import { GenerationMode } from '../types';
import { GENERATION_MODES, DESIGN_BRAINS } from '../constants';

interface GenerationModeSelectorProps {
  generationMode: GenerationMode;
  setGenerationMode: (mode: GenerationMode) => void;
  designBrainId: string;
  setDesignBrainId: (id: string) => void;
}

const iconMap: Record<string, any> = {
  Zap,
  Sparkles,
  Crown,
  Layers,
  Armchair,
  Lightbulb,
  Building,
  RefreshCw,
  Aperture,
  Palette,
  Leaf,
  Waves,
  Landmark,
};

export const GenerationModeSelector: React.FC<GenerationModeSelectorProps> = ({
  generationMode,
  setGenerationMode,
  designBrainId,
  setDesignBrainId,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Zap size={20} className="text-amber-400" />
          Select AI Rendering Engine Mode
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Choose how the AI should interpret your input images and structured prompt. Each mode adjusts the render pipeline behavior.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GENERATION_MODES.map(mode => {
            const Icon = iconMap[mode.iconName] || Sparkles;
            const isSelected = generationMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setGenerationMode(mode.id)}
                aria-pressed={isSelected}
                className={`text-left p-5 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/30 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400'}`}>
                      <Icon size={20} />
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Active Mode
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm mb-1">
                    {mode.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <BrainCircuit size={20} className="text-emerald-400" />
          Select Design Brain
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          An expert lens layered on top of the rendering mode above — it shapes the AI's design judgement toward a specific kind of hospitality project.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DESIGN_BRAINS.map(brain => {
            const Icon = iconMap[brain.iconName] || BrainCircuit;
            const isSelected = designBrainId === brain.id;

            return (
              <button
                key={brain.id}
                type="button"
                onClick={() => setDesignBrainId(brain.id)}
                aria-pressed={isSelected}
                className={`text-left p-5 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/30 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400'}`}>
                      <Icon size={20} />
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Active Brain
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm mb-1">
                    {brain.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {brain.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
