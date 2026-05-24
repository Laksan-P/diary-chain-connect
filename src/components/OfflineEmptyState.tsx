import React from 'react';
import { WifiOff } from 'lucide-react';
import { OFFLINE_EMPTY_MESSAGE } from '@/services/offlinePreload';

const OfflineEmptyState: React.FC<{ message?: string; className?: string }> = ({
  message = OFFLINE_EMPTY_MESSAGE,
  className = '',
}) => (
  <div className={`rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3 ${className}`}>
    <WifiOff className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
    <p className="text-sm text-amber-800">{message}</p>
  </div>
);

export default OfflineEmptyState;
