import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ProjectHeader } from "../components/ProjectHeader";
import { MultiViewWorkspace } from "../components/MultiViewWorkspace";
import { ReferenceLibrary } from "../components/ReferenceLibrary";
import { ArchitecturalPlans } from "../components/ArchitecturalPlans";
import { StructuredPromptBuilder } from "../components/StructuredPromptBuilder";
import { PreservationControlsPanel } from "../components/PreservationControlsPanel";
import { GenerationModeSelector } from "../components/GenerationModeSelector";
import { AIProjectSummaryModal } from "../components/AIProjectSummaryModal";
import { RenderProgressModal } from "../components/RenderProgressModal";
import { VersionHistorySection } from "../components/VersionHistorySection";
import { ExportHubModal } from "../components/ExportHubModal";
import { Logo } from "../components/Logo";
import { AccountGate } from "../components/AccountGate";
import { AIDisclaimer } from "../components/AIDisclaimer";

import {
  ProjectInfo,
  ViewImage,
  ReferenceImage,
  ArchitecturalDoc,
  RoomMeasurements,
  StructuredPrompt,
  PreservationControls,
  GenerationMode,
  ProjectVersion,
  StyleDirection,
} from "../types";
import { DEFAULT_STRUCTURED_PROMPT, STYLE_DIRECTIONS } from "../constants";
import { generateStudioDesign } from "../services/geminiService";
import { getApiKeyStatus } from "../services/api";
import { Key } from "lucide-react";

export const ProStudioPage: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  useEffect(() => {
    getApiKeyStatus()
      .then(setHasApiKey)
      .catch(() => setHasApiKey(false));
  }, []);

  // 1. Project Info State
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: "Aibotsautomations Architect Studio",
    projectType: "Hotel & Resort",
    spaceType: "Corridor / Hallway",
    clientName: "Grand Luxury Hospitality",
    roomName: "Presidential Suite Corridor View",
    designerName: "Studio Designer",
    status: "In Progress",
    notes: "Enterprise 5-star renovation project",
  });

  // 2. Workspace Uploads & Specs State
  const [views, setViews] = useState<ViewImage[]>([]);
  const [selectedTargetViewIds, setSelectedTargetViewIds] = useState<string[]>([]);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [docs, setDocs] = useState<ArchitecturalDoc[]>([]);

  // Batch rendering progress state
  const [currentRenderingIndex, setCurrentRenderingIndex] = useState<number>(1);
  const [currentRenderingTitle, setCurrentRenderingTitle] = useState<string>(
    "Primary Target View"
  );

  // 3. Spatial Measurements
  const [measurements, setMeasurements] = useState<RoomMeasurements>({
    length: "12.5",
    width: "4.8",
    height: "3.2",
    unit: "meters",
    totalArea: "60.0 sq m",
    specialFeatures:
      "Recessed door portals, cove LED ceiling, structural columns",
  });

  // 4. Structured Prompt & Selected Style
  const [structuredPrompt, setStructuredPrompt] = useState<StructuredPrompt>({
    ...DEFAULT_STRUCTURED_PROMPT,
  });
  const [selectedStyle, setSelectedStyle] = useState<StyleDirection>(
    STYLE_DIRECTIONS[0]
  );

  // 5. Preservation Rules
  const [preservationControls, setPreservationControls] =
    useState<PreservationControls>({
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
      structuralElements: true,
    });

  // 6. Generation Engine Mode, Design Brain & History
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("professional_design");
  const [designBrainId, setDesignBrainId] = useState<string>("luxury-hospitality");
  const [versions, setVersions] = useState<ProjectVersion[]>([]);

  // 7. Navigation & Modals
  const [activeTab, setActiveTab] = useState<string>("views");
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Export JSON Backup
  const handleSaveProjectJSON = () => {
    const backupData = {
      projectInfo,
      views,
      references,
      docs,
      measurements,
      structuredPrompt,
      preservationControls,
      generationMode,
      designBrainId,
      versions,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectInfo.name.replace(/\s+/g, "-")}-Backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Load JSON Backup
  const handleLoadProjectJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.projectInfo) setProjectInfo(json.projectInfo);
        if (Array.isArray(json.views)) setViews(json.views);
        if (Array.isArray(json.references)) setReferences(json.references);
        if (Array.isArray(json.docs)) setDocs(json.docs);
        if (json.measurements) setMeasurements(json.measurements);
        if (json.structuredPrompt) setStructuredPrompt(json.structuredPrompt);
        if (json.preservationControls)
          setPreservationControls(json.preservationControls);
        if (json.generationMode) setGenerationMode(json.generationMode);
        if (json.designBrainId) setDesignBrainId(json.designBrainId);
        if (Array.isArray(json.versions)) setVersions(json.versions);
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage("Failed to parse project JSON backup file.");
      }
    };
    reader.readAsText(file);
  };

  // Reset Project
  const handleResetProject = () => {
    if (
      window.confirm(
        "Are you sure you want to reset the current workspace? All unsaved views will be cleared."
      )
    ) {
      setViews([]);
      setSelectedTargetViewIds([]);
      setReferences([]);
      setDocs([]);
      setStructuredPrompt({ ...DEFAULT_STRUCTURED_PROMPT });
      setVersions([]);
    }
  };

  // Execute AI Render Generation across selected target view images (up to 5)
  const handleExecuteGenerate = async () => {
    if (views.length === 0) {
      setErrorMessage(
        "Please upload at least one view image in the Workspace before rendering."
      );
      return;
    }
    if (!hasApiKey) {
      setErrorMessage("Add your Gemini API key in Settings before rendering.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    let targetsToProcess = views
      .filter((v) => selectedTargetViewIds.includes(v.id))
      .slice(0, 5);
    if (targetsToProcess.length === 0) {
      targetsToProcess = [views[0]];
    }

    setCurrentRenderingIndex(0);
    setCurrentRenderingTitle(targetsToProcess[0]?.title || "Target View");

    // Render up to 3 target views concurrently instead of one at a time —
    // 5 sequential Gemini calls could take minutes; this cuts that roughly
    // 3x while staying under the per-user rate limit. Each successful
    // render is committed to `versions` the moment it completes, so one
    // failed target no longer wipes out the others that already succeeded.
    const CONCURRENCY = 3;
    let completedCount = 0;
    let fatalAuthError: { code: string; message: string } | null = null;
    const failures: string[] = [];

    const runOne = async (targetView: ViewImage, idx: number) => {
      if (fatalAuthError) return; // stop starting new work once the key itself is bad

      const spaceAwarePrompt: StructuredPrompt = {
        ...structuredPrompt,
        projectGoal: `${structuredPrompt.projectGoal} [Space Type: ${
          projectInfo.spaceType || "Corridor"
        }]`,
        additionalInstructions: `${
          structuredPrompt.additionalInstructions || ""
        } [Ensure architectural rendering matches ${
          projectInfo.spaceType || "space"
        } perspective]`,
      };

      try {
        const result = await generateStudioDesign({
          views,
          references,
          architecturalDocs: docs,
          measurements,
          structuredPrompt: spaceAwarePrompt,
          preservationControls,
          generationMode,
          targetViewId: targetView.id,
          designBrainId,
        });

        const newVersion: ProjectVersion = {
          id: `v-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          versionNumber: versions.length + idx + 1,
          timestamp: new Date().toISOString(),
          generatedImageUrl: result.imageUrl,
          originalViewUrl: targetView.fileData.url,
          viewTitle: `[${projectInfo.spaceType || "Space"}] ${targetView.title}`,
          structuredPrompt: { ...structuredPrompt },
          preservationControls: { ...preservationControls },
          generationMode,
          promptUsed: result.promptUsed,
        };

        // Committed immediately — survives any later target's failure.
        setVersions((prev) => [newVersion, ...prev]);
      } catch (err: any) {
        console.error(`Design Generation Error (${targetView.title}):`, err);
        if (err?.code === "no_api_key" || err?.code === "invalid_key") {
          fatalAuthError = { code: err.code, message: err.message };
        } else {
          failures.push(targetView.title || `View ${idx + 1}`);
        }
      } finally {
        completedCount += 1;
        setCurrentRenderingIndex(completedCount);
      }
    };

    // Simple concurrency-limited pool over targetsToProcess.
    let cursor = 0;
    const worker = async () => {
      while (cursor < targetsToProcess.length) {
        const idx = cursor++;
        setCurrentRenderingTitle(
          targetsToProcess[idx].title || `Target View ${idx + 1}`
        );
        await runOne(targetsToProcess[idx], idx);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targetsToProcess.length) }, worker)
    );

    setIsGenerating(false);

    if (fatalAuthError) {
      if (fatalAuthError.code === "no_api_key") {
        setHasApiKey(false);
        setErrorMessage("Add your Gemini API key in Settings before rendering.");
      } else {
        setErrorMessage(
          "Your Gemini API key was rejected or lacks access to the required models (or hit a quota). Check it in Settings."
        );
      }
      return;
    }

    if (failures.length > 0) {
      setErrorMessage(
        `${failures.length} of ${targetsToProcess.length} render(s) failed (${failures.join(
          ", "
        )}). The rest were saved to History — you can retry the failed ones individually.`
      );
    }

    if (failures.length < targetsToProcess.length) {
      setActiveTab("history");
    }
  };

  // Restore Settings from Previous Version
  const handleRestoreVersion = (version: ProjectVersion) => {
    setStructuredPrompt({ ...version.structuredPrompt });
    setPreservationControls({ ...version.preservationControls });
    setGenerationMode(version.generationMode);
    setActiveTab("prompt");
  };

  return (
    <AccountGate>
      <div className="bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 min-h-[calc(100vh-5rem)]">
        {!hasApiKey && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-sm px-6 py-3 flex flex-wrap items-center gap-2">
            <Key size={16} />
            <span>Add your own Gemini API key to render designs.</span>
            <Link to="/settings" className="font-bold underline text-amber-100">
              Go to Settings
            </Link>
          </div>
        )}

        {/* Sticky Top Header */}
        <ProjectHeader
          projectInfo={projectInfo}
          setProjectInfo={setProjectInfo}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          viewsCount={views.length}
          referencesCount={references.length}
          docsCount={docs.length}
          historyCount={versions.length}
          onSaveProjectJSON={handleSaveProjectJSON}
          onLoadProjectJSON={handleLoadProjectJSON}
          onResetProject={handleResetProject}
          onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
          isGenerating={isGenerating}
        />

        {/* Main Studio Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {errorMessage && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl flex items-center justify-between text-xs">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 font-bold hover:text-rose-100 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === "views" && (
            <MultiViewWorkspace
              views={views}
              setViews={setViews}
              references={references}
              selectedTargetViewIds={selectedTargetViewIds}
              setSelectedTargetViewIds={setSelectedTargetViewIds}
              spaceType={projectInfo.spaceType || "Corridor / Hallway"}
              setSpaceType={(spaceType) =>
                setProjectInfo((prev) => ({ ...prev, spaceType }))
              }
            />
          )}

          {activeTab === "references" && (
            <ReferenceLibrary
              references={references}
              setReferences={setReferences}
            />
          )}

          {activeTab === "plans" && (
            <ArchitecturalPlans
              docs={docs}
              setDocs={setDocs}
              measurements={measurements}
              setMeasurements={setMeasurements}
            />
          )}

          {activeTab === "prompt" && (
            <StructuredPromptBuilder
              prompt={structuredPrompt}
              setPrompt={setStructuredPrompt}
              selectedStyle={selectedStyle}
              setSelectedStyle={setSelectedStyle}
            />
          )}

          {activeTab === "preservation" && (
            <PreservationControlsPanel
              controls={preservationControls}
              setControls={setPreservationControls}
            />
          )}

          {activeTab === "mode" && (
            <GenerationModeSelector
              generationMode={generationMode}
              setGenerationMode={setGenerationMode}
              designBrainId={designBrainId}
              setDesignBrainId={setDesignBrainId}
            />
          )}

          {activeTab === "history" && (
            <VersionHistorySection
              versions={versions}
              setVersions={setVersions}
              onRestoreVersion={handleRestoreVersion}
            />
          )}

          {activeTab === "export" && (
            <ExportHubModal
              projectInfo={projectInfo}
              views={views}
              references={references}
              docs={docs}
              measurements={measurements}
              structuredPrompt={structuredPrompt}
              preservationControls={preservationControls}
              generationMode={generationMode}
              versions={versions}
              onSaveJSON={handleSaveProjectJSON}
            />
          )}
        </main>

        {/* AI Pre-Generation Summary Modal */}
        <AIProjectSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          onConfirmGenerate={handleExecuteGenerate}
          views={views}
          references={references}
          architecturalDocs={docs}
          measurements={measurements}
          structuredPrompt={structuredPrompt}
          preservationControls={preservationControls}
          generationMode={generationMode}
          spaceType={projectInfo.spaceType}
          selectedTargetCount={
            selectedTargetViewIds.length > 0
              ? selectedTargetViewIds.length
              : views.length > 0
              ? 1
              : 0
          }
        />

        {/* Render Progress Overlay Modal */}
        <RenderProgressModal
          isOpen={isGenerating}
          viewTitle={currentRenderingTitle}
          currentTargetIndex={currentRenderingIndex}
          totalTargetsCount={
            selectedTargetViewIds.length > 0 ? selectedTargetViewIds.length : 1
          }
          spaceType={projectInfo.spaceType}
        />

        {/* Footer */}
        <footer className="bg-slate-950 border-t border-slate-900 py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 space-y-4">
            <AIDisclaimer variant="dark" />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <Logo size="sm" variant="icon" />
                <span className="font-semibold text-slate-400">
                  Aibotsautomations Architect — Enterprise Interior Design Studio
                </span>
              </div>
              <div>Powered by Google Gemini</div>
            </div>
          </div>
        </footer>
      </div>
    </AccountGate>
  );
};
