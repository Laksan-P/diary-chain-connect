import React, { useEffect, useState } from 'react';
import { Trash2, History } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections, deleteCollection } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

import { getPendingActions, saveCache, getCache, removePendingAction } from '@/services/offlineSync';

const CollectionHistory: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      const centerId = user?.chillingCenterId;
      if (!centerId) {
        setLoading(false);
        return;
      }

      try {
        let serverCols: any[] = [];

        // 1. Load from cache immediately for instant UI
        const cachedHistory = getCache('cache_collection_history') || [];
        serverCols = cachedHistory;

        // 2. Only attempt network fetch if online
        if (navigator.onLine) {
          try {
            const freshCols = await getCollections(centerId);
            serverCols = freshCols;
            saveCache('cache_collection_history', freshCols);
            saveCache('dispatch_all_collections', freshCols);
          } catch (err) {
            console.error('Failed to fetch fresh history:', err);
          }
        }

        // Always show unsync'd offline records on top (they disappear after sync)
        const cachedFarmersStr = localStorage.getItem('cache_farmers');
        const cachedFarmers = cachedFarmersStr ? JSON.parse(cachedFarmersStr) : [];

        const allPending = getPendingActions();
        const allQuality = allPending.filter(a => a.type === 'quality');
        const allDispatches = allPending.filter(d => d.type === 'dispatch');

        const pending = allPending
          .filter(a => a.type === 'collection' && a.data)
          .map(a => {
            const farmerId = a.data?.farmerId;
            const farmer = cachedFarmers.find((f: any) => f && String(f.id) === String(farmerId));
            const qualityTest = allQuality.find(q => q.data?.offlineCollectionId === a.id);
            const qualityResult = qualityTest ? qualityTest.data.result : 'Pending';
            const failureReason = qualityTest ? qualityTest.data.reason : undefined;
            const dispatched = allDispatches.some(d =>
              d.data?.items?.some((i: any) => i.offlineCollectionId === a.id)
            );
            const finalFarmerName = a.data?.farmerName?.trim() || farmer?.name?.trim() || 'Offline Farmer';
            const finalFarmerCode = farmer?.farmerId?.trim() || (farmerId ? String(farmerId) : 'OFF-F');

            return {
              ...a.data,
              id: a.id,
              farmerCode: finalFarmerCode,
              farmerName: finalFarmerName,
              qualityResult: qualityResult,
              failureReason: failureReason || '—',
              dispatchStatus: dispatched ? 'Dispatched' : 'Pending',
              isOffline: true,
            };
          });

        const updatedServerCols = serverCols.map(col => {
          if (!col) return null;
          const qualityTest = allQuality.find(q => q.data && String(q.data.collectionId) === String(col.id));
          const dispatched = allDispatches.some(d =>
            d.data?.items?.some((i: any) => i && String(i.collectionId) === String(col.id))
          );
          return {
            ...col,
            qualityResult: qualityTest ? qualityTest.data.result : col.qualityResult,
            failureReason: (qualityTest ? qualityTest.data.reason : col.failureReason) || '—',
            dispatchStatus: dispatched ? 'Dispatched' : col.dispatchStatus,
          };
        }).filter(Boolean);

        setCollections([...pending, ...updatedServerCols]);
        setLoading(false);
      } catch (err) {
        console.error('loadHistory failed:', err);
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

  const handleDelete = async (row: any) => {
    if (!confirm('Are you sure you want to delete this collection record?')) return;

    try {
      if (row.isOffline) {
        removePendingAction(row.id);
        toast({ title: 'Success', description: 'Offline record removed' });
      } else {
        await deleteCollection(row.id);
        toast({ title: 'Success', description: 'Collection record deleted' });
      }

      // Update local state immediately for better UX
      setCollections(prev => prev.filter(c => c.id !== row.id));
    } catch (err) {
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
    { key: 'qualityResult', header: 'Quality', render: (r: MilkCollection) => r.qualityResult ? <StatusBadge status={r.qualityResult} /> : '—' },
    { key: 'failureReason', header: 'Reason', render: (r: MilkCollection) => r.failureReason || '—' },
    {
      key: 'dispatchStatus',
      header: 'Dispatch',
      render: (r: MilkCollection) => {
        if (r.qualityResult === 'Fail') return <StatusBadge status="Rejected" />;
        return r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span>;
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(r)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )
    }
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
