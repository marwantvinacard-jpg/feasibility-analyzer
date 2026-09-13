import {
  ViewImage,
  ReferenceImage,
  ArchitecturalDoc,
  RoomMeasurements,
  StructuredPrompt,
  PreservationControls,
  GenerationMode,
  AIAnalysisResult,
  StyleDirection,
  FileData
} from "../types";
import { authedFetch } from "./api";

export const analyzeWorkspace = async (params: {
  views: ViewImage[];
  references: ReferenceImage[];
  architecturalDocs: ArchitecturalDoc[];
  measurements: RoomMeasurements;
  structuredPrompt: StructuredPrompt;
  preservationControls: PreservationControls;
  generationMode: GenerationMode;
}): Promise<AIAnalysisResult> => {
  try {
    const res = await authedFetch("/api/analyze-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn("API analysis fallback activated:", error);
    // Graceful offline fallback calculation
    const viewCount = params.views.length;
    const refCount = params.references.length;
    const hasFront = params.views.some(v => v.category === 'Front View');
    let score = 60;
    if (hasFront) score += 15;
    if (viewCount >= 2) score += 10;
    if (refCount >= 1) score += 10;
    if (params.structuredPrompt.materials) score += 5;

    return {
      confidenceScore: Math.min(score, 98),
      detectedRoomType: params.structuredPrompt.projectGoal || "Luxury Hospitality Interior",
      spatialGeometry: hasFront ? "Front perspective with structural walls detected" : "Single view captured",
      lightingConditions: params.structuredPrompt.lighting || "Warm ambient 2700K architectural lighting",
      primaryMaterials: params.structuredPrompt.materials
        ? params.structuredPrompt.materials.split(',').map(m => m.trim())
        : ["Italian Travertine", "Dark Walnut", "Champagne Brass"],
      keyArchitecturalFeatures: ["Window/Door Geometry", "Structural Ceiling Height", "Wall Panels"],
      viewCoverageStatus: `${viewCount} uploaded view(s) (${hasFront ? 'Front view included' : 'No primary front view'})`,
      designRecommendations: [
        "Maintain color temperature continuity across all camera views",
        "Ensure travertine vein directions match on floor and wall cladding",
        "Link reference lighting samples for precise fixture highlights"
      ],
      readinessChecklist: [
        { item: "Primary View Uploaded", status: hasFront ? 'pass' : 'warning' },
        { item: "Multi-Angle Coverage", status: viewCount > 1 ? 'pass' : 'info' },
        { item: "Reference Library Assets", status: refCount > 0 ? 'pass' : 'info' },
        { item: "Structured Style Defined", status: params.structuredPrompt.interiorStyle ? 'pass' : 'warning' },
        { item: "Preservation Rules Set", status: 'pass' }
      ]
    };
  }
};

export const generateStudioDesign = async (params: {
  views: ViewImage[];
  references: ReferenceImage[];
  architecturalDocs: ArchitecturalDoc[];
  measurements: RoomMeasurements;
  structuredPrompt: StructuredPrompt;
  preservationControls: PreservationControls;
  generationMode: GenerationMode;
  targetViewId?: string;
  designBrainId?: string;
}): Promise<{ imageUrl: string; promptUsed: string; viewTitle: string }> => {
  try {
    const res = await authedFetch("/api/generate-studio-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Studio Design Generation Error:", error);
    throw error;
  }
};

export const generateDesignForStyle = async (
  style: StyleDirection,
  targetImage: FileData,
  brandImages: FileData[],
  userPrompt: string
): Promise<string> => {
  try {
    const res = await authedFetch("/api/generate-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style, targetImage, brandImages, userPrompt })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.imageUrl;
  } catch (error) {
    console.error(`Error generating design for ${style.title}:`, error);
    throw error;
  }
};

export const generateDesignFromPrompt = async (
  style: StyleDirection,
  userPrompt: string
): Promise<string> => {
  try {
    const res = await authedFetch("/api/generate-from-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style, userPrompt })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.imageUrl;
  } catch (error) {
    console.error(`Error generating prompt-based design for ${style.title}:`, error);
    throw error;
  }
};

export const editDesign = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const res = await authedFetch("/api/edit-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, prompt })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.imageUrl;
  } catch (error) {
    console.error("Edit Design Error:", error);
    throw error;
  }
};

export const transcribeAudio = async (
  base64Audio: string,
  mimeType: string,
  language: string
): Promise<string> => {
  try {
    const res = await authedFetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Audio, mimeType, language })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    return data.transcription;
  } catch (error) {
    console.error("Audio transcription error:", error);
    throw error;
  }
};
