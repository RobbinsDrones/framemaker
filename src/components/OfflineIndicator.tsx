import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Offline Mode — All framing runs 100% locally on your device!</span>
    </div>
  );
};
