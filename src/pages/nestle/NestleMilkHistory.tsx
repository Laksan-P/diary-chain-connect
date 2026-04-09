import React, { useEffect, useState } from 'react';
import { History, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCollections, getChillingCenters } from '@/services/api';
import type { MilkCollection, ChillingCenter } from '@/types';
import { formatDate, formatQuantity } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NestleMilkHistory: React.FC = () => {
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [centers, setCenters] = useState<ChillingCenter[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterFarmer, setFilterFarmer] = useState('');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');

  useEffect(() => { 
    Promise.all([getCollections(), getChillingCenters()])
      .then(([cols, c]) => {
        setCollections(cols);
        setCenters(c);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching history data:', error);
        setLoading(false);
      });
  }, []);

  const filteredCollections = collections.filter(c => {
    const matchDate = filterDate ? c.date === filterDate : true;
    const matchFarmer = filterFarmer ? (c.farmerName?.toLowerCase() || '').includes(filterFarmer.toLowerCase()) : true;
    const matchCenter = selectedCenter === 'all' ? true : c.chillingCenterId.toString() === selectedCenter;
    return matchDate && matchFarmer && matchCenter;
  });

  const columns = [
    { key: 'chillingCenterName', header: 'Chilling Center', render: (r: MilkCollection) => r.chillingCenterName || 'Unknown Region' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'farmerName', header: 'Farmer Name' },
    { key: 'milkType', header: 'Milk Type', render: (r: MilkCollection) => r.milkType || 'Cow' },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'qualityResult', header: 'Quality', render: (r: MilkCollection) => r.qualityResult ? <StatusBadge status={r.qualityResult} /> : '—' },
    { key: 'dispatchStatus', header: 'Dispatch Status', render: (r: MilkCollection) => r.dispatchStatus ? <StatusBadge status={r.dispatchStatus} /> : <span className="text-muted-foreground">Pending</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Global Milk History</h2>
          <p className="text-sm text-muted-foreground">Monitor collections across all Chilling Centers</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2 border-b pb-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Filter Records</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">By Date</Label>
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">By Farmer Name</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search farmer..." value={filterFarmer} onChange={e => setFilterFarmer(e.target.value)} className="h-9 pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">By Chilling Center</Label>
            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
              <SelectTrigger className="h-9 bg-background/50 border-border/50">
                <SelectValue placeholder="All Centers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centers</SelectItem>
                {centers.map(center => (
                  <SelectItem key={center.id} value={center.id.toString()}>
                    {center.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      <DataTable columns={columns} data={filteredCollections} loading={loading} />
    </div>
  );
};

export default NestleMilkHistory;

