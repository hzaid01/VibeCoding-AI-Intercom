import React, { useState, useEffect } from 'react';
import { CheckCircle2, FileText, ArrowLeft, Loader2 } from 'lucide-react';

interface SummaryScreenProps {
  onBack: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate AI Processing time
    const timer = setTimeout(() => {
        setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
              <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-primary animate-pulse" />
                  </div>
              </div>
              <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-white">Processing Session Data...</h2>
                  <p className="text-gray-500 font-mono text-sm">AI is summarizing transcript & context</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-black p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-surface border border-gray-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-8 border-b border-gray-800 text-center">
            <div className="inline-flex p-3 bg-gray-900 rounded-full mb-4 border border-gray-700">
                <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Meeting Minutes Generated</h1>
            <p className="text-gray-400 font-mono text-sm">Session ID: #8X92-ALPHA</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
            
            <div className="space-y-4">
                <h3 className="text-xs font-mono text-primary uppercase tracking-widest border-b border-gray-800 pb-2">Key Highlights</h3>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-gray-300">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span>Project Timeline for Q3 approved by all stakeholders.</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span>Budget cap set to <span className="text-white font-bold">$5,000</span> for initial deployment.</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-300">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span>Team agreed to switch to "EchoLink AI" for future comms.</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-mono text-secondary uppercase tracking-widest border-b border-gray-800 pb-2">Action Items</h3>
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-white">Review Design Specs</span>
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">HIGH PRIORITY</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">Assigned to: Design Team • Due: Monday</p>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-black/20 flex justify-center">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-mono"
            >
                <ArrowLeft className="w-4 h-4" /> Return to Hub
            </button>
        </div>
      </div>
    </div>
  );
};
