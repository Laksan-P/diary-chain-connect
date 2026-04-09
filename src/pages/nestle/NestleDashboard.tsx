import React, { useEffect, useState } from 'react';
import { Milk, Users, Truck, Building2, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { getFarmers, getCollections, getDispatches, getPayments, getNestleOfficers, getChillingCenters } from '@/services/api';
import { formatCurrency, formatQuantity, parseNumber } from '@/lib/utils';

import { useAuth } from '@/contexts/AuthContext';

const NestleDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
    farmers: 0, 
    totalQty: 0, 
    dispatches: 0, 
    pendingDispatches: 0, 
    nestleOfficers: 0, 
    chillingCenters: 0,
    totalPayouts: 0,
    pendingPayouts: 0
  });
  const [recentDispatches, setRecentDispatches] = useState<any[]>([]);

  useEffect(() => {
    getFarmers().then(f => setStats(s => ({ ...s, farmers: f.length }))).catch(console.error);

    getCollections().then(cols => {
      setStats(s => ({ ...s, totalQty: cols.reduce((sum, c) => sum + parseNumber(c.quantity), 0) }));
    }).catch(console.error);

    getDispatches().then(d => {
      setStats(s => ({ 
        ...s, 
        dispatches: d.length,
        pendingDispatches: d.filter(x => x.status === 'Dispatched').length
      }));
      setRecentDispatches(d.slice(0, 5));
    }).catch(console.error);

    getPayments().then(p => {
      setStats(s => ({ 
        ...s, 
        totalPayouts: p.reduce((sum, x) => sum + parseNumber(x.amount), 0),
        pendingPayouts: p.filter(x => x.status === 'Pending').reduce((sum, x) => sum + parseNumber(x.amount), 0)
      }));
    }).catch(console.error);

    getNestleOfficers().then(o => setStats(s => ({ ...s, nestleOfficers: o.length }))).catch(console.error);
    getChillingCenters().then(c => setStats(s => ({ ...s, chillingCenters: c.length }))).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-2xl border border-primary/20">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Welcome back, {user?.name}!</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            Nestlé Dairy Supply Chain Overview 
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">Live</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.pendingDispatches > 0 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 bg-warning/10 border border-warning/20 p-3 rounded-xl"
            >
              <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-warning-foreground">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-warning-foreground leading-tight">{stats.pendingDispatches} Pending Dispatches</p>
                <a href="/nestle/dispatches" className="text-[10px] text-warning-foreground/70 underline underline-offset-2 hover:text-warning-foreground transition-colors">Action Required</a>
              </div>
            </motion.div>
          )}
          {stats.pendingPayouts > 0 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-xl"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <span className="text-xs font-bold">Rs.</span>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800 leading-tight">Unprocessed Payments</p>
                <p className="text-[10px] text-emerald-600 font-bold">{formatCurrency(stats.pendingPayouts)}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Farmers" value={stats.farmers} icon={Users} variant="default" />
        <StatCard title="Milk Collected" value={formatQuantity(stats.totalQty)} icon={Milk} variant="success" />
        <StatCard title="Payouts (Total)" value={formatCurrency(stats.totalPayouts)} icon={DollarSign} variant="default" />
        <StatCard title="Dispatches" value={stats.dispatches} icon={Truck} variant="default" />
        <StatCard title="Active Centers" value={stats.chillingCenters} icon={Building2} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-foreground">Recent Transport Activity</h3>
            <a href="/nestle/dispatches" className="text-xs text-primary hover:underline">View All</a>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Center</th>
                  <th className="px-4 py-3">Transporter</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDispatches.length > 0 ? recentDispatches.map(d => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-xs">#{d.id}</td>
                    <td className="px-4 py-3 text-xs">{d.chillingCenterName}</td>
                    <td className="px-4 py-3 text-xs">{d.transporterName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent dispatches</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-display font-bold text-foreground">Supply Chain Health</h3>
          <div className="glass-card p-5 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Milk Quality Pass Rate</span>
                <span className="text-emerald-600 font-bold">94%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Dispatch Approval Speed</span>
                <span className="text-primary font-bold">88%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '88%' }} />
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                "Nestlé consistently maintains a high quality standard across all region chilling centers."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NestleDashboard;
