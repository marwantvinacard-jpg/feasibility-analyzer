import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { Button } from "../components/Button";
import { DesignGallery } from "../components/DesignGallery";
import { QuickEditSection } from "../components/QuickEditSection";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { FileData, GeneratedDesign, StyleDirection } from "../types";
import { STYLE_DIRECTIONS, STYLE_VARIATION_ANGLES } from "../constants";
import {
  generateDesignForStyle,
  generateDesignFromPrompt,
} from "../services/geminiService";
import { getApiKeyStatus } from "../services/api";
import { GateScreen } from "../components/AccountGate";
import { AIDisclaimer } from "../components/AIDisclaimer";
import { useAuth } from "../context/AuthContext";
import { Info, Key, ShieldCheck, Sparkles } from "lucide-react";

export const StudioPage: React.FC = () => {
  const { profile } = useAuth();

  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [generationMode, setGenerationMode] = useState<"remodel" | "prompt_only">(
    "remodel"
  );
  const [targetImage, setTargetImage] = useState<FileData[]>([]);
  const [brandImages, setBrandImages] = useState<FileData[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [styleDirection, setStyleDirection] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [designs, setDesigns] = useState<GeneratedDesign[]>([]);

  useEffect(() => {
    getApiKeyStatus()
      .then(setHasApiKey)
      .catch(() => setHasApiKey(false));
  }, []);

  if (profile && profile.status !== "active") {
    return <GateScreen disabled={profile.status === "disabled"} />;
  }

  const handleGenerate = async () => {
    if (!hasApiKey) return;
    if (generationMode === "remodel" && targetImage.length === 0) return;
    if (generationMode === "prompt_only" && !userPrompt.trim()) {
      alert("Please enter a description for your corridor design first!");
      return;
    }
    if (!styleDirection.trim()) {
      alert("Describe (or pick) a style direction first!");
      return;
    }

    setIsGenerating(true);

    // One style, explored from 5 different creative angles — not 5
    // unrelated preset styles. Each variation carries the same style
    // direction text plus a distinct brief describing how this particular
    // take should differ (lighting, layout, materials, styling, etc.).
    const baseStyleTitle = styleDirection.trim();
    const variations: StyleDirection[] = STYLE_VARIATION_ANGLES.map((angle) => ({
      id: `${baseStyleTitle}::${angle.id}`,
      title: `${baseStyleTitle} — ${angle.label}`,
      description: [baseStyleTitle, angle.brief],
    }));

    const initialDesigns: GeneratedDesign[] = variations.map((style) => ({
      id: Math.random().toString(),
      styleId: style.id,
      styleTitle: style.title,
      imageUrl: "",
      status: "pending",
    }));
    setDesigns(initialDesigns);

    for (let i = 0; i < variations.length; i++) {
      const style = variations[i];
      setDesigns((prev) =>
        prev.map((d) =>
          d.styleId === style.id ? { ...d, status: "generating" } : d
        )
      );

      try {
        let generatedImageUrl = "";
        if (generationMode === "remodel") {
          generatedImageUrl = await generateDesignForStyle(
            style,
            targetImage[0],
            brandImages,
            userPrompt
          );
        } else {
          generatedImageUrl = await generateDesignFromPrompt(style, userPrompt);
        }

        setDesigns((prev) =>
          prev.map((d) =>
            d.styleId === style.id
              ? { ...d, status: "completed", imageUrl: generatedImageUrl }
              : d
          )
        );
      } catch (error: any) {
        console.error("Generation Error:", error);

        setDesigns((prev) =>
          prev.map((d) =>
            d.styleId === style.id ? { ...d, status: "failed" } : d
          )
        );

        // The user hasn't set a key on the backend.
        if (error?.code === "no_api_key") {
          setIsGenerating(false);
          setHasApiKey(false);
          alert("Please add your Gemini API key in Settings first.");
          return;
        }

        // The backend rejected the user's key (bad key / no access / quota).
        if (error?.code === "invalid_key") {
          setIsGenerating(false);
          alert(
            "API Access Error: Your Gemini API key was rejected or lacks access to the image models (or hit a quota). Please check your key in Settings."
          );
          return;
        }
      }
    }

    setIsGenerating(false);
  };

  return (
    <main>
      {/* Key status banner */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        {hasApiKey ? (
          <div className="flex items-center gap-2 text-green-700 text-xs font-semibold px-4 py-2 bg-green-50 rounded-full border border-green-100 w-fit">
            <ShieldCheck size={14} /> Your API key is connected
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-amber-800 text-sm px-4 py-3 bg-amber-50 rounded-lg border border-amber-200">
            <Key size={16} />
            <span>Add your own Gemini API key to start generating.</span>
            <Link to="/settings" className="font-bold text-gold-700 underline">
              Go to Settings
            </Link>
          </div>
        )}
      </div>

      {/* Hero / Upload Section */}
      <section className="bg-white pb-16 pt-10 border-b border-gray-200 mt-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="font-serif text-4xl lg:text-5xl text-charcoal mb-4">
              Reimagine Your Corridor
            </h2>
            <p className="text-gray-500 text-lg font-light max-w-2xl mx-auto">
              Transform existing spaces or generate brand-new luxury hotel
              corridors from scratch using advanced architectural AI.
            </p>
          </div>

          {/* Mode Toggle Tabs */}
          <div className="flex justify-center mb-10">
            <div className="bg-gray-100 p-1.5 rounded-full inline-flex border border-gray-200 shadow-inner">
              <button
                type="button"
                onClick={() => setGenerationMode("remodel")}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  generationMode === "remodel"
                    ? "bg-gold-500 text-white shadow-md"
                    : "text-gray-500 hover:text-charcoal"
                }`}
              >
                Transform Corridor (With Reference)
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode("prompt_only")}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  generationMode === "prompt_only"
                    ? "bg-gold-500 text-white shadow-md"
                    : "text-gray-500 hover:text-charcoal"
                }`}
              >
                Generate from Prompt Only
              </button>
            </div>
          </div>

          {generationMode === "remodel" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <FileUpload
                label="1. Target Corridor"
                subLabel="(Perspective Reference)"
                files={targetImage}
                onFilesChange={setTargetImage}
                maxFiles={1}
                className="h-full"
              />
              <FileUpload
                label="2. Brand DNA"
                subLabel="(Style References - Up to 5)"
                multiple
                maxFiles={5}
                files={brandImages}
                onFilesChange={setBrandImages}
                className="h-full"
              />
            </div>
          )}

          {/* Style Direction — one style, chosen or typed freely */}
          <div className="mb-8">
            <label
              htmlFor="style-direction"
              className="block text-sm font-bold text-charcoal uppercase tracking-wider mb-2"
            >
              {generationMode === "remodel" ? "3. " : ""}Style Direction (Required)
            </label>
            <textarea
              id="style-direction"
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none transition-all resize-none text-gray-700 placeholder-gray-400 bg-gray-50"
              rows={2}
              placeholder='e.g., "Modern Mediterranean Luxury with warm travertine and brass accents"...'
              value={styleDirection}
              onChange={(e) => setStyleDirection(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Style inspiration">
              {STYLE_DIRECTIONS.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyleDirection(style.title)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    styleDirection === style.title
                      ? "bg-gold-500 border-gold-500 text-white"
                      : "bg-white border-gray-300 text-gray-600 hover:border-gold-400 hover:text-gold-700"
                  }`}
                >
                  {style.title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <Sparkles size={14} />
              <span>
                Tap a chip to start from it, or type any style of your own —
                the AI will explore your chosen direction from 5 distinct
                creative angles.
              </span>
            </div>
          </div>

          <div className="mb-10">
            <label className="block text-sm font-bold text-charcoal uppercase tracking-wider mb-2">
              {generationMode === "remodel"
                ? "4. Design Nuance (Optional)"
                : "Describe Your Vision (Required)"}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none transition-all resize-none text-gray-700 placeholder-gray-400 bg-gray-50"
              rows={4}
              placeholder={
                generationMode === "remodel"
                  ? 'e.g., "Make the lighting warmer", "Add more brass details", "Use a darker carpet"...'
                  : 'Describe the luxury hotel corridor you want to create from scratch...'
              }
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
            />

            <VoiceRecorder
              onTranscript={(transcript) =>
                setUserPrompt((prev) =>
                  prev ? `${prev} ${transcript}` : transcript
                )
              }
              className="mt-3"
            />

            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <Info size={14} />
              <span>
                The AI will intelligently apply this on top of your chosen
                style direction, across all 5 concept variations.
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !hasApiKey ||
                !styleDirection.trim() ||
                (generationMode === "remodel" && targetImage.length === 0) ||
                (generationMode === "prompt_only" && !userPrompt.trim())
              }
              isLoading={isGenerating}
              className="w-full md:w-auto min-w-[300px] text-lg py-4 shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              {isGenerating
                ? "Generating Concepts..."
                : !hasApiKey
                ? "Add API Key to Begin"
                : !styleDirection.trim()
                ? "Choose a Style to Begin"
                : generationMode === "remodel"
                ? targetImage.length === 0
                  ? "Upload Target Image to Begin"
                  : "Generate 5 Design Concepts"
                : !userPrompt.trim()
                ? "Enter Description to Begin"
                : "Generate 5 Design Concepts"}
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Edit Section (Standalone) */}
      <QuickEditSection />

      {/* Results Gallery - Current Session */}
      <DesignGallery
        designs={designs}
        onEnhanced={(designId, enhancedImageUrl) =>
          setDesigns((prev) =>
            prev.map((d) =>
              d.id === designId
                ? { ...d, imageUrl: enhancedImageUrl, styleTitle: `${d.styleTitle} (Enhanced)` }
                : d
            )
          )
        }
      />

      {designs.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 pb-12">
          <AIDisclaimer />
        </div>
      )}
    </main>
  );
};
