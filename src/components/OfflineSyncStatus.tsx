import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSyncSummary, requestSync } from '@/services/offlineSync';

const OfflineSyncStatus: React.FC = () => {
  const [summary, setSummary] = useState(getSyncSummary());
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);

  const refresh = () => {
    setSummary(getSyncSummary());
    setBrowserOnline(navigator.onLine);
  };

  useEffect(() => {
    const events = ['offline-action-saved', 'offline-sync-started', 'offline-sync-complete', 'online', 'offline'];
    events.forEach(e => window.addEventListener(e, refresh));
    return () => events.forEach(e => window.removeEventListener(e, refresh));
  }, []);

  const showBanner = !browserOnline || summary.total > 0 || summary.isSyncing;

  if (!showBanner) return null;

  let statusLabel = 'Pending';
  let statusDetail = `${summary.pending} action(s) waiting to sync`;
  let tone = 'amber';
  let Icon = AlertTriangle;

  if (!browserOnline) {
    statusLabel = 'Offline';
    statusDetail =
      summary.total > 0
        ? `${summary.total} action(s) saved locally and will sync when online`
        : 'Data will sync when connection is restored';
    tone = 'red';
    Icon = WifiOff;
  } else if (summary.isSyncing || summary.syncing > 0) {
    statusLabel = 'Syncing';
    statusDetail = 'Uploading offline records to server…';
    tone = 'blue';
    Icon = Loader2;
  } else if (summary.failed > 0) {
    statusLabel = 'Retry required';
    statusDetail = `${summary.failed} action(s) failed — tap Retry to sync again`;
    tone = 'red';
    Icon = RefreshCw;
  } else if (summary.total === 0 && browserOnline) {
    statusLabel = 'Synced';
    statusDetail = 'All offline records are up to date';
    tone = 'green';
    Icon = CheckCircle2;
  }

  const toneClasses = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-800',
    red: 'bg-destructive/10 border-destructive/20 text-destructive',
    blue: 'bg-primary/10 border-primary/20 text-primary',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800',
  }[tone];

  return (
    <div className={`border-b py-2 px-6 flex items-center gap-3 ${toneClasses}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${statusLabel === 'Syncing' ? 'animate-spin' : ''}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{statusLabel}</p>
        <p className="text-[11px] opacity-80 truncate">{statusDetail}</p>
      </div>
      {browserOnline && summary.failed > 0 && !summary.isSyncing && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => requestSync()}
        >
          Retry
        </Button>
      )}
    </div>
  );
};

export default OfflineSyncStatus;
