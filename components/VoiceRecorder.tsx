import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Globe, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { transcribeAudio } from '../services/geminiService';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  className?: string;
  theme?: 'light' | 'dark';
}

type Mode = 'live' | 'ai';
type Language = 'en' | 'fr' | 'ar';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscript, 
  className = '',
  theme = 'light'
}) => {
  // State
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [mode, setMode] = useState<Mode>('ai'); // Default to AI since it's 100% reliable in iframes
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tempTranscript, setTempTranscript] = useState<string>('');
  
  // Feature support detection
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);

  // Refs for recording / recognition
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
    } else {
      setIsSpeechSupported(false);
      setMode('ai'); // Fall back entirely to AI recording
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start Voice Capturing
  const handleStart = async () => {
    setError(null);
    setTempTranscript('');

    if (mode === 'live') {
      startLiveSpeech();
    } else {
      await startAIRecording();
    }
  };

  // Stop Voice Capturing
  const handleStop = () => {
    if (mode === 'live') {
      stopLiveSpeech();
    } else {
      stopAIRecording();
    }
  };

  // Method 1: Web Speech API Live Recognition
  const startLiveSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      // Set correct language locale
      if (selectedLanguage === 'en') {
        recognition.lang = 'en-US';
      } else if (selectedLanguage === 'fr') {
        recognition.lang = 'fr-FR';
      } else if (selectedLanguage === 'ar') {
        recognition.lang = 'ar-SA';
      }

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setTempTranscript(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Live speech recognition error:', event);
        if (event.error === 'not-allowed') {
          setError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else {
          setError(`Live Transcription Error: ${event.error || 'Unknown error'}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('Failed to initialize speech recognition:', err);
      setError(err?.message || 'Speech Recognition is not supported or was blocked.');
    }
  };

  const stopLiveSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    
    // Finalize transcript
    if (tempTranscript.trim()) {
      onTranscript(tempTranscript.trim());
      setTempTranscript('');
    }
  };

  // Method 2: MediaRecorder with Gemini Transcription
  const startAIRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        setIsTranscribing(true);
        setError(null);

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const languageName = selectedLanguage === 'en' ? 'English' : selectedLanguage === 'fr' ? 'French' : 'Arabic';
            
            const transcription = await transcribeAudio(base64Audio, mimeType, languageName);
            
            if (transcription && transcription.trim()) {
              onTranscript(transcription.trim());
            } else {
              setError("No speech was detected. Please try speaking closer to the microphone.");
            }
            setIsTranscribing(false);
          };
        } catch (err: any) {
          console.error("Gemini Transcription error:", err);
          setError("Failed to transcribe audio. Please make sure you have a valid API key connected.");
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.error("Failed to access microphone:", err);
      setError("Microphone access was denied or is unavailable. Please check your browser's microphone permissions.");
    }
  };

  const stopAIRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
  };

  // Accept temporary Web Speech transcript manually
  const acceptTempTranscript = () => {
    if (tempTranscript.trim()) {
      onTranscript(tempTranscript.trim());
      setTempTranscript('');
    }
  };

  // Dynamic Theme Styling Classes
  const isDark = theme === 'dark';
  const containerClasses = isDark 
    ? 'bg-gray-900/60 border border-gray-700 text-white shadow-inner' 
    : 'bg-gray-50 border border-gray-200 text-charcoal';
  const labelColorClasses = isDark ? 'text-gray-400' : 'text-gray-500';
  const selectorBgClasses = isDark ? 'bg-gray-800' : 'bg-gray-200/60';
  const unselectedBtnClasses = isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-charcoal';
  const titleColorClasses = isDark ? 'text-gray-100' : 'text-gray-700';
  const descColorClasses = isDark ? 'text-gray-400' : 'text-gray-500';
  const previewBoxClasses = isDark ? 'bg-gray-950/60 border border-gray-800' : 'bg-white border border-gray-200';
  const previewTextClasses = isDark ? 'text-gray-100' : 'text-charcoal';

  return (
    <div id="voice-recorder-widget" className={`p-4 rounded-lg ${containerClasses} ${className}`}>
      
      {/* Settings Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        
        {/* Language Selection */}
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-gray-400" />
          <span className={`text-xs font-semibold uppercase tracking-wider ${labelColorClasses}`}>Language:</span>
          <div className={`flex p-0.5 rounded-sm ${selectorBgClasses}`}>
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${selectedLanguage === 'en' ? 'bg-gold-500 text-white font-semibold' : unselectedBtnClasses}`}
            >
              English
            </button>
            <button
              onClick={() => setSelectedLanguage('fr')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${selectedLanguage === 'fr' ? 'bg-gold-500 text-white font-semibold' : unselectedBtnClasses}`}
            >
              Français
            </button>
            <button
              onClick={() => setSelectedLanguage('ar')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${selectedLanguage === 'ar' ? 'bg-gold-500 text-white font-semibold' : unselectedBtnClasses}`}
            >
              العربية
            </button>
          </div>
        </div>

        {/* Recording Mode Selection (Only if Speech is supported) */}
        {isSpeechSupported && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${labelColorClasses}`}>Engine:</span>
            <div className={`flex p-0.5 rounded-sm ${selectorBgClasses}`}>
              <button
                onClick={() => setMode('live')}
                className={`px-2 py-0.5 text-[10px] uppercase font-bold transition-colors ${mode === 'live' ? 'bg-charcoal text-white' : 'text-gray-400 hover:text-white'}`}
                title="Transcribe instantly as you speak"
              >
                Live Speech
              </button>
              <button
                onClick={() => setMode('ai')}
                className={`px-2 py-0.5 text-[10px] uppercase font-bold transition-colors ${mode === 'ai' ? 'bg-charcoal text-white' : 'text-gray-400 hover:text-white'}`}
                title="Record then transcribe with Gemini (More accurate)"
              >
                AI Record
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recording Widget Main Controls */}
      <div className="flex items-center gap-4">
        
        {/* Record Button and its Glow rings */}
        <div className="relative">
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping pointer-events-none" />
          )}
          <button
            onClick={isListening ? handleStop : handleStart}
            disabled={isTranscribing}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-105' 
                : 'bg-gold-500 hover:bg-gold-600 text-white shadow hover:shadow-md'
            } disabled:opacity-50`}
            title={isListening ? 'Stop Recording' : 'Start Recording'}
          >
            {isListening ? (
              <MicOff size={20} className="animate-pulse" />
            ) : (
              <Mic size={20} />
            )}
          </button>
        </div>

        {/* Waveform Visualization / Info */}
        <div className="flex-1 min-w-0">
          {isListening ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-xs font-semibold text-red-500">
                  {mode === 'live' ? 'Listening live...' : 'Recording audio...'}
                </p>
              </div>
              
              {/* Elegant wave lines */}
              <div className="flex items-end gap-[3px] h-4 mt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((bar) => {
                  const randomDelay = Math.random() * 0.8;
                  const randomHeight = Math.floor(Math.random() * 10) + 6;
                  return (
                    <span 
                      key={bar} 
                      className="w-[2px] bg-red-500 rounded-full"
                      style={{ 
                        height: isListening ? `${randomHeight}px` : '4px',
                        animation: `bounce 0.8s ease-in-out infinite alternate`,
                        animationDelay: `${randomDelay}s`
                      }}
                    />
                  );
                })}
              </div>
              
              <p className={`text-[10px] ${descColorClasses} mt-1`}>Click the red button again to stop and finalize transcription.</p>
            </div>
          ) : isTranscribing ? (
            <div className="flex items-center gap-3 py-2">
              <RefreshCw size={16} className="text-gold-500 animate-spin" />
              <div>
                <p className="text-xs font-semibold text-gold-500">Processing Voice with Gemini AI...</p>
                <p className={`text-[10px] ${descColorClasses}`}>Accurately transcribing in {selectedLanguage === 'en' ? 'English' : selectedLanguage === 'fr' ? 'French' : 'Arabic'}...</p>
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-xs font-semibold ${titleColorClasses}`}>
                Voice Input Redesign Tool
              </p>
              <p className={`text-[11px] ${descColorClasses} mt-0.5`}>
                {mode === 'live' 
                  ? 'Transcribe speech instantly. Speak, see results live, then click stop.' 
                  : 'Record high-precision voice prompts. Gemini AI will write it down for you.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Live transcript buffer view (Web Speech API) */}
      {mode === 'live' && tempTranscript && (
        <div className={`mt-3 p-3 rounded flex flex-col gap-2 ${previewBoxClasses}`}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Live Transcript Preview:</p>
          <p className={`text-sm italic font-serif ${previewTextClasses}`}>"{tempTranscript}"</p>
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setTempTranscript('')}
              className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider"
            >
              Discard
            </button>
            <button
              onClick={acceptTempTranscript}
              className="text-[10px] font-bold text-gold-500 hover:text-gold-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Check size={12} /> Apply to Prompt
            </button>
          </div>
        </div>
      )}

      {/* Error feedback */}
      {error && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded text-xs text-red-600 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p className="leading-tight">{error}</p>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
};
