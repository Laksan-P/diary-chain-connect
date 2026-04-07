import React, { useEffect, useState } from 'react';
import { Milk, Users, Truck, Activity, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { getFarmers, getCollections, getDispatches, getPayments, getNestleOfficers } from '@/services/api';
import { formatCurrency, formatQuantity, parseNumber, formatDate } from '@/lib/utils';
import type { MilkCollection } from '@/types';

import { useAuth } from '@/contexts/AuthContext';

const NestleDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ farmers: 0, totalQty: 0, dispatches: 0, totalPayments: 0, nestleOfficers: 0 });

  const [recentCols, setRecentCols] = useState<MilkCollection[]>([]);

  useEffect(() => {
    getFarmers().then(f => setStats(s => ({ ...s, farmers: f.length }))).catch(console.error);
    
    getCollections().then(cols => {
      setStats(s => ({ ...s, totalQty: cols.reduce((sum, c) => sum + parseNumber(c.quantity), 0) }));
      setRecentCols(cols.slice(0, 5));
    }).catch(console.error);
    
    getDispatches().then(d => setStats(s => ({ ...s, dispatches: d.length }))).catch(console.error);
    
    getNestleOfficers().then(o => setStats(s => ({ ...s, nestleOfficers: o.length }))).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-2xl border border-primary/20">
        <h2 className="text-2xl font-display font-bold text-foreground">Welcome, {user?.name}!</h2>
        <p className="text-muted-foreground">Nestlé Dairy Supply Chain Overview</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Farmers" value={stats.farmers} icon={Users} trend={{ value: 15, label: 'growth' }} />
        <StatCard title="Total Milk Collected" value={formatQuantity(stats.totalQty)} icon={Milk} variant="success" trend={{ value: 8, label: 'this month' }} />
        <StatCard title="Active Dispatches" value={stats.dispatches} icon={Truck} variant="warning" />
        <StatCard title="Nestlé Officers" value={stats.nestleOfficers} icon={Users} trend={{ value: 0, label: 'team' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Recent Activity Pipeline</h3>
        </div>
        <div className="divide-y divide-sidebar-border">
          {recentCols.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No recent activity detected.</div>
          ) : (
            recentCols.map(col => (
              <div key={col.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {col.farmerName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{col.farmerName} recorded a delivery</p>
                    <p className="text-xs text-muted-foreground">{col.chillingCenterName || 'System'} • {formatDate(col.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">+{col.quantity}L</p>
                  <p className={`text-xs ${col.qualityResult === 'Pass' ? 'text-green-500' : col.qualityResult === 'Fail' ? 'text-red-500' : 'text-blue-500'}`}>
                    {col.qualityResult || 'Pending QA'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NestleDashboard;
