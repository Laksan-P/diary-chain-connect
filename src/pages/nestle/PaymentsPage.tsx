import React, { useEffect, useState } from 'react';
import { DollarSign, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getPayments, updatePaymentStatus, getCollections, generatePayment } from '@/services/api';
import type { Payment, MilkCollection } from '@/types';
import { formatCurrency, formatDate, formatQuantity, parseNumber } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidCollections, setUnpaidCollections] = useState<MilkCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [ps, cols] = await Promise.all([getPayments(), getCollections()]);
      setPayments(ps);
      
      // Filter collections that are 'Approved' but don't have a payment record yet
      const paidCollectionIds = new Set(ps.map(p => p.collectionId));
      setUnpaidCollections(cols.filter(c => c.dispatchStatus === 'Approved' && !paidCollectionIds.has(c.id)));
    } catch (error) {
      console.error(error);
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleMarkPaid = async (id: number) => {
    try {
      await updatePaymentStatus(id, 'Paid');
      setPayments(ps => ps.map(p => p.id === id ? { ...p, status: 'Paid' as const, paidAt: new Date().toISOString() } : p));
      toast({ title: 'Payment Marked as Paid' });
    } catch (error) {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const handleGeneratePayment = async (collectionId: number) => {
    setProcessing(collectionId);
    try {
      const newPayment = await generatePayment(collectionId);
      setPayments(prev => [newPayment, ...prev]);
      setUnpaidCollections(prev => prev.filter(c => c.id !== collectionId));
      toast({ title: 'Payment Generated', description: `Rs. ${newPayment.amount.toLocaleString()} for collection #${collectionId}` });
    } catch (error: any) {
      toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  // Farmer Summaries
  const farmerSummaries = payments.reduce((acc, p) => {
    const key = p.farmerId;
    if (!acc[key]) {
      acc[key] = { 
        farmerId: p.farmerId, 
        farmerName: p.farmerName, 
        farmerCode: p.farmerCode,
        totalQty: 0, 
        totalAmount: 0, 
        pendingAmount: 0,
        paidAmount: 0,
        pendingCount: 0 
      };
    }
    acc[key].totalAmount += parseNumber(p.amount);
    acc[key].totalQty += parseNumber(p.quantity || 0);
    if (p.status === 'Pending') {
      acc[key].pendingAmount += parseNumber(p.amount);
      acc[key].pendingCount++;
    } else {
      acc[key].paidAmount += parseNumber(p.amount);
    }
    return acc;
  }, {} as Record<number, any>);

  const summaryData = Object.values(farmerSummaries);

  const paymentColumns = [
    { key: 'id', header: 'ID', render: (r: Payment) => <span className="text-xs font-mono">#{r.id}</span> },
    { key: 'farmerName', header: 'Farmer' },
    { key: 'amount', header: 'Amount', render: (r: Payment) => <span className="font-semibold text-primary">{formatCurrency(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r: Payment) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Generated', render: (r: Payment) => formatDate(r.createdAt) },
    { key: 'actions', header: '', render: (r: Payment) => r.status === 'Pending' ? (
      <Button size="sm" variant="outline" className="h-8 text-xs font-medium hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" onClick={() => handleMarkPaid(r.id)}>Mark as Paid</Button>
    ) : <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {r.paidAt ? formatDate(r.paidAt) : 'Paid'}</span> },
  ];

  const collectionColumns = [
    { key: 'id', header: 'ID', render: (r: MilkCollection) => `#${r.id}` },
    { key: 'farmerName', header: 'Farmer' },
    { key: 'date', header: 'Date', render: (r: MilkCollection) => formatDate(r.date) },
    { key: 'quantity', header: 'Qty (L)', render: (r: MilkCollection) => formatQuantity(r.quantity) },
    { key: 'actions', header: '', render: (r: MilkCollection) => (
      <Button 
        size="sm" 
        disabled={processing === r.id}
        onClick={() => handleGeneratePayment(r.id)}
        className="h-8 text-xs bg-primary hover:bg-primary/90"
      >
        {processing === r.id ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
        Process Payment
      </Button>
    ) },
  ];

  const summaryColumns = [
    { key: 'farmerName', header: 'Farmer Name' },
    { key: 'totalQty', header: 'Total Qty', render: (r: any) => formatQuantity(r.totalQty) },
    { key: 'totalAmount', header: 'Total Value', render: (r: any) => formatCurrency(r.totalAmount) },
    { key: 'pendingAmount', header: 'Unpaid', render: (r: any) => (
      <span className={r.pendingAmount > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>
        {formatCurrency(r.pendingAmount)}
      </span>
    )},
    { key: 'status', header: 'Status', render: (r: any) => r.pendingCount > 0 ? <StatusBadge status="Pending" /> : <StatusBadge status="Paid" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Payment Management</h2>
            <p className="text-muted-foreground text-sm">Calculate earnings and manage payouts to farmers</p>
          </div>
        </div>
        <Button variant="outline" className="h-10 px-4" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="summaries" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="summaries" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Farmer Summary
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2 relative">
            <AlertCircle className="w-4 h-4" /> Pending Process
            {unpaidCollections.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold">
                {unpaidCollections.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" /> Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summaries" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 border-l-4 border-l-primary">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Payouts</p>
              <h4 className="text-2xl font-display font-bold text-foreground">
                {formatCurrency(Object.values(farmerSummaries).reduce((s, f) => s + f.totalAmount, 0))}
              </h4>
            </div>
            <div className="glass-card p-6 border-l-4 border-l-amber-500">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Outstanding</p>
              <h4 className="text-2xl font-display font-bold text-amber-600">
                {formatCurrency(Object.values(farmerSummaries).reduce((s, f) => s + f.pendingAmount, 0))}
              </h4>
            </div>
            <div className="glass-card p-6 border-l-4 border-l-emerald-500">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Successfully Paid</p>
              <h4 className="text-2xl font-display font-bold text-emerald-600">
                {formatCurrency(Object.values(farmerSummaries).reduce((s, f) => s + f.paidAmount, 0))}
              </h4>
            </div>
          </div>
          <DataTable columns={summaryColumns} data={summaryData} loading={loading} emptyMessage="No payment summaries available" />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-primary" />
            <p className="text-sm text-primary-foreground font-medium">
              You have {unpaidCollections.length} approved milk collections waiting to be processed for payment.
            </p>
          </div>
          <DataTable columns={collectionColumns} data={unpaidCollections} loading={loading} emptyMessage="No pending collections to process" />
        </TabsContent>

        <TabsContent value="history">
          <DataTable columns={paymentColumns} data={payments} loading={loading} emptyMessage="No transaction history found" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentsPage;

const History = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

