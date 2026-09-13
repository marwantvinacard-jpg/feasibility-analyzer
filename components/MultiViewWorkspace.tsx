import React, { useState } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  Link,
  MessageSquare,
  AlertCircle,
  Eye,
  CheckCircle,
  Tag,
  Maximize2,
  Plus,
  Layers,
  Building,
  TreePine,
  Home,
  Compass,
  CheckSquare,
  Square
} from 'lucide-react';
import { ViewImage, ViewCategory, PriorityLevel, ReferenceImage, FileData, SpaceType } from '../types';
import { VIEW_CATEGORIES, SPACE_TYPES } from '../constants';

interface MultiViewWorkspaceProps {
  views: ViewImage[];
  setViews: React.Dispatch<React.SetStateAction<ViewImage[]>>;
  references: ReferenceImage[];
  selectedTargetViewIds: string[];
  setSelectedTargetViewIds: React.Dispatch<React.SetStateAction<string[]>>;
  spaceType: string;
  setSpaceType: (type: string) => void;
}

export const MultiViewWorkspace: React.FC<MultiViewWorkspaceProps> = ({
  views,
  setViews,
  references,
  selectedTargetViewIds,
  setSelectedTargetViewIds,
  spaceType,
  setSpaceType,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [activeUploadCategory, setActiveUploadCategory] = useState<ViewCategory>('Front View');
  const [previewImageModal, setPreviewImageModal] = useState<FileData | null>(null);
  const [targetWarning, setTargetWarning] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newViewsList: ViewImage[] = [];
    const newTargetIds: string[] = [];

    Array.from(files).forEach((file: File, idx) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newViewId = `view-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
        const newView: ViewImage = {
          id: newViewId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: activeUploadCategory,
          fileData: {
            id: `file-${Date.now()}-${idx}`,
            url: URL.createObjectURL(file),
            file: file,
            base64: base64,
            name: file.name,
            size: file.size,
            type: file.type
          },
          customPrompt: '',
          priority: views.length === 0 ? 'high' : 'medium',
          notes: '',
          order: views.length + idx
        };

        setViews(prev => {
          const updated = [...prev, newView];
          return updated;
        });

        // Automatically select as target up to 5 max
        setSelectedTargetViewIds(prev => {
          if (prev.length < 5 && !prev.includes(newViewId)) {
            return [...prev, newViewId];
          }
          return prev;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleTargetView = (id: string) => {
    setTargetWarning(null);
    if (selectedTargetViewIds.includes(id)) {
      setSelectedTargetViewIds(prev => prev.filter(item => item !== id));
    } else {
      if (selectedTargetViewIds.length >= 5) {
        setTargetWarning("Maximum 5 target images can be selected at once for AI rendering. Deselect an existing target first.");
        return;
      }
      setSelectedTargetViewIds(prev => [...prev, id]);
    }
  };

  const selectFirst5Targets = () => {
    setTargetWarning(null);
    const first5 = views.slice(0, 5).map(v => v.id);
    setSelectedTargetViewIds(first5);
  };

  const clearAllTargets = () => {
    setTargetWarning(null);
    setSelectedTargetViewIds([]);
  };

  const updateViewField = <K extends keyof ViewImage>(id: string, field: K, value: ViewImage[K]) => {
    setViews(prev =>
      prev.map(v => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const moveViewOrder = (index: number, direction: 'up' | 'down') => {
    setViews(prev => {
      const newArr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      const temp = newArr[index];
      newArr[index] = newArr[targetIndex];
      newArr[targetIndex] = temp;
      return newArr;
    });
  };

  const deleteView = (id: string) => {
    setViews(prev => prev.filter(v => v.id !== id));
    setSelectedTargetViewIds(prev => prev.filter(item => item !== id));
  };

  const filteredViews = views.filter(v =>
    selectedCategoryFilter === 'All' ? true : v.category === selectedCategoryFilter
  );

  const spaceCategoryIcons: Record<string, any> = {
    'Corridor / Hallway': Compass,
    'Outdoor Space / Landscape': TreePine,
    'Guest Room / Bedroom': Home,
    'Hotel Suite': Building,
    'Facade & Exterior': Building,
    'Garden & Courtyard': TreePine,
    'Patio & Outdoor Lounge': Compass
  };

  return (
    <div className="space-y-6">
      
      {/* Space Type Selector Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Spatial Scope Selection
            </span>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Compass size={20} className="text-emerald-400" />
              Target Design Space Type
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose the architectural space type you are designing (Corridor, Outdoor Space, Suite, Room, Facade, Patio, etc.)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Space:</span>
            <select
              value={spaceType}
              onChange={e => setSpaceType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              {SPACE_TYPES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Selection Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          {SPACE_TYPES.slice(0, 8).map(st => {
            const isSelected = spaceType === st;
            return (
              <button
                key={st}
                onClick={() => setSpaceType(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{st}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Bar / Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Camera size={20} className="text-emerald-400" />
              Multi-View Upload & Target Selection (Up to 5 Target Images)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload multiple images for your target space ({spaceType}). Select up to 5 target images for simultaneous multi-angle AI renders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Upload Angle Category:</span>
            <select
              value={activeUploadCategory}
              onChange={e => setActiveUploadCategory(e.target.value as ViewCategory)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
            >
              {VIEW_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 hover:bg-slate-950 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
          <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-emerald-950/80 flex items-center justify-center mb-3 transition-colors">
            <Upload size={22} className="text-slate-400 group-hover:text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300">
            Click or drag multiple {spaceType} images here
          </span>
          <span className="text-xs text-slate-500 mt-1">
            PNG, JPG, WEBP • Upload up to 5 primary target view images or multi-angle photos
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Target Warning Banner */}
      {targetWarning && (
        <div className="bg-amber-950/80 border border-amber-800 text-amber-200 p-3 rounded-xl flex items-center justify-between text-xs">
          <span>{targetWarning}</span>
          <button
            onClick={() => setTargetWarning(null)}
            className="text-amber-400 font-bold hover:text-amber-100 underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Filter Pills & Target Batch Stats Bar */}
      {views.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Selected Target Images for Render:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700">
                {selectedTargetViewIds.length} / 5 Target Images
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={selectFirst5Targets}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Select First 5 Images
              </button>
              <button
                onClick={clearAllTargets}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Clear Targets
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-0.5 border-t border-slate-800/80 pt-2">
            <button
              onClick={() => setSelectedCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategoryFilter === 'All'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({views.length})
            </button>
            {VIEW_CATEGORIES.map(cat => {
              const count = views.filter(v => v.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    selectedCategoryFilter === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View Cards Grid */}
      {filteredViews.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <Camera size={40} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-300">No View Images Added for {spaceType} Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload images of your {spaceType} (front view, side view, ceiling, floor, or outdoor angle) to enable high-fidelity AI design generation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredViews.map((view, idx) => {
            const targetIndex = selectedTargetViewIds.indexOf(view.id);
            const isTarget = targetIndex !== -1;

            return (
              <div
                key={view.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all shadow-md relative ${
                  isTarget ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-800'
                }`}
              >
                {/* Card Top: Primary Target Badge & Quick Actions */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTargetView(view.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isTarget
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-700'
                      }`}
                      title={isTarget ? "Click to remove from target renders" : "Click to add as target render image (up to 5)"}
                    >
                      {isTarget ? (
                        <>
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span>Target View #{targetIndex + 1}</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} className="text-slate-500" />
                          <span>Set as Target View</span>
                        </>
                      )}
                    </button>
                    
                    <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveViewOrder(idx, 'up')}
                      disabled={idx === 0}
                      aria-label="Move view up"
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                      title="Move up"
                    >
                      <MoveUp size={14} />
                    </button>
                    <button
                      onClick={() => moveViewOrder(idx, 'down')}
                      disabled={idx === views.length - 1}
                      aria-label="Move view down"
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800"
                      title="Move down"
                    >
                      <MoveDown size={14} />
                    </button>
                    <button
                      onClick={() => deleteView(view.id)}
                      aria-label="Delete view"
                      className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors ml-1"
                      title="Delete view"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Main Content: Thumbnail + Editable Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Thumbnail & Preview */}
                  <div className="sm:col-span-5 relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video sm:aspect-square flex items-center justify-center">
                    <img
                      src={view.fileData.url}
                      alt={view.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      onClick={() => setPreviewImageModal(view.fileData)}
                      className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                    >
                      <Maximize2 size={16} /> Preview
                    </button>

                    {isTarget && (
                      <div className="absolute top-2 left-2 bg-emerald-950/90 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-700 shadow">
                        Target #{targetIndex + 1}
                      </div>
                    )}
                  </div>

                  {/* Settings & View Specific Prompts */}
                  <div className="sm:col-span-7 space-y-3 text-xs">
                    {/* View Title */}
                    <div>
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">
                        View Image Title
                      </label>
                      <input
                        type="text"
                        value={view.title}
                        onChange={e => updateViewField(view.id, 'title', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Front View Corridor / Patio Perspective"
                      />
                    </div>

                    {/* Category & Priority Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-0.5">
                          Category
                        </label>
                        <select
                          value={view.category}
                          onChange={e => updateViewField(view.id, 'category', e.target.value as ViewCategory)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-[11px]"
                        >
                          {VIEW_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-0.5">
                          Priority
                        </label>
                        <select
                          value={view.priority}
                          onChange={e => updateViewField(view.id, 'priority', e.target.value as PriorityLevel)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-[11px]"
                        >
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                      </div>
                    </div>

                    {/* View Specific Prompt Instruction */}
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-0.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} className="text-emerald-400" />
                          View-Specific AI Instruction
                        </span>
                      </label>
                      <textarea
                        rows={2}
                        value={view.customPrompt}
                        onChange={e => updateViewField(view.id, 'customPrompt', e.target.value)}
                        placeholder={`e.g. Redesign this ${spaceType} view with brass sconces, travertine, or teak decking...`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-[11px] resize-none"
                      />
                    </div>

                    {/* Linked Reference Sample */}
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-0.5 flex items-center gap-1">
                        <Link size={11} className="text-teal-400" />
                        Linked Inspiration Reference
                      </label>
                      <select
                        value={view.linkedReferenceId || ''}
                        onChange={e => updateViewField(view.id, 'linkedReferenceId', e.target.value || undefined)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500 text-[11px]"
                      >
                        <option value="">No Reference Linked</option>
                        {references.map(ref => (
                          <option key={ref.id} value={ref.id}>
                            [{ref.category}] {ref.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* AI Notes Field */}
                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
                        Architect / AI Notes
                      </label>
                      <input
                        type="text"
                        value={view.notes}
                        onChange={e => updateViewField(view.id, 'notes', e.target.value)}
                        placeholder="e.g. Lens distortion / specific lighting notes..."
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImageModal(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 relative shadow-2xl">
            <img
              src={previewImageModal.url}
              alt={previewImageModal.name || 'Preview'}
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
            <div className="p-3 text-center text-xs text-slate-300 font-medium">
              {previewImageModal.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
