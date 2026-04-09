import React, { useEffect, useState } from 'react';
import { Users, Filter } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { getFarmers, getChillingCenters } from '@/services/api';
import type { Farmer, ChillingCenter } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FarmersView: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [centers, setCenters] = useState<ChillingCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFarmers(), getChillingCenters()])
      .then(([f, c]) => {
        setFarmers(f);
        setCenters(c);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setLoading(false);
      });
  }, []);

  const filteredFarmers = selectedCenter === 'all'
    ? farmers
    : farmers.filter(f => f.chillingCenterId.toString() === selectedCenter);

  const columns = [
    { key: 'farmerId', header: 'Farmer ID' },
    { key: 'name', header: 'Name' },
    { key: 'chillingCenterName', header: 'Chilling Center' },
    { key: 'totalQuantity', header: 'Total Supply (L)', render: (r: Farmer) => `${(r.totalQuantity || 0).toLocaleString()} L` },
    { key: 'phone', header: 'Phone' },
    { key: 'createdAt', header: 'Registered' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Farmer Information</h2>
            <p className="text-sm text-muted-foreground">Sorted by highest supplied quantity</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filter by Center:</span>
          <Select value={selectedCenter} onValueChange={setSelectedCenter}>
            <SelectTrigger className="w-[200px] h-9 bg-background/50 border-border/50">
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

      <DataTable 
        columns={columns} 
        data={filteredFarmers} 
        loading={loading} 
        emptyMessage={selectedCenter === 'all' ? "No farmers found" : `No farmers found for this chilling center`}
      />
    </div>
  );
};

export default FarmersView;

