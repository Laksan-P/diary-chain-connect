import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, History } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections, deleteCollection } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  getPendingActions,
  saveCache,
  getCache,
  removePendingAction,
  mergeFarmersWithPending,
} from '@/services/offlineSync';
import { mergeCollectionHistory, type HistoryCollection } from '@/services/collectionDisplayHelpers';

const CollectionHistory: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<HistoryCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    const centerId = user?.chillingCenterId;
    if (!centerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let serverCols: HistoryCollection[] = getCache('collection_history') || [];

      if (navigator.onLine) {
        try {
          const freshCols = await getCollections(centerId);
          serverCols = freshCols;
          saveCache('collection_history', freshCols);
          saveCache('dispatch_all_collections', freshCols);
        } catch (err) {
          console.error('Failed to fetch fresh history:', err);
        }
      }

      const pendingActions = getPendingActions();
      const idMappings = getCache('sync_id_mappings') || { collections: {}, farmers: {} };
      const farmers = mergeFarmersWithPending(getCache('farmers') || []);

      const merged = mergeCollectionHistory(serverCols, pendingActions, farmers, idMappings);
      setCollections(merged);
    } catch (err) {
      console.error('loadHistory failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => loadHistory();
    const events = [
      'offline-action-saved',
      'offline-sync-started',
      'offline-sync-complete',
      'online',
      'offline',
    ];
    events.forEach(event => window.addEventListener(event, handleUpdate));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUpdate));
    };
  }, [loadHistory]);

  const handleDelete = async (row: HistoryCollection) => {
    if (!confirm('Are you sure you want to delete this collection record?')) return;

    try {
      if (row.isOffline) {
        removePendingAction(String(row.realOfflineId || row.id));
        toast({ title: 'Success', description: 'Offline record removed' });
      } else {
        await deleteCollection(Number(row.id));
        toast({ title: 'Success', description: 'Collection record deleted' });
      }

      setCollections(prev => prev.filter(c => String(c.id) !== String(row.id)));
      loadHistory();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'farmerName', header: 'Name' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'milkType', header: 'Milk Type', render: (r: MilkCollection) => r.milkType || 'Cow' },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'temperature', header: 'Temp (°C)', render: (r: MilkCollection) => `${r.temperature}°C` },
    {
      key: 'qualityResult',
      header: 'Quality',
      render: (r: HistoryCollection) =>
        r.qualityResult ? <StatusBadge status={r.qualityResult} /> : '—',
    },
    { key: 'failureReason', header: 'Reason', render: (r: MilkCollection) => r.failureReason || '—' },
    {
      key: 'dispatchStatus',
      header: 'Dispatch',
      render: (r: HistoryCollection) => {
        if (r.qualityResult === 'Fail') return <StatusBadge status="Rejected" />;
        if (r.isOffline && r.dispatchStatus === 'Pending Sync') {
          return <StatusBadge status="Pending Sync" />;
        }
        return r.dispatchStatus ? (
          <StatusBadge status={r.dispatchStatus} />
        ) : (
          <span className="text-muted-foreground">Pending</span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: HistoryCollection) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(r)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
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
