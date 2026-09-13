import React, { useState } from 'react';
import { DesignSession, GeneratedDesign } from '../types';
import { Clock, Trash2, Calendar, Quote, Download, RefreshCcw, Eye, X } from 'lucide-react';
import { Button } from './Button';
import { STYLE_DIRECTIONS } from '../constants';

interface HistorySectionProps {
  history: DesignSession[];
  onDelete: (id: string) => void;
  onLoadSession: (session: DesignSession) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ history, onDelete, onLoadSession }) => {
  const [selectedDesign, setSelectedDesign] = useState<{
    design: GeneratedDesign;
    session: DesignSession;
  } | null>(null);

  if (history.length === 0) return null;

  const getStyleDescription = (styleId: string) => {
    const style = STYLE_DIRECTIONS.find(s => s.id === styleId);
    return style ? style.description : [];
  };

  return (
    <section className="py-16 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="text-gold-500" size={24} />
          <h2 className="font-serif text-3xl text-charcoal">Design Archives</h2>
        </div>
        
        <div className="space-y-12">
          {history.map((session) => (
            <div key={session.id} className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              {/* Session Header */}
              <div className="bg-white border-b border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-gold-600 text-xs font-bold tracking-widest uppercase">
                    <Calendar size={12} />
                    {session.date}
                  </div>
                  {session.prompt && (
                    <div className="flex items-start gap-2 text-gray-500 text-sm italic">
                      <Quote size={12} className="mt-1 flex-shrink-0" />
                      <span>"{session.prompt}"</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => onLoadSession(session)}
                    className="!px-3 !py-1.5 text-xs h-8 border-gray-300 text-gray-600 hover:text-gold-600 hover:border-gold-500"
                  >
                    <RefreshCcw size={12} className="mr-1" /> Restore to Workspace
                  </Button>
                  <button
                    onClick={() => onDelete(session.id)}
                    aria-label="Delete session"
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                    title="Delete Session"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Session Content */}
              <div className="p-6">
                <div className="flex flex-col xl:flex-row gap-6">
                  
                  {/* Original Image */}
                  <div className="w-full xl:w-1/4">
                    <p className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2">Original Space</p>
                    <div className="aspect-video rounded-sm overflow-hidden bg-gray-200 relative group">
                      <img src={session.originalImage} alt="Original" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                    </div>
                  </div>

                  {/* Generated Grid */}
                  <div className="w-full xl:w-3/4">
                    <p className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2">Generated Concepts</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {session.designs.map((design) => (
                        <div 
                          key={design.id} 
                          className="group relative cursor-pointer"
                          onClick={() => design.status === 'completed' && setSelectedDesign({ design, session })}
                        >
                          <div className="aspect-[4/5] bg-gray-200 rounded-sm overflow-hidden border border-transparent hover:border-gold-500 transition-colors">
                             {design.status === 'completed' ? (
                               <img src={design.imageUrl} alt={design.styleTitle} className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">Failed</div>
                             )}
                          </div>
                          <div className="mt-2">
                             <p className="text-[10px] font-bold text-gold-600 uppercase truncate">{design.styleTitle}</p>
                          </div>
                          
                          {/* Hover Overlay */}
                          {design.status === 'completed' && (
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                               <div className="bg-white/90 text-charcoal text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                                 <Eye size={12} /> View Details
                               </div>
                             </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Modal */}
        {selectedDesign && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedDesign(null)} />
            
            <div className="relative bg-white w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row rounded-sm overflow-hidden shadow-2xl animate-fade-in">
              <button
                onClick={() => setSelectedDesign(null)}
                aria-label="Close preview"
                className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors backdrop-blur-md"
              >
                <X size={24} />
              </button>

              {/* Image Side */}
              <div className="w-full md:w-2/3 bg-black flex items-center justify-center p-2 relative group">
                <img 
                  src={selectedDesign.design.imageUrl} 
                  alt={selectedDesign.design.styleTitle} 
                  className="max-w-full max-h-[80vh] object-contain"
                />
                <a 
                  href={selectedDesign.design.imageUrl} 
                  download={`AiBotsAutomations-${selectedDesign.design.styleId}.png`}
                  className="absolute bottom-6 right-6 bg-white text-charcoal px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-gold-500 hover:text-white transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                >
                  <Download size={14} /> Download
                </a>
              </div>

              {/* Info Side */}
              <div className="w-full md:w-1/3 p-8 flex flex-col overflow-y-auto bg-white">
                <div className="mb-6">
                  <span className="text-gold-600 font-bold tracking-widest text-xs uppercase mb-1 block">Style Direction</span>
                  <h3 className="font-serif text-2xl text-charcoal leading-tight">{selectedDesign.design.styleTitle}</h3>
                </div>

                <div className="mb-8">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">AI Design Prompt</h4>
                  <ul className="space-y-2">
                    {getStyleDescription(selectedDesign.design.styleId).map((desc, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="w-1 h-1 bg-gold-400 rounded-full mt-2 shrink-0" />
                        {desc}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedDesign.session.prompt && (
                  <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">User Nuance</h4>
                    <p className="text-sm text-charcoal italic">"{selectedDesign.session.prompt}"</p>
                  </div>
                )}

                <div className="mt-auto pt-6 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                  <span>Generated: {selectedDesign.session.date}</span>
                  <Button 
                    variant="text" 
                    onClick={() => {
                       onLoadSession(selectedDesign.session);
                       setSelectedDesign(null);
                    }}
                    className="!p-0"
                  >
                    Restore Session
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};