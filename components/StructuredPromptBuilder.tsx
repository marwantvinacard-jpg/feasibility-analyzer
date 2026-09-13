import React from 'react';
import {
  Sliders,
  Sparkles,
  RotateCcw,
  BookOpen,
  Layers,
  Palette,
  Lightbulb,
  Armchair,
  CheckCircle2,
  Building,
  Volume2
} from 'lucide-react';
import { StructuredPrompt, StyleDirection } from '../types';
import { STYLE_DIRECTIONS, DEFAULT_STRUCTURED_PROMPT } from '../constants';
import { VoiceRecorder } from './VoiceRecorder';

interface StructuredPromptBuilderProps {
  prompt: StructuredPrompt;
  setPrompt: React.Dispatch<React.SetStateAction<StructuredPrompt>>;
  selectedStyle: StyleDirection;
  setSelectedStyle: (style: StyleDirection) => void;
}

export const StructuredPromptBuilder: React.FC<StructuredPromptBuilderProps> = ({
  prompt,
  setPrompt,
  selectedStyle,
  setSelectedStyle,
}) => {
  const updateField = (field: keyof StructuredPrompt, value: string) => {
    setPrompt(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleSelect = (style: StyleDirection) => {
    setSelectedStyle(style);
    setPrompt(prev => ({
      ...prev,
      interiorStyle: style.title
    }));
  };

  const loadDefaultTemplate = () => {
    setPrompt({ ...DEFAULT_STRUCTURED_PROMPT });
  };

  const clearPrompt = () => {
    setPrompt({
      projectGoal: '',
      interiorStyle: '',
      materials: '',
      colors: '',
      lighting: '',
      furnitureStyle: '',
      decorativeStyle: '',
      mood: '',
      architecturalConstraints: '',
      elementsToPreserveText: '',
      elementsToReplaceText: '',
      brandGuidelines: '',
      additionalInstructions: ''
    });
  };

  const materialSuggestions = [
    'Honed Italian Travertine',
    'Fluted Dark Walnut',
    'Champagne Brass',
    'Bouclé Fabric',
    'Calacatta Marble',
    'Textured Lime Wash Plaster',
    'Herringbone Oak'
  ];

  const colorSuggestions = [
    'Warm Ivory & Champagne',
    'Terracotta & Muted Gold',
    'Deep Olive & Walnut',
    'Cream & Brushed Bronze',
    'Sandstone & Matte Black'
  ];

  const lightingSuggestions = [
    'Warm 2700K Indirect Cove LED',
    'Recessed Minimal Spotlights',
    'Alabaster Wall Sconces',
    'Linear Brass Pendant',
    'Concealed Architectural Strip'
  ];

  const appendSuggestion = (field: keyof StructuredPrompt, text: string) => {
    setPrompt(prev => {
      const current = prev[field];
      if (!current) return { ...prev, [field]: text };
      if (current.includes(text)) return prev;
      return { ...prev, [field]: `${current}, ${text}` };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Style Direction Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sliders size={20} className="text-purple-400" />
              Structured AI Prompt Builder
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Construct high-fidelity architectural instructions with dedicated interior design categories rather than raw free-text.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDefaultTemplate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>Load 5-Star Hotel Preset</span>
            </button>
            <button
              onClick={clearPrompt}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset Fields</span>
            </button>
          </div>
        </div>

        {/* Style Preset Direction Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Select Primary Interior Style Direction
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STYLE_DIRECTIONS.map(style => {
              const isSelected = selectedStyle.id === style.id;
              return (
                <div
                  key={style.id}
                  onClick={() => handleStyleSelect(style)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500 ring-1 ring-purple-500/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-100">{style.title}</span>
                    {isSelected && <CheckCircle2 size={14} className="text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {style.description.join(' • ')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Structured Multi-Field Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-xs border-b border-slate-800 pb-3">
          Interior Architecture Specification Fields
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Project Goal */}
          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <BookOpen size={14} className="text-purple-400" />
              1. Project Goal & Design Purpose
            </label>
            <input
              type="text"
              value={prompt.projectGoal}
              onChange={e => updateField('projectGoal', e.target.value)}
              placeholder="e.g. Redesign luxury hotel suite corridor for 5-star rating"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Interior Style */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Layers size={14} className="text-purple-400" />
              2. Interior Style
            </label>
            <input
              type="text"
              value={prompt.interiorStyle}
              onChange={e => updateField('interiorStyle', e.target.value)}
              placeholder="e.g. Modern Mediterranean Luxury"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Materials */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Layers size={14} className="text-teal-400" />
              3. Materials & Textures
            </label>
            <input
              type="text"
              value={prompt.materials}
              onChange={e => updateField('materials', e.target.value)}
              placeholder="e.g. Honed Travertine, Fluted Dark Walnut, Champagne Brass"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {materialSuggestions.map(mat => (
                <button
                  key={mat}
                  type="button"
                  onClick={() => appendSuggestion('materials', mat)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded-md transition-colors"
                >
                  + {mat}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Palette size={14} className="text-pink-400" />
              4. Color Palette
            </label>
            <input
              type="text"
              value={prompt.colors}
              onChange={e => updateField('colors', e.target.value)}
              placeholder="e.g. Warm Ivory, Terracotta, Muted Sage, Muted Gold"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {colorSuggestions.map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => appendSuggestion('colors', col)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded-md transition-colors"
                >
                  + {col}
                </button>
              ))}
            </div>
          </div>

          {/* Lighting */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-amber-400" />
              5. Lighting Scheme
            </label>
            <input
              type="text"
              value={prompt.lighting}
              onChange={e => updateField('lighting', e.target.value)}
              placeholder="e.g. Warm 2700K indirect cove LED, ambient alabaster sconces"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {lightingSuggestions.map(lig => (
                <button
                  key={lig}
                  type="button"
                  onClick={() => appendSuggestion('lighting', lig)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded-md transition-colors"
                >
                  + {lig}
                </button>
              ))}
            </div>
          </div>

          {/* Furniture Style */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Armchair size={14} className="text-emerald-400" />
              6. Furniture Style (FF&E)
            </label>
            <input
              type="text"
              value={prompt.furnitureStyle}
              onChange={e => updateField('furnitureStyle', e.target.value)}
              placeholder="e.g. Bespoke Italian curved seating, low-profile minimalist credenza"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Decorative Style */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-400" />
              7. Decorative Style & Artwork
            </label>
            <input
              type="text"
              value={prompt.decorativeStyle}
              onChange={e => updateField('decorativeStyle', e.target.value)}
              placeholder="e.g. Sculptural ceramic vases, gallery wall with architectural sketches"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Mood */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              8. Ambiance & Mood
            </label>
            <input
              type="text"
              value={prompt.mood}
              onChange={e => updateField('mood', e.target.value)}
              placeholder="e.g. Serene, prestigious, warm, and inviting luxury"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Brand Guidelines */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Building size={14} className="text-indigo-400" />
              9. Brand Guidelines & Identity
            </label>
            <input
              type="text"
              value={prompt.brandGuidelines}
              onChange={e => updateField('brandGuidelines', e.target.value)}
              placeholder="e.g. Hyatt Regency luxury standards with subtle tactile sophistication"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Architectural Constraints */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              10. Architectural Constraints
            </label>
            <input
              type="text"
              value={prompt.architecturalConstraints}
              onChange={e => updateField('architecturalConstraints', e.target.value)}
              placeholder="e.g. Structural columns cannot be moved. Maintain ceiling height 3.2m."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Elements to Preserve Text */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 text-emerald-400">
              11. Elements to Explicitly Preserve
            </label>
            <input
              type="text"
              value={prompt.elementsToPreserveText}
              onChange={e => updateField('elementsToPreserveText', e.target.value)}
              placeholder="e.g. Keep main doorway portals, windows, and ceiling beams"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Elements to Replace Text */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 text-rose-400">
              12. Elements to Explicitly Replace
            </label>
            <input
              type="text"
              value={prompt.elementsToReplaceText}
              onChange={e => updateField('elementsToReplaceText', e.target.value)}
              placeholder="e.g. Replace worn carpeting with travertine tiles and runner"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Additional Instructions & Voice Input */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-bold">
                13. Additional Designer Instructions & Voice Dictation
              </label>
              <VoiceRecorder
                onTranscript={text => appendSuggestion('additionalInstructions', text)}
              />
            </div>
            <textarea
              rows={3}
              value={prompt.additionalInstructions}
              onChange={e => updateField('additionalInstructions', e.target.value)}
              placeholder="Type or dictate additional instructions (e.g. Ensure soft sunlight shadows filter through window louvers)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 font-medium focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
