import React, { useEffect, useState } from 'react';
import { Milk, Users, Beaker, Truck } from 'lucide-react';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { getCollections, getFarmers } from '@/services/api';
import type { MilkCollection } from '@/types';
import { formatDate, formatQuantity, parseNumber } from '@/lib/utils';

const CCDashboard: React.FC = () => {
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmerCount, setFarmerCount] = useState(0);

  useEffect(() => {
    Promise.all([getCollections(1), getFarmers()]).then(([cols, farmers]) => {
      setCollections(cols);
      setFarmerCount(farmers.filter(f => f.chillingCenterId === 1).length);
      setLoading(false);
    });
  }, []);

  const totalQty = collections.reduce((s, c) => s + parseNumber(c.quantity), 0);
  const passRate = collections.length ? Math.round((collections.filter(c => c.qualityResult === 'Pass').length / collections.length) * 100) : 0;

  const recentColumns = [
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'farmerName', header: 'Name' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'qualityResult', header: 'Quality', render: (r: MilkCollection) => r.qualityResult ? <StatusBadge status={r.qualityResult} /> : <span className="text-muted-foreground">—</span> },
    { key: 'dispatchStatus', header: 'Status', render: () => <span className="text-muted-foreground">—</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">Kandy Central Chilling Center</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Registered Farmers" value={farmerCount} icon={Users} variant="default" trend={{ value: 12, label: 'this month' }} />
        <StatCard title="Total Collection" value={formatQuantity(totalQty)} icon={Milk} variant="success" trend={{ value: 8, label: 'vs last week' }} />
        <StatCard title="Quality Pass Rate" value={`${passRate}%`} icon={Beaker} variant={passRate >= 90 ? 'success' : 'warning'} />
        <StatCard title="Dispatches" value={collections.filter(c => c.dispatchStatus === 'Dispatched').length} icon={Truck} variant="default" />
      </div>

      <div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-3">Recent Collections</h3>
        <DataTable columns={recentColumns} data={collections.slice(0, 10)} loading={loading} />
      </div>
    </div>
  );
};

export default CCDashboard;
