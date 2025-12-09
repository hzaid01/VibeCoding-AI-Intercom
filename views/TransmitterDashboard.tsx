import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Radio, ShieldCheck, ShieldAlert, ArrowLeft, Activity } from 'lucide-react';
import { Button } from '../components/Button';
import { PermissionService } from '../services/permissionService';
import { PermissionStatus, AppRole } from '../types';

interface TransmitterDashboardProps {
  onBack: () => void;
}

export const TransmitterDashboard: React.FC<TransmitterDashboardProps> = ({ onBack }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [micPermission, setMicPermission] = useState<PermissionStatus>(PermissionStatus.UNKNOWN);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Initial check (non-intrusive)
    PermissionService.checkMicrophonePermission().then(setMicPermission);
    
    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartService = async () => {
    if (isRunning) {
      // Stop Service
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setIsRunning(false);
    } else {
      // Start Service - Request Permissions
      const result = await PermissionService.requestMicrophoneAccess();
      setMicPermission(result.status);
      
      if (result.status === PermissionStatus.GRANTED && result.stream) {
        setStream(result.stream);
        setIsRunning(true);
      }
    }
  };

  const PermissionRow = ({ label, status }: { label: string; status: PermissionStatus }) => (
    <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex items-center gap-3">
        {status === PermissionStatus.GRANTED ? (
          <ShieldCheck className="w-5 h-5 text-primary" />
        ) : (
          <ShieldAlert className={`w-5 h-5 ${status === PermissionStatus.DENIED ? 'text-danger' : 'text-gray-500'}`} />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded ${
        status === PermissionStatus.GRANTED 
          ? 'bg-primary/20 text-primary' 
          : status === PermissionStatus.DENIED 
            ? 'bg-danger/20 text-danger' 
            : 'bg-gray-800 text-gray-400'
      }`}>
        {status}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
           <Radio className="w-5 h-5 text-primary" />
           <span className="font-bold tracking-tight">TRANSMITTER</span>
        </div>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Main Status Card */}
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        <div className="relative mb-8 text-center py-12">
          {isRunning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 bg-primary/20 rounded-full animate-ping opacity-75"></div>
            </div>
          )}
          <div className={`relative z-10 w-24 h-24 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            isRunning ? 'bg-background border-primary shadow-[0_0_30px_rgba(0,230,118,0.3)]' : 'bg-gray-800 border-gray-700'
          }`}>
            {isRunning ? (
              <Activity className="w-10 h-10 text-primary animate-pulse" />
            ) : (
              <MicOff className="w-10 h-10 text-gray-500" />
            )}
          </div>
          <h2 className={`mt-6 text-2xl font-bold ${isRunning ? 'text-primary' : 'text-danger'}`}>
            {isRunning ? 'Service Running' : 'Service Stopped'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {isRunning ? 'Capturing audio stream...' : 'Ready to start transmitter'}
          </p>
        </div>

        {/* Permission List */}
        <div className="space-y-3 mb-8">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Required Permissions</h3>
          <PermissionRow label="Microphone Access" status={micPermission} />
          {/* Simulating Phone State which is Android only, mapping to 'Internet' for Web context */}
          <PermissionRow label="Network/Internet" status={PermissionStatus.GRANTED} /> 
          <PermissionRow label="Modify Audio Settings" status={micPermission === PermissionStatus.GRANTED ? PermissionStatus.GRANTED : PermissionStatus.UNKNOWN} />
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          <Button 
            onClick={handleStartService} 
            fullWidth 
            variant={isRunning ? 'danger' : 'primary'}
          >
            {isRunning ? (
              <>
                <MicOff className="w-5 h-5" /> Stop Service
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" /> Start Service
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};