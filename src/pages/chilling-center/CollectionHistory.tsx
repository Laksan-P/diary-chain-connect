import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';

import { getPendingActions, saveCache, getCache } from '@/services/offlineSync';

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
          saveCache('cache_collection_history', serverCols);
          saveCache('dispatch_all_collections', serverCols); // Sync for Dispatch page
        } catch (err) {
          console.error('Failed to load history:', err);
          serverCols = getCache('cache_collection_history') || [];
        }

        try {
          // Always show unsync'd offline records on top (they disappear after sync)
          const cachedFarmersStr = localStorage.getItem('cache_farmers');
          const cachedFarmers = cachedFarmersStr ? JSON.parse(cachedFarmersStr) : [];
          
          const allPending = getPendingActions();
          const allQuality = allPending.filter(a => a.type === 'quality');
          const allDispatches = allPending.filter(d => d.type === 'dispatch');

          const pending = allPending
            .filter(a => a.type === 'collection' && a.data)
            .map(a => {
              // Look up farmer code
              const farmerId = a.data?.farmerId;
              const farmer = cachedFarmers.find((f: any) => f && String(f.id) === String(farmerId));

              // Check if quality tested offline
              const qualityTest = allQuality.find(q => q.data?.offlineCollectionId === a.id);
              const qualityResult = qualityTest ? qualityTest.data.result : 'Pending';
              const failureReason = qualityTest ? qualityTest.data.reason : undefined;

              // Check if dispatched offline
              const dispatched = allDispatches.some(d =>
                d.data?.items?.some((i: any) => i.offlineCollectionId === a.id)
              );

              // Strict fallbacks
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

          // Apply offline actions to server collections
          const updatedServerCols = serverCols.map(col => {
            if (!col) return null;
            // Check if quality tested offline
            const qualityTest = allQuality.find(q => q.data && String(q.data.collectionId) === String(col.id));
            const qualityResult = qualityTest ? qualityTest.data.result : col.qualityResult;
            const failureReason = qualityTest ? qualityTest.data.reason : col.failureReason;

            // Check if dispatched offline
            const dispatched = allDispatches.some(d =>
              d.data?.items?.some((i: any) => i && String(i.collectionId) === String(col.id))
            );

            return {
              ...col,
              qualityResult,
              failureReason: failureReason || '—',
              dispatchStatus: dispatched ? 'Dispatched' : col.dispatchStatus,
            };
          }).filter(Boolean);

          setCollections([...pending, ...updatedServerCols]);
        } catch (innerErr) {
          console.error('Error processing offline data:', innerErr);
          setCollections(serverCols); // Fallback to just server data
        }

        setLoading(false);
      } else {
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
    { 
      key: 'dispatchStatus', 
      header: 'Dispatch', 
      render: (r: MilkCollection) => {
        if (r.qualityResult === 'Fail') return <StatusBadge status="Rejected" />;
        return r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span>;
      } 
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
