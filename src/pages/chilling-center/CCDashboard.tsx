import React, { useEffect, useState } from 'react';
import { Milk, Users, Beaker, Truck, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections, getFarmers, getDispatches, getChillingCenter } from '@/services/api';
import type { MilkCollection, ChillingCenter } from '@/types';
import { formatDate, formatQuantity, parseNumber } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const CCDashboard: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmerCount, setFarmerCount] = useState(0);
  const [dispatchCount, setDispatchCount] = useState(0);
  const [centerDetails, setCenterDetails] = useState<ChillingCenter | null>(null);

  useEffect(() => {
    const centerId = user?.chillingCenterId;
    if (centerId) {
      Promise.all([
        getCollections(centerId), 
        getFarmers(centerId), 
        getDispatches(centerId),
        getChillingCenter(centerId)
      ]).then(([cols, farmers, dispatches, details]) => {
        setCollections(cols);
        setFarmerCount(farmers.length);
        setDispatchCount(dispatches.length);
        setCenterDetails(details);
        setLoading(false);
      }).catch(err => {
        console.error('Failed to load dashboard data:', err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  if (centerDetails) {
    console.log(`[Frontend CC Debug] PassRate: ${centerDetails.quality_pass_rate}, Status: ${centerDetails.performance_status}, ShowAlert: ${centerDetails.show_alert}`);
  }

  const totalQty = collections.reduce((s, c) => s + parseNumber(c.quantity), 0);
  const displayPassRate = centerDetails?.quality_pass_rate ?? 0;

  const recentColumns = [
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'farmerName', header: 'Name' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'qualityResult', header: 'Quality', render: (r: MilkCollection) => r.qualityResult ? <StatusBadge status={r.qualityResult} /> : <span className="text-muted-foreground">—</span> },
    { key: 'dispatchStatus', header: 'Status', render: (r: MilkCollection) => r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span> },
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
        <StatCard title="Registered Farmers" value={farmerCount} icon={Users} variant="default" trend={{ value: 12, label: 'this month' }} />
        <StatCard title="Total Collection" value={formatQuantity(totalQty)} icon={Milk} variant="success" trend={{ value: 8, label: 'vs last week' }} />
        <StatCard title="Quality Pass Rate" value={`${displayPassRate}%`} icon={Beaker} variant={displayPassRate >= 75 ? 'success' : 'warning'} />
        <StatCard title="Dispatches" value={dispatchCount} icon={Truck} variant="default" />
      </div>

      <div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-3">Recent Collections</h3>
        <DataTable columns={recentColumns} data={collections.slice(0, 10)} loading={loading} />
      </div>
    </div>
  );
};

export default CCDashboard;
