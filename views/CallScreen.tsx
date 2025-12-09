
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Ear, EarOff, Languages, MessageSquareText, Activity, ArrowRightLeft } from 'lucide-react';
import { SpeechService } from '../services/speechService';
import { TranscriptionItem } from '../types';

interface CallScreenProps {
  channelId: string;
  onHangup: () => void;
  toggleMic: () => void;
  isMicMuted: boolean;
  statusText: string;
  toggleDeafMode: () => void;
  isDeaf: boolean;
  transcripts: TranscriptionItem[];
  onLocalSpeech: (text: string, isFinal: boolean) => void;
}

// Mock Translation Engine
const mockTranslate = (text: string): string => {
  const dictionary: Record<string, string> = {
    "hello": "ہیلو",
    "hi": "سلام",
    "team": "ٹیم",
    "good": "اچھا",
    "morning": "صبح بخیر",
    "meeting": "میٹنگ",
    "yes": "ہاں",
    "no": "نہیں",
    "thanks": "شکریہ",
    "project": "پروجیکٹ",
    "budget": "بجٹ",
    "timeline": "ٹائم لائن",
    "approved": "منظور",
    "bye": "خدا حافظ",
    "how are you": "آپ کیسے ہو",
  };

  const words = text.toLowerCase().split(' ');
  const translatedWords = words.map(word => {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    return dictionary[cleanWord] || word; 
  });

  return translatedWords.join(' ');
};

export const CallScreen: React.FC<CallScreenProps> = ({ 
  channelId, 
  onHangup, 
  toggleMic, 
  isMicMuted,
  statusText,
  toggleDeafMode,
  isDeaf,
  transcripts,
  onLocalSpeech
}) => {
  const [isTranslateOn, setIsTranslateOn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechService = useRef<SpeechService | null>(null);
  
  // Use a ref to keep the latest callback available to SpeechService
  const onLocalSpeechRef = useRef(onLocalSpeech);

  useEffect(() => {
    onLocalSpeechRef.current = onLocalSpeech;
  }, [onLocalSpeech]);

  useEffect(() => {
    // Start Listening immediately
    speechService.current = new SpeechService(
      (text, isFinal) => {
        if (onLocalSpeechRef.current) {
            onLocalSpeechRef.current(text, isFinal);
        }
      },
      (error) => console.warn("Speech Alert:", error)
    );

    speechService.current.start();

    return () => {
      speechService.current?.stop();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>

      {/* Header */}
      <div className="relative z-30 p-6 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${statusText.includes('ACTIVE') ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div className="text-sm font-mono text-gray-400">
                CHANNEL: <span className="text-primary font-bold">{channelId}</span>
            </div>
        </div>
        <div className="px-3 py-1 rounded border border-gray-800 bg-surface/50 text-xs font-mono text-gray-400">
            {statusText}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-12">
        {/* Animated Waveform */}
        <div className="flex items-center justify-center gap-2 h-32 w-full max-w-md opacity-80">
            {[...Array(15)].map((_, i) => (
                <div 
                    key={i} 
                    className={`w-2 rounded-full transition-all duration-300 ${isMicMuted ? 'bg-gray-800 h-2' : 'bg-primary animate-wave'}`}
                    style={{ 
                        animationDelay: `${i * 0.05}s`,
                        animationDuration: '1.2s',
                        height: isMicMuted ? '4px' : '40%'
                    }}
                ></div>
            ))}
        </div>
        
        {/* Call Controls */}
        <div className="flex items-center gap-6 mt-12">
            <button 
                onClick={toggleMic}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                    isMicMuted 
                    ? 'bg-red-500/10 border-red-500 text-red-500' 
                    : 'bg-surface border-gray-700 text-white hover:bg-gray-800 hover:border-gray-500'
                }`}
            >
                {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button 
                onClick={onHangup}
                className="p-8 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.4)] border-4 border-black transition-transform active:scale-95"
            >
                <PhoneOff className="w-8 h-8 fill-current" />
            </button>

            <button 
                onClick={toggleDeafMode}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                    isDeaf 
                    ? 'bg-secondary/20 border-secondary text-secondary' 
                    : 'bg-surface border-gray-700 text-white hover:bg-gray-800 hover:border-gray-500'
                }`}
            >
                {isDeaf ? <EarOff className="w-6 h-6" /> : <Ear className="w-6 h-6" />}
            </button>
        </div>
      </div>

      {/* Conversation Log (Chat Bubbles) */}
      <div className={`relative z-30 transition-all duration-500 ease-in-out ${isTranslateOn ? 'h-[50vh]' : 'h-[40vh]'} glass-panel border-t border-white/10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`}>
          
          {/* Toolbar */}
          <div className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-white tracking-wide">LIVE TRANSCRIPT</span>
              </div>
              
              <button 
                onClick={() => setIsTranslateOn(!isTranslateOn)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 border ${
                    isTranslateOn 
                    ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(213,0,249,0.3)]' 
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                  {isTranslateOn ? <ArrowRightLeft className="w-3 h-3" /> : <Languages className="w-3 h-3" />}
                  {isTranslateOn ? 'TRANSLATION ON' : 'ENABLE TRANSLATION'}
              </button>
          </div>

          {/* Bubbles Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {transcripts.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                      <MessageSquareText className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-mono">Conversation history will appear here...</p>
                  </div>
              )}
              
              {transcripts.map((item) => {
                  const isMe = item.sender === 'local';
                  
                  return (
                    <div key={item.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-4 relative ${
                            isMe 
                            ? 'bg-primary/20 border border-primary/30 text-white rounded-tr-none' 
                            : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none'
                        }`}>
                            <div className="text-[10px] font-mono uppercase opacity-50 mb-1 flex justify-between gap-4">
                                <span>{isMe ? 'ME' : 'PEER'}</span>
                                {isTranslateOn && <span className="text-secondary">URDU ENABLED</span>}
                            </div>
                            
                            <p className="leading-relaxed text-sm md:text-base">
                                {item.text}
                            </p>

                            {/* Simulated Translation */}
                            {isTranslateOn && (
                                <div className={`mt-3 pt-3 border-t ${isMe ? 'border-primary/20' : 'border-gray-600'} text-xs font-medium`}>
                                    <span className="opacity-50 block mb-1">Translated:</span>
                                    <span dir="rtl" className="text-base text-secondary">{mockTranslate(item.text)}</span>
                                </div>
                            )}

                            {!item.isFinal && (
                                <span className="inline-block w-2 h-2 bg-current rounded-full animate-ping ml-2"></span>
                            )}
                        </div>
                    </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};
