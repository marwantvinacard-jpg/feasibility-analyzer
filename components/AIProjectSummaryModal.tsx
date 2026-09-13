import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Layers,
  Camera,
  Ruler,
  Brain,
  Gauge
} from 'lucide-react';
import {
  ViewImage,
  ReferenceImage,
  ArchitecturalDoc,
  RoomMeasurements,
  StructuredPrompt,
  PreservationControls,
  GenerationMode,
  AIAnalysisResult
} from '../types';
import { analyzeWorkspace } from '../services/geminiService';

interface AIProjectSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGenerate: () => void;
  views: ViewImage[];
  references: ReferenceImage[];
  architecturalDocs: ArchitecturalDoc[];
  measurements: RoomMeasurements;
  structuredPrompt: StructuredPrompt;
  preservationControls: PreservationControls;
  generationMode: GenerationMode;
  spaceType?: string;
  selectedTargetCount?: number;
}

export const AIProjectSummaryModal: React.FC<AIProjectSummaryModalProps> = ({
  isOpen,
  onClose,
  onConfirmGenerate,
  views,
  references,
  architecturalDocs,
  measurements,
  structuredPrompt,
  preservationControls,
  generationMode,
  spaceType = 'Space',
  selectedTargetCount = 1,
}) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      analyzeWorkspace({
        views,
        references,
        architecturalDocs,
        measurements,
        structuredPrompt,
        preservationControls,
        generationMode
      })
        .then(res => setAnalysis(res))
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const preservedKeys = Object.entries(preservationControls)
    .filter(([_, val]) => Boolean(val))
    .map(([key, _]) => key);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 space-y-6"
      >

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
              <Brain size={20} />
            </div>
            <div>
              <h2 id="ai-summary-modal-title" className="text-base md:text-lg font-bold">AI Workspace & Readiness Summary</h2>
              <p className="text-xs text-slate-400">Pre-generation readiness score & spatial analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div role="status" aria-live="polite" className="py-12 text-center space-y-3">
            <Sparkles size={32} className="mx-auto text-emerald-400 animate-spin" />
            <p className="text-xs text-slate-300 font-semibold">
              Analyzing spatial geometry, camera perspectives, material links & readiness...
            </p>
          </div>
        ) : (
          analysis && (
            <div className="space-y-6 text-xs">
              {/* Score Gauge Banner */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-slate-950 border-4 border-emerald-500 shadow-lg shadow-emerald-950">
                    <span className="text-2xl font-black text-emerald-400">
                      {analysis.confidenceScore}%
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">
                      Readiness Confidence Score
                    </h3>
                    <p className="text-slate-400 mt-0.5">
                      {analysis.confidenceScore >= 85
                        ? 'Optimal multi-view & structured context ready for high-fidelity 2K render.'
                        : 'Good coverage. Consider adding a reference image or additional instructions.'}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Active Engine Mode</span>
                  <span className="text-amber-400 font-bold uppercase text-xs">
                    {generationMode.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Grid breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Detected Characteristics */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs text-emerald-400">
                    <Camera size={14} /> Space Type & View Targets
                  </span>
                  <p className="text-emerald-300 font-bold">Target Space: {spaceType}</p>
                  <p className="text-slate-300">
                    Target Images Selected: <span className="text-emerald-400 font-bold">{selectedTargetCount} of 5</span>
                  </p>
                  <p className="text-slate-400">{analysis.viewCoverageStatus}</p>
                  <p className="text-slate-400">{analysis.lightingConditions}</p>
                </div>

                {/* Materials & Style */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs text-purple-400">
                    <Layers size={14} /> Style & Materials Palette
                  </span>
                  <p className="text-slate-200 font-semibold">{structuredPrompt.interiorStyle || 'Custom Style'}</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.primaryMaterials.map((mat, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-md">
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Active Preservation Toggles */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 sm:col-span-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs text-blue-400">
                    <ShieldCheck size={14} /> Locked Architectural Elements
                  </span>
                  {preservedKeys.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {preservedKeys.map(key => (
                        <span key={key} className="px-2 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[10px] font-mono uppercase rounded-md">
                          🔒 {key}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No elements locked (Complete Redesign mode active)</p>
                  )}
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs text-amber-400">
                  <Sparkles size={14} /> AI Optimization Recommendations
                </span>
                <ul className="space-y-1 text-slate-400">
                  {analysis.designRecommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Readiness Checklist */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <span className="font-bold text-slate-200 text-xs">Readiness Audit</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {analysis.readinessChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800">
                      {item.status === 'pass' && <CheckCircle2 size={14} className="text-emerald-400" />}
                      {item.status === 'warning' && <AlertTriangle size={14} className="text-amber-400" />}
                      {item.status === 'info' && <Info size={14} className="text-blue-400" />}
                      <span className="text-slate-300 text-[11px]">{item.item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Adjust Workspace Settings
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onConfirmGenerate();
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950 flex items-center gap-2"
                >
                  <Sparkles size={16} /> Confirm & Launch 2K Render
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
