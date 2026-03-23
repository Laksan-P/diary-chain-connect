import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import { getCenterPerformance } from '@/services/api';
import type { CenterPerformance } from '@/types';

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<CenterPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCenterPerformance().then(d => { setData(d); setLoading(false); }); }, []);

  const totalQty = data.reduce((s, d) => s + d.totalQuantity, 0);
  const totalRev = data.reduce((s, d) => s + d.totalRevenue, 0);
  const avgQuality = data.length ? (data.reduce((s, d) => s + d.qualityRate, 0) / data.length).toFixed(1) : '0';

  const rankColumns = [
    { key: 'rank', header: 'Rank', render: (r: CenterPerformance) => (
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${r.rank === 1 ? 'bg-amber-100 text-amber-700' : r.rank === 2 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
        {r.rank}
      </span>
    )},
    { key: 'centerName', header: 'Center' },
    { key: 'totalQuantity', header: 'Total (L)', render: (r: CenterPerformance) => `${r.totalQuantity.toLocaleString()} L` },
    { key: 'avgQuantity', header: 'Avg/Day (L)', render: (r: CenterPerformance) => `${r.avgQuantity} L` },
    { key: 'totalRevenue', header: 'Revenue', render: (r: CenterPerformance) => `Rs. ${r.totalRevenue.toLocaleString()}` },
    { key: 'qualityRate', header: 'Quality %', render: (r: CenterPerformance) => (
      <span className={`font-semibold ${r.qualityRate >= 90 ? 'text-accent' : r.qualityRate >= 80 ? 'text-amber-600' : 'text-destructive'}`}>{r.qualityRate}%</span>
    )},
  ];

  // Mock trend data
  const trendData = [
    { month: 'Oct', qty: 22000, revenue: 1870000 },
    { month: 'Nov', qty: 24500, revenue: 2082500 },
    { month: 'Dec', qty: 23000, revenue: 1955000 },
    { month: 'Jan', qty: 26000, revenue: 2210000 },
    { month: 'Feb', qty: 27500, revenue: 2337500 },
    { month: 'Mar', qty: 29500, revenue: 2507500 },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-primary" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Chilling Center Performance</h2>
          <p className="text-sm text-muted-foreground">Analytics and rankings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Supply" value={`${totalQty.toLocaleString()} L`} icon={BarChart3} variant="success" />
        <StatCard title="Total Revenue" value={`Rs. ${totalRev.toLocaleString()}`} icon={Trophy} variant="default" />
        <StatCard title="Avg Quality Rate" value={`${avgQuality}%`} icon={BarChart3} variant="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div className="glass-card p-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="font-display font-semibold text-foreground mb-4">Supply by Center</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="centerName" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="totalQuantity" fill="hsl(209 100% 29%)" radius={[6, 6, 0, 0]} name="Total Quantity (L)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="glass-card p-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="font-display font-semibold text-foreground mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="qty" stroke="hsl(209 100% 29%)" strokeWidth={2} dot={{ r: 4 }} name="Quantity (L)" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Center Rankings
        </h3>
        <DataTable columns={rankColumns} data={data} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
