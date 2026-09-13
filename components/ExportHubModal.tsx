import React from 'react';
import {
  Download,
  FileText,
  FileCode,
  Copy,
  Printer,
  Sparkles,
  Check,
  Building,
  Layers,
  BookOpen
} from 'lucide-react';
import {
  ProjectInfo,
  ViewImage,
  ReferenceImage,
  ArchitecturalDoc,
  RoomMeasurements,
  StructuredPrompt,
  PreservationControls,
  GenerationMode,
  ProjectVersion
} from '../types';

interface ExportHubModalProps {
  projectInfo: ProjectInfo;
  views: ViewImage[];
  references: ReferenceImage[];
  docs: ArchitecturalDoc[];
  measurements: RoomMeasurements;
  structuredPrompt: StructuredPrompt;
  preservationControls: PreservationControls;
  generationMode: GenerationMode;
  versions: ProjectVersion[];
  onSaveJSON: () => void;
}

export const ExportHubModal: React.FC<ExportHubModalProps> = ({
  projectInfo,
  views,
  references,
  docs,
  measurements,
  structuredPrompt,
  preservationControls,
  generationMode,
  versions,
  onSaveJSON,
}) => {
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);

  const generateMasterPromptText = () => {
    return `
=== AIBOTSAUTOMATIONS ARCHITECT - MASTER STUDIO PROMPT ===
PROJECT: ${projectInfo.name} (${projectInfo.projectType})
CLIENT: ${projectInfo.clientName || 'N/A'} | ROOM: ${projectInfo.roomName || 'Primary Room'}
LEAD DESIGNER: ${projectInfo.designerName || 'N/A'}
GENERATION ENGINE MODE: ${generationMode.toUpperCase()}

1. DESIGN DIRECTION & GOALS
- Project Goal: ${structuredPrompt.projectGoal || 'Luxury Interior Redesign'}
- Style: ${structuredPrompt.interiorStyle || 'Modern Luxury'}
- Materials Palette: ${structuredPrompt.materials || 'Not specified'}
- Color Palette: ${structuredPrompt.colors || 'Warm Neutral Palette'}
- Lighting Scheme: ${structuredPrompt.lighting || 'Warm 2700K indirect cove LED'}
- Furniture Style: ${structuredPrompt.furnitureStyle || 'Bespoke Modern Luxury'}
- Decorative Style: ${structuredPrompt.decorativeStyle || 'Sculptural artwork & ceramic details'}
- Ambiance / Mood: ${structuredPrompt.mood || 'Serene, opulent, and welcoming'}
- Brand Guidelines: ${structuredPrompt.brandGuidelines || '5-star hospitality luxury standard'}

2. PRESERVATION & RESTRUCTURING RULES
- Explicitly Preserved: ${structuredPrompt.elementsToPreserveText || 'Core spatial geometry and main windows'}
- Explicitly Replaced: ${structuredPrompt.elementsToReplaceText || 'Worn finishes, carpeting, and lighting'}
- Architectural Constraints: ${structuredPrompt.architecturalConstraints || 'Maintain structural shell'}

3. MEASUREMENTS & SPATIAL BOUNDS
- Dimensions: ${measurements.length || 'N/A'} x ${measurements.width || 'N/A'} ${measurements.unit} (Height: ${measurements.height || 'N/A'})
- Total Area: ${measurements.totalArea || 'N/A'}
- Special Features: ${measurements.specialFeatures || 'Standard camera perspective'}

4. WORKSPACE CONTENT
- Room Views Count: ${views.length}
- Reference Images Count: ${references.length}
- Architectural Plans Count: ${docs.length}
`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generateMasterPromptText());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handlePrintPDFPresentation = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const latestVersion = versions[0];

    // Every field below can contain arbitrary user input (project/client/
    // designer names, style text). Escape it before it goes into
    // document.write() — otherwise a project named e.g. `<img
    // src=x onerror=...>` executes script in this (same-origin) window.
    const esc = (value: unknown): string =>
      String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch] as string));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${esc(projectInfo.name)} - Architectural Presentation Deck</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #fff; }
            .header { border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .logo { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
            .logo span { color: #10b981; }
            .project-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
            .section-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; color: #0f172a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
            .card-title { font-weight: 700; font-size: 13px; color: #334155; margin-bottom: 8px; }
            .card-desc { font-size: 12px; color: #475569; line-height: 1.5; }
            .image-container { margin-top: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; }
            .image-container img { width: 100%; height: auto; display: block; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; pt: 15px; text-align: center; font-size: 11px; color: #94a3b8; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Aibotsautomations <span>Architect</span></div>
              <div class="project-meta">${esc(projectInfo.name)} • ${esc(projectInfo.projectType)} • Client: ${esc(projectInfo.clientName || 'N/A')}</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #64748b;">
              <div>Date: ${esc(new Date().toLocaleDateString())}</div>
              <div>Lead Designer: ${esc(projectInfo.designerName || 'N/A')}</div>
            </div>
          </div>

          <div class="section-title">PROJECT SPECIFICATIONS & MATERIAL PALETTE</div>
          <div class="grid">
            <div class="card">
              <div class="card-title">Interior Style & Goal</div>
              <div class="card-desc">
                <strong>Goal:</strong> ${esc(structuredPrompt.projectGoal || 'Luxury Redesign')}<br/>
                <strong>Style:</strong> ${esc(structuredPrompt.interiorStyle || 'Modern Luxury')}<br/>
                <strong>Ambiance:</strong> ${esc(structuredPrompt.mood || 'Serene & Inviting')}
              </div>
            </div>
            <div class="card">
              <div class="card-title">Materials & Lighting</div>
              <div class="card-desc">
                <strong>Materials:</strong> ${esc(structuredPrompt.materials || 'Not specified')}<br/>
                <strong>Colors:</strong> ${esc(structuredPrompt.colors || 'Warm neutrals')}<br/>
                <strong>Lighting:</strong> ${esc(structuredPrompt.lighting || 'Warm 2700K indirect cove LED')}
              </div>
            </div>
          </div>

          ${
            latestVersion
              ? `
            <div class="section-title">PRIMARY AI INTERIOR RENDER (v${esc(latestVersion.versionNumber)})</div>
            <div class="image-container">
              <img src="${esc(latestVersion.generatedImageUrl)}" alt="AI Render" />
            </div>
            `
              : ''
          }

          <div class="footer">
            Generated by Aibotsautomations Architect Studio • Confidential Architectural Client Presentation
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadExecutiveReport = () => {
    const reportContent = `
# Aibotsautomations Architect — Executive AI Design Report
**Project Name:** ${projectInfo.name}
**Project Type:** ${projectInfo.projectType}
**Client:** ${projectInfo.clientName || 'N/A'}
**Room / Space:** ${projectInfo.roomName || 'Primary Space'}
**Lead Designer:** ${projectInfo.designerName || 'N/A'}
**Date:** ${new Date().toLocaleDateString()}

---

## 1. Project Overview & Design Intent
- **Design Goal:** ${structuredPrompt.projectGoal}
- **Primary Interior Style:** ${structuredPrompt.interiorStyle}
- **Ambiance & Mood:** ${structuredPrompt.mood}
- **Brand Guidelines:** ${structuredPrompt.brandGuidelines}

## 2. Material & FF&E Specifications
- **Materials Palette:** ${structuredPrompt.materials}
- **Color Palette:** ${structuredPrompt.colors}
- **Lighting Scheme:** ${structuredPrompt.lighting}
- **Furniture Style:** ${structuredPrompt.furnitureStyle}
- **Decorative Style:** ${structuredPrompt.decorativeStyle}

## 3. Preservation & Architectural Constraints
- **Preserved Elements:** ${structuredPrompt.elementsToPreserveText}
- **Replaced Elements:** ${structuredPrompt.elementsToReplaceText}
- **Architectural Constraints:** ${structuredPrompt.architecturalConstraints}

## 4. Room Measurements
- **Dimensions:** ${measurements.length} x ${measurements.width} ${measurements.unit} (Height: ${measurements.height})
- **Total Area:** ${measurements.totalArea}
- **Special Features:** ${measurements.specialFeatures}

## 5. Workspace Assets Audit
- **Room Views Uploaded:** ${views.length} view(s)
- **Reference Library Assets:** ${references.length} asset(s)
- **Architectural Plans Uploaded:** ${docs.length} plan(s)
- **Design Iterations Generated:** ${versions.length} version(s)

---
*Generated by Aibotsautomations Architect Studio Engine*
`;

    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aibotsautomations-Executive-Report-${projectInfo.name.replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Download size={20} className="text-emerald-400" />
          Enterprise Export Suite
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Generate client-ready PDF presentation decks, backup project workspace data, copy master AI prompt specifications, or download executive markdown reports.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PDF Presentation Deck */}
          <button
            type="button"
            onClick={handlePrintPDFPresentation}
            className="text-left p-5 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-2xl cursor-pointer transition-all space-y-3 group"
          >
            <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <Printer size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                PDF Presentation Deck
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Formats clean client-ready deck with project specs and latest 2K render.
              </p>
            </div>
          </button>

          {/* Backup Project JSON */}
          <button
            type="button"
            onClick={onSaveJSON}
            className="text-left p-5 bg-slate-950 border border-slate-800 hover:border-blue-500 rounded-2xl cursor-pointer transition-all space-y-3 group"
          >
            <div className="p-3 bg-blue-950 border border-blue-800 text-blue-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <FileCode size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                Project JSON Backup
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Downloads complete studio project data including images, views, and versions.
              </p>
            </div>
          </button>

          {/* Copy Master Prompt */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            aria-live="polite"
            className="text-left p-5 bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-2xl cursor-pointer transition-all space-y-3 group"
          >
            <div className="p-3 bg-purple-950 border border-purple-800 text-purple-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              {copiedPrompt ? <Check size={22} className="text-emerald-400" /> : <Copy size={22} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                {copiedPrompt ? 'Master Prompt Copied!' : 'Copy Master AI Prompt'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Copies structured architectural master prompt string to clipboard.
              </p>
            </div>
          </button>

          {/* Executive Markdown Report */}
          <button
            type="button"
            onClick={handleDownloadExecutiveReport}
            className="text-left p-5 bg-slate-950 border border-slate-800 hover:border-amber-500 rounded-2xl cursor-pointer transition-all space-y-3 group"
          >
            <div className="p-3 bg-amber-950 border border-amber-800 text-amber-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                Executive Design Report
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Exports formatted Markdown report with full material and spatial specifications.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
