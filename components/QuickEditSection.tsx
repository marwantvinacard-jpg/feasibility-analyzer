import React, { useState, useEffect } from 'react';
import { Wand2, Download, RefreshCcw, ArrowRight, X, MousePointer2, Clock, Trash2, Calendar } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { Button } from './Button';
import { VoiceRecorder } from './VoiceRecorder';
import { FileData } from '../types';
import { editDesign } from '../services/geminiService';

interface EditHistoryItem {
  id: string;
  timestamp: string;
  originalBase64: string;
  resultBase64: string;
  prompt: string;
  clickPoint: {x: number, y: number} | null;
}

const HISTORY_KEY = 'lumina_edit_history_v1';

export const QuickEditSection: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  
  // Point selection state (x, y in percentages 0-1)
  const [clickPoint, setClickPoint] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setEditHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load edit history", e);
    }
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setClickPoint({ x, y });
  };

  const clearPoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    setClickPoint(null);
  };

  const saveToHistory = (item: EditHistoryItem) => {
    const updated = [item, ...editHistory].slice(0, 10); // Keep last 10
    setEditHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = editHistory.filter(item => item.id !== id);
    setEditHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const handleRestore = (item: EditHistoryItem) => {
    try {
      // Reconstruct FileData from base64
      const byteString = atob(item.originalBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/png' });
      const file = new File([blob], "restored_edit.png", { type: 'image/png' });
      
      const fileData: FileData = {
        id: Date.now().toString(),
        url: URL.createObjectURL(blob),
        file,
        base64: item.originalBase64
      };

      setFiles([fileData]);
      setPrompt(item.prompt);
      setResultImage(item.resultBase64);
      setClickPoint(item.clickPoint);
      
      // Scroll to top of section
      const section = document.getElementById('quick-edit-studio');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error("Failed to restore history item", e);
    }
  };

  const handleEdit = async () => {
    if (files.length === 0 || !prompt.trim()) return;
    
    setIsProcessing(true);
    try {
      let base64ToSend = files[0].base64;
      let finalPrompt = prompt;

      // If a point is selected, we need to draw a marker on the image
      if (clickPoint) {
        base64ToSend = await addMarkerToImage(files[0].url, clickPoint);
        finalPrompt = `(Edit the object at the red dot location) ${prompt}`;
      }

      const result = await editDesign(base64ToSend, finalPrompt);
      setResultImage(result);

      // Save to history
      saveToHistory({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        originalBase64: files[0].base64,
        resultBase64: result,
        prompt: prompt, // Save the user's original prompt, not the modified one with instructions
        clickPoint
      });

    } catch (error) {
      console.error("Quick edit failed", error);
      alert("Edit failed. Please ensure you have a valid API Key selected or try a different prompt.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addMarkerToImage = (imageUrl: string, point: {x: number, y: number}): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw Marker (Red Circle with white outline)
        const x = point.x * img.naturalWidth;
        const y = point.y * img.naturalHeight;
        // Scale marker radius based on image size, but keep it reasonable
        const radius = Math.max(img.naturalWidth * 0.02, 10); 

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000'; // Red
        ctx.fill();
        ctx.lineWidth = radius * 0.2;
        ctx.strokeStyle = '#ffffff'; // White outline
        ctx.stroke();

        // Return base64 without prefix
        const dataUrl = canvas.toDataURL(files[0].file.type || 'image/png');
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  const handleReset = () => {
    setResultImage(null);
    // Keep the file and prompt, maybe clear the point?
    // setClickPoint(null); 
  };

  const handleClear = () => {
    setFiles([]);
    setPrompt('');
    setResultImage(null);
    setClickPoint(null);
  };

  return (
    <section id="quick-edit-studio" className="bg-charcoal text-white py-16 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-gold-500 p-2 rounded-sm text-white">
              <Wand2 size={24} />
            </div>
            <div>
              <h2 className="font-serif text-3xl text-white">Quick Refinement Studio</h2>
              <p className="text-gray-400 text-sm font-sans tracking-wide">
                Upload any image and click to apply precise, AI-driven modifications.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-sm p-8 shadow-2xl mb-12">
          {!resultImage ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Input Area */}
              <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gold-500 font-bold uppercase tracking-widest text-xs">1. Source Image</h3>
                    {files.length > 0 && (
                        <button onClick={handleClear} className="text-gray-500 hover:text-white text-xs flex items-center gap-1 transition-colors">
                            <X size={12} /> Clear
                        </button>
                    )}
                </div>
                
                <div className="h-full relative group">
                    {files.length === 0 ? (
                        <FileUpload 
                            label=""
                            files={files}
                            onFilesChange={(newFiles) => {
                                setFiles(newFiles);
                                setClickPoint(null);
                            }}
                            maxFiles={1}
                            className="quick-edit-upload" 
                        />
                    ) : (
                        <div 
                           className="relative w-full rounded-lg overflow-hidden border border-gray-600 cursor-crosshair shadow-lg bg-black"
                           onClick={handleImageClick}
                        >
                            <img 
                                src={files[0].url} 
                                alt="Edit Target" 
                                className="w-full h-auto object-contain block"
                            />
                            
                            {/* Visual Hint Overlay (when no point selected) */}
                            {!clickPoint && (
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/60 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 backdrop-blur-sm">
                                        <MousePointer2 size={12} /> Click to target object
                                    </div>
                                </div>
                            )}

                            {/* Click Marker */}
                            {clickPoint && (
                                <div 
                                    className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-500 border-2 border-white shadow-md animate-bounce z-10"
                                    style={{ left: `${clickPoint.x * 100}%`, top: `${clickPoint.y * 100}%` }}
                                >
                                    <button 
                                        onClick={clearPoint}
                                        className="absolute -top-6 -left-4 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                    >
                                        Remove Target
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {files.length > 0 && (
                         <p className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
                            <MousePointer2 size={10} />
                            {clickPoint ? 'Target locked. Add prompt below.' : 'Click on the image to target a specific item (optional).'}
                         </p>
                    )}

                    <style>{`
                        .quick-edit-upload label { color: #9ca3af !important; }
                        .quick-edit-upload div[class*='border-dashed'] { 
                            background-color: rgba(255,255,255,0.05); 
                            border-color: #4b5563; 
                        }
                        .quick-edit-upload div[class*='border-dashed']:hover { 
                            border-color: #b88a33; 
                            background-color: rgba(184, 138, 51, 0.05);
                        }
                        .quick-edit-upload p { color: #9ca3af !important; }
                    `}</style>
                </div>
              </div>

              {/* Controls Area */}
              <div className="flex flex-col gap-6 h-full justify-center">
                 <div>
                    <h3 className="text-gold-500 font-bold uppercase tracking-widest text-xs mb-4">2. Edit Instructions</h3>
                    <textarea 
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition-all resize-none min-h-[140px] mb-3"
                        placeholder="Describe your edit exactly...&#10;e.g., 'Change the floor to marble', 'Remove the painting', 'Make the lighting blue'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <VoiceRecorder 
                        onTranscript={(transcript) => setPrompt(prev => prev ? `${prev} ${transcript}` : transcript)}
                        theme="dark"
                    />
                 </div>

                 <Button 
                    onClick={handleEdit}
                    disabled={files.length === 0 || !prompt.trim() || isProcessing}
                    isLoading={isProcessing}
                    className="w-full py-4 text-lg"
                 >
                    <Wand2 size={20} />
                    {isProcessing ? 'Refining Image...' : 'Apply Magic Edit'}
                 </Button>
              </div>
            </div>
          ) : (
            // Result View
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-gold-500 font-bold uppercase tracking-widest text-xs">Edit Results</h3>
                    <div className="flex gap-3">
                         <Button variant="outline" onClick={handleReset} className="!border-gray-600 !text-gray-300 hover:!bg-gray-800 hover:!text-white">
                            <RefreshCcw size={16} /> Edit Again
                         </Button>
                         <Button variant="primary" onClick={handleClear}>
                            Start New
                         </Button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-stretch h-[500px]">
                    {/* Original */}
                    <div className="flex-1 flex flex-col gap-2">
                        <span className="text-gray-500 text-xs font-bold uppercase text-center">Original</span>
                        <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden relative">
                             <img src={files[0].url} className="w-full h-full object-contain" alt="Original" />
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center justify-center text-gold-500">
                        <ArrowRight size={32} />
                    </div>

                    {/* Result */}
                    <div className="flex-1 flex flex-col gap-2">
                        <span className="text-gold-500 text-xs font-bold uppercase text-center">Refined Output</span>
                        <div className="flex-1 bg-black rounded-sm overflow-hidden relative border border-gold-500/30 shadow-2xl">
                             <img src={resultImage} className="w-full h-full object-contain" alt="Result" />
                             <a 
                                href={resultImage} 
                                download={`Lumina-QuickEdit-${Date.now()}.png`}
                                className="absolute bottom-4 right-4 bg-white text-charcoal px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-gold-500 hover:text-white transition-colors shadow-lg"
                             >
                                <Download size={14} /> Download
                             </a>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Edit History Section */}
        {editHistory.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex items-center gap-2 mb-6">
               <Clock className="text-gold-500" size={20} />
               <h3 className="font-serif text-xl text-white">Recent Edits</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {editHistory.map(item => (
                <div 
                  key={item.id} 
                  className="bg-gray-800 border border-gray-700 rounded-sm overflow-hidden group hover:border-gold-500 transition-colors cursor-pointer relative"
                  onClick={() => handleRestore(item)}
                >
                  <div className="aspect-square relative bg-black">
                     <img src={item.resultBase64} alt="History" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                     {item.clickPoint && (
                        <div className="absolute top-2 right-2 bg-red-500 w-2 h-2 rounded-full shadow-sm" title="Contains Target Point"></div>
                     )}
                  </div>
                  <div className="p-3">
                     <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                       <Calendar size={10} /> {item.timestamp}
                     </p>
                     <p className="text-sm text-white font-medium truncate" title={item.prompt}>
                        "{item.prompt}"
                     </p>
                  </div>
                  <button
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    aria-label="Delete edit history item"
                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};