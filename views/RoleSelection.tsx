import React from 'react';
import { Radio, Headphones } from 'lucide-react';
import { RoleCard } from '../components/RoleCard';
import { AppRole } from '../types';

interface RoleSelectionProps {
  onRoleSelect: (role: AppRole) => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onRoleSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-4xl mx-auto">
      <div className="text-center mb-12 space-y-2">
        <h1 className="text-5xl font-bold tracking-tighter text-white">
          Call<span className="text-primary">Bridge</span>
        </h1>
        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Secure Audio Mirroring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <RoleCard
          title="Transmitter Mode"
          subtitle="Audio Source (Server)"
          icon={Radio}
          onClick={() => onRoleSelect(AppRole.TRANSMITTER)}
        />
        <RoleCard
          title="Receiver Mode"
          subtitle="Audio Client (Web)"
          icon={Headphones}
          onClick={() => onRoleSelect(AppRole.RECEIVER)}
        />
      </div>
      
      <p className="mt-12 text-gray-600 text-sm">Select a role to begin the session.</p>
    </div>
  );
};