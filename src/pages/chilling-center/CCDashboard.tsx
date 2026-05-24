import React, { useEffect, useState, useCallback } from 'react';
import { Milk, Users, Beaker, Truck, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections, getFarmers, getDispatches, getChillingCenter } from '@/services/api';
import type { ChillingCenter } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveCache, getCache } from '@/services/offlineSync';
import { getDispatchEligibleCollections, getQualityEligibleCollections } from '@/services/offlinePreload';
import { buildDashboardStats, type DashboardStats } from '@/services/dashboardStatsHelpers';
import type { HistoryCollection } from '@/services/collectionDisplayHelpers';

const OFFLINE_RELOAD_EVENTS = [
  'offline-action-saved',
  'offline-sync-started',
  'offline-sync-complete',
  'online',
  'offline',
] as const;

const emptyStats: DashboardStats = {
  farmerCount: 0,
  totalQuantity: 0,
  qualityPassRate: 0,
  dispatchCount: 0,
  recentCollections: [],
};

const CCDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [centerDetails, setCenterDetails] = useState<ChillingCenter | null>(null);

  const loadDashboard = useCallback(async () => {
    const centerId = user?.chillingCenterId;
    if (!centerId) {
      setLoading(false);
      return;
    }

    setStats(buildDashboardStats());
    const cachedCenter = getCache('chilling_center_details');
    if (cachedCenter) setCenterDetails(cachedCenter);
    setLoading(false);

    if (!navigator.onLine) return;

    const [colsResult, farmersResult, dispatchesResult, detailsResult] = await Promise.allSettled([
      getCollections(centerId),
      getFarmers(centerId),
      getDispatches(centerId),
      getChillingCenter(centerId),
    ]);

    if (colsResult.status === 'fulfilled') {
      saveCache('collection_history', colsResult.value);
      saveCache('collections', colsResult.value);
      saveCache('dispatch_all_collections', colsResult.value);
      saveCache('quality_eligible_collections', getQualityEligibleCollections(colsResult.value));
      saveCache('dispatch_eligible_collections', getDispatchEligibleCollections(colsResult.value));
    }

    if (farmersResult.status === 'fulfilled') {
      saveCache('farmers', farmersResult.value);
    }

    if (dispatchesResult.status === 'fulfilled') {
      saveCache('dispatch_history', dispatchesResult.value);
    }

    if (detailsResult.status === 'fulfilled') {
      saveCache('chilling_center_details', detailsResult.value);
      setCenterDetails(detailsResult.value);
    }

    setStats(
      buildDashboardStats(
        colsResult.status === 'fulfilled' ? colsResult.value : undefined,
        farmersResult.status === 'fulfilled' ? farmersResult.value : undefined,
        dispatchesResult.status === 'fulfilled' ? dispatchesResult.value : undefined
      )
    );
  }, [user]);

  useEffect(() => {
    loadDashboard();

    const handleUpdate = () => loadDashboard();
    OFFLINE_RELOAD_EVENTS.forEach(event => window.addEventListener(event, handleUpdate));
    return () => OFFLINE_RELOAD_EVENTS.forEach(event => window.removeEventListener(event, handleUpdate));
  }, [loadDashboard]);

  const recentColumns = [
    { key: 'farmerCode', header: 'Farmer ID', render: (r: HistoryCollection) => r.farmerCode || r.farmerId || '—' },
    { key: 'farmerName', header: 'Name' },
    { key: 'date', header: 'Date', render: (r: HistoryCollection) => formatDate(r.date) },
    { key: 'quantity', header: 'Qty (L)', render: (r: HistoryCollection) => formatQuantity(r.quantity) },
    {
      key: 'qualityResult',
      header: 'Quality',
      render: (r: HistoryCollection) => {
        if (r.isOffline && !r.qualityResult) return <StatusBadge status="Pending Sync" />;
        return r.qualityResult ? <StatusBadge status={r.qualityResult} /> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: 'dispatchStatus',
      header: 'Status',
      render: (r: HistoryCollection) => {
        if (r.qualityResult === 'Fail') return <StatusBadge status="Rejected" />;
        if (r.isOffline) return <StatusBadge status="Pending Sync" />;
        return r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">{user?.chillingCenterName || 'Chilling Center Dashboard'}</p>
        </div>
        {centerDetails?.show_alert === false && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-100 animate-in fade-in zoom-in">
            <TrendingUp className="w-3.5 h-3.5" />
            Performance: Good
          </div>
        )}
      </div>

      {centerDetails?.show_alert === true && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 shadow-sm animate-in slide-in-from-top-2 duration-500">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800 font-bold flex items-center gap-2 text-lg">
            Performance Alert: Needs Improvement
          </AlertTitle>
          <AlertDescription className="text-amber-700 mt-2">
            <div className="flex flex-col gap-2">
              <p className="font-medium">
                {centerDetails.performance_recommendation || 'Your quality pass rate has dropped below the required threshold. Please review your cooling and testing procedures.'}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs opacity-80">
                <Info className="w-3.5 h-3.5" />
                This status is automatically calculated based on your dispatch history. Alert triggers when quality pass rate drops below 75%.
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Registered Farmers" value={stats.farmerCount} icon={Users} variant="default" trend={{ value: 12, label: 'this month' }} />
        <StatCard title="Total Collection" value={formatQuantity(stats.totalQuantity)} icon={Milk} variant="success" trend={{ value: 8, label: 'vs last week' }} />
        <StatCard title="Quality Pass Rate" value={`${stats.qualityPassRate}%`} icon={Beaker} variant={stats.qualityPassRate >= 75 ? 'success' : 'warning'} />
        <StatCard title="Dispatches" value={stats.dispatchCount} icon={Truck} variant="default" />
      </div>

      <div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-3">Recent Collections</h3>
        <DataTable columns={recentColumns} data={stats.recentCollections} loading={loading} />
      </div>
    </div>
  );
};

export default CCDashboard;
