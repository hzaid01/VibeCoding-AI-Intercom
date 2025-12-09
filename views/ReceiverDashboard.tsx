import React, { useState } from 'react';
import { ArrowLeft, Wifi, Volume2 } from 'lucide-react';

interface ReceiverDashboardProps {
  onBack: () => void;
}

export const ReceiverDashboard: React.FC<ReceiverDashboardProps> = ({ onBack }) => {
  const [isConnected, setIsConnected] = useState(false);

  // Simulation of connection after 3 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
        // In a real app, this would be triggered by a WebRTC connection event
        // keeping it false for now to show the "Waiting" state as requested.
        // setIsConnected(true); 
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
           <Volume2 className="w-5 h-5 text-blue-400" />
           <span className="font-bold tracking-tight">RECEIVER</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
        
        {/* Ripple Animation Container */}
        <div className="relative w-64 h-64 flex items-center justify-center mb-8">
            {/* Ripples */}
            {!isConnected && (
                <>
                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ripple" style={{ animationDelay: '0s' }}></div>
                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ripple" style={{ animationDelay: '1s' }}></div>
                </>
            )}
            
            {/* Center Icon */}
            <div className="relative z-10 w-20 h-20 bg-surface rounded-full flex items-center justify-center border-2 border-blue-500/30 shadow-lg">
                <Wifi className={`w-8 h-8 ${isConnected ? 'text-green-400' : 'text-blue-400 animate-pulse'}`} />
            </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
            {isConnected ? 'Connected' : 'Waiting for connection...'}
        </h2>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
            {isConnected 
                ? 'Audio stream is active. Adjust volume as needed.' 
                : 'Listening for incoming audio streams from the Transmitter.'}
        </p>

        {isConnected && (
             <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm font-medium animate-fade-in">
                ● Live Audio active
             </div>
        )}
      </div>
    </div>
  );
};