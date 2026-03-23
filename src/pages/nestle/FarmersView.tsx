import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import DataTable from '@/components/DataTable';
import { getFarmers } from '@/services/api';
import type { Farmer } from '@/types';

const FarmersView: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getFarmers().then(f => { setFarmers(f); setLoading(false); }); }, []);

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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Farmer Information</h2>
          <p className="text-sm text-muted-foreground">Sorted by highest supplied quantity</p>
        </div>
      </div>
      <DataTable columns={columns} data={farmers} loading={loading} />
    </div>
  );
};

export default FarmersView;
