import React, { useEffect, useState } from 'react';
import { Milk, Users, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { getFarmers, getCollections, getDispatches, getPayments, getNestleOfficers } from '@/services/api';
import { formatCurrency, formatQuantity, parseNumber } from '@/lib/utils';

import { useAuth } from '@/contexts/AuthContext';

const NestleDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ farmers: 0, totalQty: 0, dispatches: 0, totalPayments: 0, nestleOfficers: 0 });

  useEffect(() => {
    getFarmers().then(f => setStats(s => ({ ...s, farmers: f.length }))).catch(console.error);
    
    getCollections().then(cols => {
      setStats(s => ({ ...s, totalQty: cols.reduce((sum, c) => sum + parseNumber(c.quantity), 0) }));
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
    </div>
  );
};

export default NestleDashboard;
