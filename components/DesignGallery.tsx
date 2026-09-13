import React, { useState } from 'react';
import { GeneratedDesign } from '../types';
import { Download, Maximize2, Wand2, Loader2 } from 'lucide-react';
import { enhanceImage } from '../services/api';

interface DesignGalleryProps {
  designs: GeneratedDesign[];
  onEnhanced?: (designId: string, enhancedImageUrl: string) => void;
}

export const DesignGallery: React.FC<DesignGalleryProps> = ({ designs, onEnhanced }) => {
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const handleEnhance = async (design: GeneratedDesign) => {
    setEnhanceError(null);
    setEnhancingId(design.id);
    try {
      const result = await enhanceImage(design.imageUrl, { scaleFactor: '2x', hdr: 2 });
      onEnhanced?.(design.id, result.imageUrl);
    } catch (err: any) {
      setEnhanceError(
        err?.code === 'no_magnific_key'
          ? 'Add your Magnific API key in Settings to enable enhancement.'
          : err?.message || 'Failed to enhance this design.'
      );
    } finally {
      setEnhancingId(null);
    }
  };

  if (designs.length === 0) return null;

  return (
    <section className="py-12 bg-white w-full">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-serif text-3xl text-charcoal mb-2">Generated Concepts</h2>
        <p className="text-gray-500 mb-8 font-sans">Five distinct luxury interpretations of your space.</p>

        {enhanceError && (
          <div role="alert" className="mb-8 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3">
            <span>{enhanceError}</span>
            <button onClick={() => setEnhanceError(null)} className="font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-16">
          {designs.map((design, index) => (
            <div key={design.styleId} className={`flex flex-col lg:flex-row gap-8 items-start fade-in`}>
              {/* Image Section */}
              <div className="w-full lg:w-2/3 relative group shadow-2xl rounded-sm overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
                {design.status === 'pending' && (
                  <div className="text-gray-400 font-serif italic">Waiting in queue...</div>
                )}
                {design.status === 'generating' && (
                  <div className="flex flex-col items-center gap-3">
                     <svg className="animate-spin h-8 w-8 text-gold-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gold-600 font-serif tracking-widest text-sm animate-pulse">RENDERING CONCEPT...</span>
                  </div>
                )}
                {design.status === 'failed' && (
                  <div className="text-red-500 flex flex-col items-center p-4 text-center">
                    <span className="font-bold">Generation Failed</span>
                    <span className="text-sm">Please try again.</span>
                  </div>
                )}
                {design.status === 'completed' && (
                  <>
                    <img src={design.imageUrl} alt={design.styleTitle} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <a
                        href={design.imageUrl}
                        download={`AiBotsAutomations-Design-${design.styleId}.png`}
                        className="bg-white text-charcoal px-4 py-2 rounded-full font-medium hover:bg-gold-500 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <Download size={18} /> Download High-Res
                      </a>
                      <button
                        onClick={() => handleEnhance(design)}
                        disabled={enhancingId === design.id}
                        className="bg-charcoal text-white px-4 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-60"
                      >
                        {enhancingId === design.id ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> Enhancing…
                          </>
                        ) : (
                          <>
                            <Wand2 size={18} /> Enhance with Magnific
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Info Section */}
              <div className="w-full lg:w-1/3 flex flex-col h-full justify-center">
                <span className="text-gold-600 font-bold tracking-widest text-xs mb-2">CONCEPT {index + 1}</span>
                <h3 className="font-serif text-3xl text-charcoal mb-4">{design.styleTitle}</h3>
                <div className="h-0.5 w-16 bg-gold-300 mb-6"></div>
                <p className="text-gray-600 leading-relaxed font-sans mb-6">
                  A sophisticated reinterpretation focusing on {design.styleTitle.toLowerCase().replace('luxury', '')} aesthetics. 
                  Designed to elevate the guest experience while respecting the original architectural envelope.
                </p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-gray-100 text-xs text-gray-500 uppercase tracking-wide">4K Resolution</span>
                  <span className="px-3 py-1 bg-gray-100 text-xs text-gray-500 uppercase tracking-wide">Photorealistic</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};