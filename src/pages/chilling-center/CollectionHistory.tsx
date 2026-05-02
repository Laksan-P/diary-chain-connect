import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';

import { getPendingActions } from '@/services/offlineSync';

const CollectionHistory: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    const loadHistory = async () => {
      if (user?.chillingCenterId) {
        let serverCols: any[] = [];
        try {
          serverCols = await getCollections(user.chillingCenterId);
        } catch (err) {
          // No cache for history yet, but we should at least show pending
          console.error('Failed to load history:', err);
        }

        const pending = getPendingActions()
          .filter(a => a.type === 'collection')
          .map(a => ({ 
            ...a.data, 
            id: a.id, 
            qualityResult: 'Pending Sync', 
            dispatchStatus: 'Pending Sync',
            isOffline: true 
          }));
        
        setCollections([...pending, ...serverCols]); 
        setLoading(false); 
      }
    };
    loadHistory();

    const handleUpdate = () => loadHistory();
    window.addEventListener('offline-action-saved', handleUpdate);
    window.addEventListener('offline-sync-complete', handleUpdate);
    window.addEventListener('online', handleUpdate);

    return () => {
      window.removeEventListener('offline-action-saved', handleUpdate);
      window.removeEventListener('offline-sync-complete', handleUpdate);
      window.removeEventListener('online', handleUpdate);
    };
  }, [user]);

  const columns = [
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'farmerName', header: 'Name' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'milkType', header: 'Milk Type', render: (r: MilkCollection) => r.milkType || 'Cow' },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'temperature', header: 'Temp (°C)', render: (r: MilkCollection) => `${r.temperature}°C` },
    { key: 'qualityResult', header: 'Quality', render: (r: MilkCollection) => r.qualityResult ? <StatusBadge status={r.qualityResult} /> : '—' },
    { key: 'failureReason', header: 'Reason', render: (r: MilkCollection) => r.failureReason || '—' },
    { key: 'dispatchStatus', header: 'Dispatch', render: (r: MilkCollection) => r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Collection History</h2>
          <p className="text-sm text-muted-foreground">All recorded milk collections</p>
        </div>
      </div>
      <DataTable columns={columns} data={collections} loading={loading} />
    </div>
  );
};

export default CollectionHistory;
