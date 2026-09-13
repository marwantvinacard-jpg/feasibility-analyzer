import React, { useState } from 'react';
import {
  Library,
  Upload,
  Trash2,
  Tag,
  Maximize2,
  Sparkles,
  Layers,
  Palette
} from 'lucide-react';
import { ReferenceImage, ReferenceCategory, FileData } from '../types';
import { REFERENCE_CATEGORIES } from '../constants';

interface ReferenceLibraryProps {
  references: ReferenceImage[];
  setReferences: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;
}

export const ReferenceLibrary: React.FC<ReferenceLibraryProps> = ({
  references,
  setReferences,
}) => {
  const [activeCategory, setActiveCategory] = useState<ReferenceCategory>('Inspiration Images');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [previewImage, setPreviewImage] = useState<FileData | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, idx) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newRef: ReferenceImage = {
          id: `ref-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          category: activeCategory,
          fileData: {
            id: `file-ref-${Date.now()}-${idx}`,
            url: URL.createObjectURL(file),
            file: file,
            base64: base64,
            name: file.name,
            size: file.size,
            type: file.type
          },
          notes: ''
        };

        setReferences(prev => [...prev, newRef]);
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteReference = (id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id));
  };

  const updateReferenceField = (id: string, field: keyof ReferenceImage, value: any) => {
    setReferences(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const filteredReferences = references.filter(r =>
    selectedFilter === 'All' ? true : r.category === selectedFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Library size={20} className="text-teal-400" />
              Inspiration & Material Reference Library
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload mood boards, travertine samples, furniture catalogs, hotel brand references, and lighting inspiration. These images guide AI aesthetics without overriding room geometry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Category:</span>
            <select
              value={activeCategory}
              onChange={e => setActiveCategory(e.target.value as ReferenceCategory)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-medium"
            >
              {REFERENCE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-teal-500 bg-slate-950/60 hover:bg-slate-950 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
          <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-teal-950/80 flex items-center justify-center mb-3 transition-colors">
            <Upload size={22} className="text-slate-400 group-hover:text-teal-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200 group-hover:text-teal-300">
            Upload Reference Images for [{activeCategory}]
          </span>
          <span className="text-xs text-slate-500 mt-1">
            PNG, JPG, WEBP • Material swatches, mood boards, furniture references
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

      {/* Filter Tabs */}
      {references.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
          <button
            onClick={() => setSelectedFilter('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilter === 'All'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All References ({references.length})
          </button>
          {REFERENCE_CATEGORIES.map(cat => {
            const count = references.filter(r => r.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedFilter === cat
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reference Cards Grid */}
      {filteredReferences.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <Palette size={40} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-300">No Reference Images in Library</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload material swatches, mood boards, or hotel brand guidelines to steer the AI's aesthetic choices.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredReferences.map(ref => (
            <div
              key={ref.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-700 shadow-md space-y-3"
            >
              <div className="relative group rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                <img
                  src={ref.fileData.url}
                  alt={ref.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={() => setPreviewImage(ref.fileData)}
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                >
                  <Maximize2 size={16} /> Preview
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={ref.title}
                  onChange={e => updateReferenceField(ref.id, 'title', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs font-semibold focus:outline-none focus:border-teal-500"
                  placeholder="Reference Title"
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <select
                  value={ref.category}
                  onChange={e => updateReferenceField(ref.id, 'category', e.target.value as ReferenceCategory)}
                  className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-teal-400 font-medium focus:outline-none focus:border-teal-500 text-[10px]"
                >
                  {REFERENCE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <button
                  onClick={() => deleteReference(ref.id)}
                  aria-label="Remove reference"
                  className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors"
                  title="Remove reference"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={ref.notes}
                  onChange={e => updateReferenceField(ref.id, 'notes', e.target.value)}
                  placeholder="Notes (e.g. Travertine vein texture)"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 placeholder-slate-600 focus:outline-none text-[10px]"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 relative shadow-2xl">
            <img
              src={previewImage.url}
              alt={previewImage.name || 'Preview'}
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
            <div className="p-3 text-center text-xs text-slate-300 font-medium">
              {previewImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
