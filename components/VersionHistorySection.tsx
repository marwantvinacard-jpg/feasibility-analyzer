import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Eye,
  Sliders,
  Maximize2,
  Sparkles,
  Calendar,
  Clock,
  Layers,
  ArrowRightLeft,
  Wand2,
  Loader2
} from 'lucide-react';
import { ProjectVersion } from '../types';
import { enhanceImage } from '../services/api';

interface VersionHistorySectionProps {
  versions: ProjectVersion[];
  setVersions: React.Dispatch<React.SetStateAction<ProjectVersion[]>>;
  onRestoreVersion: (version: ProjectVersion) => void;
}

export const VersionHistorySection: React.FC<VersionHistorySectionProps> = ({
  versions,
  setVersions,
  onRestoreVersion,
}) => {
  const [selectedVersionForCompare, setSelectedVersionForCompare] = useState<ProjectVersion | null>(null);
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side'>('slider');
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const deleteVersion = (id: string) => {
    setVersions(prev => prev.filter(v => v.id !== id));
  };

  const handleEnhance = async (v: ProjectVersion) => {
    setEnhanceError(null);
    setEnhancingId(v.id);
    try {
      const result = await enhanceImage(v.generatedImageUrl, { scaleFactor: '2x', hdr: 2 });
      const enhancedVersion: ProjectVersion = {
        ...v,
        id: `v-enhanced-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        versionNumber: versions.length + 1,
        timestamp: new Date().toISOString(),
        generatedImageUrl: result.imageUrl,
        viewTitle: `${v.viewTitle} — Magnific Enhanced`,
      };
      setVersions(prev => [enhancedVersion, ...prev]);
    } catch (err: any) {
      if (err?.code === 'no_magnific_key') {
        setEnhanceError('Add your Magnific API key in Settings to enable enhancement.');
      } else {
        setEnhanceError(err?.message || 'Failed to enhance this render.');
      }
    } finally {
      setEnhancingId(null);
    }
  };

  const handleDownloadImage = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aibotsautomations-Architect-${title.replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-1">
          <History size={20} className="text-amber-400" />
          Project Version History & Iterations
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Review all previous AI design iterations, inspect parameters, download high-res renders, and compare renders directly with original camera views.
        </p>

        {enhanceError && (
          <div role="alert" className="mb-6 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between gap-3">
            <span>{enhanceError}</span>
            <button onClick={() => setEnhanceError(null)} className="font-bold underline hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {versions.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-12 text-center">
            <History size={40} className="mx-auto text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-300">No Generated Versions Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Once you generate AI renders from your workspace views, every iteration will be stored here with its master parameters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {versions.map(v => (
              <div
                key={v.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition-all"
              >
                {/* Version Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-950 border border-amber-800 text-amber-300 font-extrabold text-xs rounded-lg">
                      v{v.versionNumber}
                    </span>
                    <div>
                      <h3 className="font-bold text-xs text-slate-100">{v.viewTitle}</h3>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={11} /> {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {v.generationMode.replace('_', ' ')}
                  </span>
                </div>

                {/* Main Render Image */}
                <div className="relative group rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800">
                  <img
                    src={v.generatedImageUrl}
                    alt={`Version ${v.versionNumber}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {v.originalViewUrl && (
                      <button
                        onClick={() => setSelectedVersionForCompare(v)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5"
                      >
                        <ArrowRightLeft size={14} /> Compare Before/After
                      </button>
                    )}
                    <button
                      onClick={() => handleDownloadImage(v.generatedImageUrl, v.viewTitle)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5"
                    >
                      <Download size={14} /> Download 2K
                    </button>
                    <button
                      onClick={() => handleEnhance(v)}
                      disabled={enhancingId === v.id}
                      className="px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-bold rounded-lg border border-purple-800 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {enhancingId === v.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Enhancing…
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} /> Enhance with Magnific
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Parameter Snippet */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-[11px] space-y-1 text-slate-400">
                  <p><strong className="text-slate-300">Style:</strong> {v.structuredPrompt.interiorStyle || 'Custom Style'}</p>
                  <p><strong className="text-slate-300">Materials:</strong> {v.structuredPrompt.materials || 'Specified'}</p>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <button
                    onClick={() => onRestoreVersion(v)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Sliders size={13} /> Restore Prompt Settings
                  </button>

                  <button
                    onClick={() => deleteVersion(v.id)}
                    aria-label="Delete version"
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/40"
                    title="Delete version"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Before / After Comparison Modal */}
      {selectedVersionForCompare && selectedVersionForCompare.originalViewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full p-6 text-slate-100 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-emerald-400" />
                  Before / After Render Comparison — v{selectedVersionForCompare.versionNumber} ({selectedVersionForCompare.viewTitle})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompareMode('slider')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    compareMode === 'slider' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Split Slider
                </button>
                <button
                  onClick={() => setCompareMode('side-by-side')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    compareMode === 'side-by-side' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setSelectedVersionForCompare(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Comparison Display */}
            {compareMode === 'slider' ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 select-none">
                {/* Original Image (Background) */}
                <img
                  src={selectedVersionForCompare.originalViewUrl}
                  alt="Original View"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-slate-950/80 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg shadow">
                  Original Uploaded Photo
                </span>

                {/* Generated Image (Foreground Clipped) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={selectedVersionForCompare.generatedImageUrl}
                    alt="AI Render"
                    className="absolute inset-0 w-full h-full object-cover max-w-none"
                    style={{ width: '100%', height: '100%' }}
                  />
                  <span className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-xs font-bold rounded-lg shadow">
                    AI Studio Render
                  </span>
                </div>

                {/* Interactive Slider Bar */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-emerald-400 cursor-ew-resize z-20 flex items-center justify-center shadow-2xl"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xl">
                    ↔
                  </div>
                </div>

                {/* Hidden Native Range Input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={e => setSliderPosition(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400">Original Uploaded Room Photo</span>
                  <img
                    src={selectedVersionForCompare.originalViewUrl}
                    alt="Original View"
                    className="w-full aspect-video object-cover rounded-xl border border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400">AI Studio Rendered Output</span>
                  <img
                    src={selectedVersionForCompare.generatedImageUrl}
                    alt="AI Render"
                    className="w-full aspect-video object-cover rounded-xl border border-emerald-800/80"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
