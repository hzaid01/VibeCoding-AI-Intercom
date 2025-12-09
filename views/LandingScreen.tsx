import React, { useState } from 'react';
import { Bot, Globe, VolumeX, FileText, ArrowRight, Zap } from 'lucide-react';

interface LandingScreenProps {
  onCreate: () => void;
  onJoin: (channelId: string) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onCreate, onJoin }) => {
  const [channelInput, setChannelInput] = useState('');
  const [mode, setMode] = useState<'hub' | 'join'>('hub');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-black">
      {/* Sci-Fi Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent opacity-50"></div>

      <div className="relative z-10 w-full max-w-lg space-y-10">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md">
            <Zap className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-xs font-mono text-primary tracking-[0.2em]">NEURAL LINK ACTIVE</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            EchoLink <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AI</span>
          </h1>
          
          <p className="text-gray-400 font-mono text-sm md:text-base max-w-sm mx-auto">
            Next-Gen WebRTC Voice Platform with Real-Time Neural Transcription.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="flex justify-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-gray-800 text-xs font-mono text-gray-300">
            <Globe className="w-3 h-3 text-primary" /> Global Translate
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-gray-800 text-xs font-mono text-gray-300">
            <VolumeX className="w-3 h-3 text-secondary" /> Silent Mode
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-gray-800 text-xs font-mono text-gray-300">
            <FileText className="w-3 h-3 text-green-400" /> Auto-Summary
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group">
          {mode === 'hub' ? (
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={onCreate}
                className="group/btn relative overflow-hidden bg-surface border border-primary/40 hover:border-primary p-5 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-sans tracking-wide">Start Host</h3>
                    <p className="text-xs text-gray-400 font-mono">Create New Session</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover/btn:text-primary transition-colors" />
              </button>

              <button 
                onClick={() => setMode('join')}
                className="group/btn relative overflow-hidden bg-surface border border-secondary/40 hover:border-secondary p-5 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(213,0,249,0.2)] text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-sans tracking-wide">Join Guest</h3>
                    <p className="text-xs text-gray-400 font-mono">Connect via ID</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover/btn:text-secondary transition-colors" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <label className="text-xs font-mono text-secondary uppercase tracking-widest">Target Channel ID</label>
                <input 
                  type="text" 
                  maxLength={4}
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black/50 border border-gray-700 text-white font-mono text-3xl p-4 text-center rounded-lg focus:outline-none focus:border-secondary focus:shadow-[0_0_15px_rgba(213,0,249,0.2)] placeholder-gray-800 tracking-[0.5em]"
                  placeholder="0000"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMode('hub')}
                  className="py-3 px-4 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 font-mono text-sm transition-colors"
                >
                  BACK
                </button>
                <button 
                  onClick={() => channelInput.length === 4 && onJoin(channelInput)}
                  disabled={channelInput.length !== 4}
                  className="py-3 px-4 rounded-lg bg-secondary text-black font-bold font-mono text-sm hover:bg-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(213,0,249,0.4)] transition-all"
                >
                  CONNECT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
