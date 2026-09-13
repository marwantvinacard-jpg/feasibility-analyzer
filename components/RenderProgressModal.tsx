import React, { useEffect, useState } from 'react';
import { Sparkles, Camera, Layers, ShieldCheck, Zap } from 'lucide-react';

interface RenderProgressModalProps {
  isOpen: boolean;
  viewTitle: string;
  currentTargetIndex?: number;
  totalTargetsCount?: number;
  spaceType?: string;
}

export const RenderProgressModal: React.FC<RenderProgressModalProps> = ({
  isOpen,
  viewTitle,
  currentTargetIndex = 1,
  totalTargetsCount = 1,
  spaceType = 'Space',
}) => {
  const [progress, setProgress] = useState(10);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const steps = [
    { title: 'Correlating Multi-Angle Camera Perspectives', desc: 'Analyzing 3D spatial alignment & view geometry...' },
    { title: 'Mapping Material Palette & Textures', desc: 'Synthesizing travertine, walnut, and brass samples...' },
    { title: 'Enforcing Preservation Rules', desc: 'Locking structural columns, windows, and door portals...' },
    { title: 'Ray-Tracing Architectural Lighting', desc: 'Calculating warm 2700K indirect coves & reflections...' },
    { title: 'Finalizing 2K High-Resolution Render', desc: 'Applying fine texture details & interior polish...' }
  ];

  useEffect(() => {
    if (!isOpen) {
      setProgress(10);
      setActiveStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        const next = prev + Math.floor(Math.random() * 8) + 4;
        if (next > 20 && next <= 40) setActiveStepIndex(1);
        else if (next > 40 && next <= 60) setActiveStepIndex(2);
        else if (next > 60 && next <= 80) setActiveStepIndex(3);
        else if (next > 80) setActiveStepIndex(4);
        return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-progress-title"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 text-center text-slate-100 shadow-2xl space-y-6">

        {/* Animated Glow Circle */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping motion-reduce:animate-none" />
          <div className="relative z-10 w-20 h-20 bg-slate-950 border-2 border-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-950">
            <Sparkles size={32} className="text-emerald-400 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>

        <div>
          <h2 id="render-progress-title" className="text-lg font-bold text-slate-100">
            Generating AI Studio Renders ({spaceType})
          </h2>
          <p className="text-xs text-emerald-400 font-semibold mt-1">
            {totalTargetsCount > 1
              ? `Processing Target View ${currentTargetIndex} of ${totalTargetsCount}: [${viewTitle}]`
              : `Focusing on Target View: [${viewTitle}]`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-bold">
            <span>{steps[activeStepIndex].title}</span>
            <span>{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Render progress"
            className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800"
          >
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 italic" role="status" aria-live="polite">
            {steps[activeStepIndex].desc}
          </p>
        </div>

        {/* Step List */}
        <div className="space-y-2 text-left bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-xs">
          {steps.map((s, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 transition-colors ${
                  isCompleted
                    ? 'text-emerald-400 font-medium'
                    : isCurrent
                    ? 'text-slate-100 font-bold'
                    : 'text-slate-600'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-400'
                      : isCurrent
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-slate-700'
                  }`}
                />
                <span>{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
