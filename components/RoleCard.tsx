import React from 'react';
import { LucideIcon } from 'lucide-react';

interface RoleCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onClick: () => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ title, subtitle, icon: Icon, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-surface border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:border-primary hover:shadow-[0_0_20px_rgba(0,230,118,0.15)] group"
    >
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 font-medium">{subtitle}</p>
    </div>
  );
};