import React, { useState } from 'react';
import {
  Ruler,
  Upload,
  FileText,
  Trash2,
  Maximize2,
  Box,
  Compass,
  Building
} from 'lucide-react';
import { ArchitecturalDoc, DocType, RoomMeasurements, FileData } from '../types';

interface ArchitecturalPlansProps {
  docs: ArchitecturalDoc[];
  setDocs: React.Dispatch<React.SetStateAction<ArchitecturalDoc[]>>;
  measurements: RoomMeasurements;
  setMeasurements: React.Dispatch<React.SetStateAction<RoomMeasurements>>;
}

export const ArchitecturalPlans: React.FC<ArchitecturalPlansProps> = ({
  docs,
  setDocs,
  measurements,
  setMeasurements,
}) => {
  const [activeDocType, setActiveDocType] = useState<DocType>('floor_plan');
  const [previewDoc, setPreviewDoc] = useState<FileData | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, idx) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newDoc: ArchitecturalDoc = {
          id: `doc-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: activeDocType,
          fileData: {
            id: `file-doc-${Date.now()}-${idx}`,
            url: URL.createObjectURL(file),
            file: file,
            base64: base64,
            name: file.name,
            size: file.size,
            type: file.type
          },
          notes: ''
        };

        setDocs(prev => [...prev, newDoc]);
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteDoc = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const updateDocField = (id: string, field: keyof ArchitecturalDoc, value: any) => {
    setDocs(prev =>
      prev.map(d => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const calculateArea = (len: string, wid: string) => {
    const l = parseFloat(len);
    const w = parseFloat(wid);
    if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
      return (l * w).toFixed(1);
    }
    return '';
  };

  const handleDimensionChange = (field: keyof RoomMeasurements, value: string) => {
    setMeasurements(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'length' || field === 'width') {
        const area = calculateArea(updated.length, updated.width);
        if (area) {
          updated.totalArea = `${area} ${updated.unit === 'meters' ? 'sq m' : 'sq ft'}`;
        }
      }
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      {/* Room Dimensions & Spatial Parameters Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Ruler size={20} className="text-blue-400" />
          Room Dimensions & Spatial Parameters
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Specify exact room dimensions, ceiling height, and architectural features to guide 3D perspective and spatial scale.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Length</label>
            <input
              type="text"
              value={measurements.length}
              onChange={e => handleDimensionChange('length', e.target.value)}
              placeholder="e.g. 12.5"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Width</label>
            <input
              type="text"
              value={measurements.width}
              onChange={e => handleDimensionChange('width', e.target.value)}
              placeholder="e.g. 4.8"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Ceiling Height</label>
            <input
              type="text"
              value={measurements.height}
              onChange={e => handleDimensionChange('height', e.target.value)}
              placeholder="e.g. 3.2"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Unit</label>
            <select
              value={measurements.unit}
              onChange={e => setMeasurements(prev => ({ ...prev, unit: e.target.value as any }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="meters">Meters (m)</option>
              <option value="feet">Feet (ft)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Calculated Area</label>
            <input
              type="text"
              value={measurements.totalArea || calculateArea(measurements.length, measurements.width)}
              onChange={e => setMeasurements(prev => ({ ...prev, totalArea: e.target.value }))}
              placeholder="Total area"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-blue-400 font-bold focus:outline-none"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-slate-400 font-medium mb-1">
              Special Architectural Features & Structural Notes
            </label>
            <input
              type="text"
              value={measurements.specialFeatures}
              onChange={e => setMeasurements(prev => ({ ...prev, specialFeatures: e.target.value }))}
              placeholder="e.g. Structural columns spaced 3m apart, recessed LED cove lighting, arched doorway portals"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Floor Plans, CAD & PDF Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-blue-400" />
              Floor Plans, CAD Drawings & Sketches
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload PDF layouts, CAD exports, hand sketches, or architectural blueprints to assist spatial structure.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Document Type:</span>
            <select
              value={activeDocType}
              onChange={e => setActiveDocType(e.target.value as DocType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="floor_plan">Floor Plan (2D)</option>
              <option value="cad_drawing">CAD Drawing / Blueprint</option>
              <option value="pdf">PDF Specification Document</option>
              <option value="sketch">Architectural Sketch</option>
              <option value="measurement_sheet">Measurement Sheet</option>
            </select>
          </div>
        </div>

        {/* Upload Zone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 hover:bg-slate-950 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
          <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-blue-950/80 flex items-center justify-center mb-3 transition-colors">
            <Upload size={22} className="text-slate-400 group-hover:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-300">
            Upload Architectural Document [{activeDocType.replace('_', ' ').toUpperCase()}]
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Image files or blueprints (PNG, JPG, WEBP)
          </span>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Uploaded Docs Grid */}
      {docs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md"
            >
              <div className="relative group rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                <img
                  src={doc.fileData.url}
                  alt={doc.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <button
                  onClick={() => setPreviewDoc(doc.fileData)}
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                >
                  <Maximize2 size={16} /> Preview
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={doc.title}
                  onChange={e => updateDocField(doc.id, 'title', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold uppercase text-[10px]">
                  {doc.type.replace('_', ' ')}
                </span>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  aria-label="Delete document"
                  title="Delete document"
                  className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={doc.notes}
                  onChange={e => updateDocField(doc.id, 'notes', e.target.value)}
                  placeholder="Notes (e.g. Main corridor circulation path)"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 placeholder-slate-600 focus:outline-none text-[10px]"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 relative shadow-2xl">
            <img
              src={previewDoc.url}
              alt={previewDoc.name || 'Preview'}
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
            <div className="p-3 text-center text-xs text-slate-300 font-medium">
              {previewDoc.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
