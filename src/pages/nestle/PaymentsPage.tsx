import React, { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getPayments, updatePaymentStatus } from '@/services/api';
import type { Payment } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { getPayments().then(p => { setPayments(p); setLoading(false); }); }, []);

  const handleMarkPaid = async (id: number) => {
    await updatePaymentStatus(id, 'Paid');
    setPayments(ps => ps.map(p => p.id === id ? { ...p, status: 'Paid' as const, paidAt: new Date().toISOString() } : p));
    toast({ title: 'Payment marked as Paid' });
  };

  const columns = [
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'farmerName', header: 'Name' },
    { key: 'basePay', header: 'Base', render: (r: Payment) => formatCurrency(r.basePay) },
    { key: 'fatBonus', header: 'FAT Bonus', render: (r: Payment) => formatCurrency(r.fatBonus) },
    { key: 'snfBonus', header: 'SNF Bonus', render: (r: Payment) => formatCurrency(r.snfBonus) },
    { key: 'amount', header: 'Total', render: (r: Payment) => <span className="font-semibold text-primary">{formatCurrency(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r: Payment) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r: Payment) => r.status === 'Pending' ? (
      <Button size="sm" className="btn-press text-xs" onClick={() => handleMarkPaid(r.id)}>Mark Paid</Button>
    ) : <span className="text-xs text-muted-foreground">{r.paidAt ? formatDate(r.paidAt) : '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-accent" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Payments</h2>
          <p className="text-sm text-muted-foreground">Generate and manage farmer payments</p>
        </div>
      </div>
      <DataTable columns={columns} data={payments} loading={loading} />
    </div>
  );
};

export default PaymentsPage;
