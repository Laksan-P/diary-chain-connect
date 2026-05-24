import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  Calculator, ShieldCheck, CreditCard, ChevronRight, Search,
  ArrowRight, Landmark, Receipt, BellRing, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';

/**
 * REQUIRED FLOW IMPLEMENTATION
 * 1. Identify Approved Collections
 * 2. Check Bi-weekly Cycle
 * 3. Calculate per Farmer (Grouped)
 * 4. Apply Pricing Rules
 * 5. Generate Summary
 * 6. Nestlé Review
 * 7. Nestlé Approve
 * 8. Process Payment
 * 9. Update Status (Paid)
 * 10. Record Transaction
 * 11. Notify Farmer
 */

import { 
  getPaymentCycleSummary, 
  processPaymentBatch, 
  getPayments 
} from '@/services/api';

const PaymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [disburseState, setDisburseState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [disburseSummary, setDisburseSummary] = useState<{ count: number; totalAmount: number } | null>(null);
  const disburseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cycleData, setCycleData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('cycle');

  const loadCycle = async (skip = false, options: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const data = await getPaymentCycleSummary(skip);
      const summary = Array.isArray(data.summary) ? data.summary : [];
      setCycleData({ ...data, summary, isForced: skip });

      if (!options.silent) {
        if (summary.length > 0) {
          toast({
            title: skip ? 'Summary Recalculated' : 'Payment Cycle Active',
            description: data.cycleReached || skip
              ? 'Collections identified and summary generated.'
              : `Pending summaries ready. Disbursement opens in ${data.daysUntilCycle ?? 0} day(s).`,
          });
          setActiveTab('review');
        } else if (skip) {
          toast({
            title: 'No Eligible Collections',
            description: data.message || 'No eligible approved collections found for settlement.',
          });
          setActiveTab('cycle');
        } else {
          toast({
            title: 'Schedule Checked',
            description:
              data.message ||
              (data.daysUntilCycle != null
                ? `Next payment scheduled in ${data.daysUntilCycle} days.`
                : 'Waiting for next formal payment date.'),
            variant: 'default',
          });
          setActiveTab('cycle');
        }
      } else if (summary.length > 0) {
        setActiveTab('review');
      } else {
        setCycleData({ ...data, summary: [], isForced: skip });
        setActiveTab('cycle');
      }
    } catch (e: any) {
      console.error('[PaymentsPage] cycle-summary failed:', e);
      toast({
        title: 'Flow Error',
        description: e?.message || 'Failed to generate summary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = () => {
    loadCycle(false, { silent: false });
  };

  const loadHistory = async () => {
    try {
      const data = await getPayments();
      setHistory(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    loadCycle(); // Auto-check on load
    loadHistory(); 
  }, []);

  useEffect(() => {
    return () => {
      if (disburseTimerRef.current) clearTimeout(disburseTimerRef.current);
    };
  }, []);

  const refreshAfterDisburse = useCallback(async () => {
    await loadHistory();

    const refreshed = await getPaymentCycleSummary(false);
    if (refreshed.summary?.length > 0) {
      setCycleData(refreshed);
      setActiveTab('review');
    } else {
      setCycleData(null);
      setActiveTab('history');
    }
  }, []);

  const closeDisburseSuccess = useCallback(async () => {
    if (disburseTimerRef.current) {
      clearTimeout(disburseTimerRef.current);
      disburseTimerRef.current = null;
    }
    setDisburseState('idle');
    setDisburseSummary(null);
    await refreshAfterDisburse();
  }, [refreshAfterDisburse]);

  const handleProcessBatch = async () => {
    if (!cycleData?.summary?.length || disburseState !== 'idle') return;

    setDisburseState('processing');
    try {
      const result = await processPaymentBatch(cycleData.summary);

      if (result.processedCount > 0) {
        const totalAmount = cycleData.summary.reduce(
          (sum: number, row: any) => sum + parseFloat(row.totalPayment || 0),
          0
        );
        setDisburseSummary({ count: result.processedCount, totalAmount });
        setDisburseState('success');
        disburseTimerRef.current = setTimeout(() => {
          closeDisburseSuccess();
        }, 2500);
      } else if (result.skippedCount > 0) {
        toast({
          title: 'Already Disbursed',
          description: result.message || 'These summaries were already paid.',
        });
        setDisburseState('idle');
        await refreshAfterDisburse();
      } else {
        setDisburseState('idle');
        await refreshAfterDisburse();
      }
    } catch (e: any) {
      toast({ title: 'Payment Failed', description: e.message, variant: 'destructive' });
      setDisburseState('idle');
    }
  };

  const isDisbursing = disburseState === 'processing' || disburseState === 'success';

  const summaryColumns = [
    { 
      key: 'farmerName', 
      header: 'Farmer',
      render: (v: any) => <span className="text-primary font-bold">{v.farmerName}</span>
    },
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'totalQty', header: 'Total Quantity', render: (v: any) => <span className="font-medium text-slate-700">{v.totalQty.toFixed(2)} L</span> },
    { key: 'unitPrice', header: 'Applied Rate', render: (v: any) => `Rs. ${v.unitPrice}/L` },
    { key: 'totalPayment', header: 'Settlement Amount', render: (v: any) => <span className="font-bold text-primary">Rs. {v.totalPayment}</span> },
    { key: 'status', header: 'Process Status', render: () => <StatusBadge status="Pending" /> },
  ];

  const historyColumns = [
    { key: 'farmerName', header: 'Farmer' },
    { key: 'quantity', header: 'Qty (L)', render: (v: any) => `${v.quantity} L` },
    { key: 'amount', header: 'Payout', render: (v: any) => <span className="font-bold text-emerald-600">Rs. {v.amount}</span> },
    { key: 'paidAt', header: 'Processed Date', render: (v: any) => formatDate(v.paidAt) },
    { key: 'id', header: 'Transaction Ref', render: (v: any) => <span className="text-[10px] font-mono text-muted-foreground uppercase">#{v.id}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/5">
            <DollarSign className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-display font-black text-foreground tracking-tight">Payment Settlement</h2>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 uppercase tracking-wide font-bold">
              <RefreshCw className="w-3 h-3 text-primary animate-pulse" /> Finalized Procurement Settlements
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/30 p-1.5 rounded-2xl border flex-shrink-0 h-auto gap-1">
            <TabsTrigger value="cycle" className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <Calculator className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-tight font-bold">Initiate Payment</p>
                <p className="leading-none text-[10px] font-medium opacity-50 uppercase">Cycle Verification</p>
              </div>
            </TabsTrigger>
            <TabsTrigger value="review" disabled={!cycleData?.summary || cycleData.summary.length === 0} className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <ShieldCheck className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-tight font-bold">Review & Approve</p>
                <p className="leading-none text-[10px] font-medium opacity-50 uppercase">Verify Summary</p>
              </div>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <CreditCard className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-tight font-bold">Payment History</p>
                <p className="leading-none text-[10px] font-medium opacity-50 uppercase">Recorded Payouts</p>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* STEP 1-5: SYSTEM AUTOMATED PROCESS */}
        <TabsContent value="cycle" className="focus-visible:outline-none outline-none">
          <div className="max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <Calculator className={`w-12 h-12 text-primary ${loading ? 'animate-bounce' : ''}`} />
                  {loading && (
                    <motion.div 
                      className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 relative">
                <h3 className="text-3xl font-display font-black">Bi-weekly Period Monitoring</h3>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  The system is currently checking the calendar to identify the next settlement period for approved collections.
                </p>
              </div>
              
              <AnimatePresence mode="wait">
                {!cycleData?.cycleReached ? (
                  <motion.div 
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pt-4 space-y-6 w-full max-w-sm relative"
                  >
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-sm flex flex-col items-center gap-3">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                      <div>
                        <p className="font-black text-sm uppercase tracking-tighter">Scheduled Period Active</p>
                        {cycleData?.daysUntilCycle !== undefined ? (
                          <div className="mt-2 py-1 px-3 bg-amber-100/50 rounded-full border border-amber-200 inline-block text-[10px] font-black uppercase text-amber-700">
                             Next Payment Cycle in: <span className="text-sm ml-1 text-primary">{cycleData.daysUntilCycle} Days</span>
                          </div>
                        ) : (
                          <p className="text-xs opacity-80 mt-1 text-center">Waiting for next formal payment date.</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="flex-1 h-14 border-2 border-primary/20 text-primary font-bold hover:bg-primary hover:text-white transition-all duration-300 shadow-sm" 
                          onClick={() => loadCycle()}
                          disabled={loading}
                        >
                          {loading ? 'Checking...' : 'Check Current Status'}
                        </Button>
                        <Button 
                          className="flex-1 h-14 btn-press font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20" 
                          onClick={() => loadCycle(true)}
                          disabled={loading}
                        >
                          {loading ? 'Working...' : 'Force Skip'}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">
                        Use "Check Status" for real schedule or "Force" for testing
                      </p>
                    </div>

                  </motion.div>
                ) : (
                  <motion.div 
                    key="ready"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="pt-4 w-full max-w-sm relative"
                  >
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900 shadow-sm flex flex-col items-center gap-3 mb-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <div>
                        <p className="font-black text-sm uppercase tracking-tighter">Collections identified</p>
                        <p className="text-xs opacity-80 mt-1">Payments are ready for review and processing.</p>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 btn-press bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-lg shadow-emerald-200" 
                      onClick={() => setActiveTab('review')}
                    >
                      Continue to Review <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </TabsContent>

        {/* STEP 6-7: NESTLÉ OFFICER REVIEW & APPROVAL */}
        <TabsContent value="review" className="focus-visible:outline-none outline-none space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-6 rounded-3xl border border-border/50">
            <div>
              <h3 className="text-xl font-display font-black">Review & Approve Payment Summaries</h3>
              <p className="text-muted-foreground text-sm">
                {cycleData?.summary?.length
                  ? `Active cycle: ${cycleData.cycleStart ? formatDate(cycleData.cycleStart) : '—'} to ${cycleData.cycleEnd ? formatDate(cycleData.cycleEnd) : '—'}`
                  : 'No pending payment summaries for this cycle.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="lg" variant="outline" className="h-14 font-bold rounded-2xl border-2" onClick={handleRecalculate}>Recalculate Summary</Button>
              <Button 
                size="lg" 
                className={`h-14 font-black rounded-2xl shadow-lg px-8 btn-press ${cycleData?.cycleReached || cycleData?.isForced ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' : 'bg-muted text-muted-foreground shadow-none pointer-events-none'}`}
                onClick={handleProcessBatch} 
                disabled={isDisbursing || loading || !cycleData?.summary?.length || (!cycleData?.cycleReached && !cycleData?.isForced)}
              >
                {disburseState === 'processing' ? 'Processing...' : (cycleData?.cycleReached || cycleData?.isForced ? 'Verify & Disburse Payments' : 'Period Not Reached')}
              </Button>
            </div>
          </motion.div>
          
          <DataTable 
            columns={summaryColumns} 
            data={cycleData?.summary || []} 
            loading={loading} 
            onRowClick={(row) => { setSelectedFarmer(row); setShowDetailDialog(true); }}
          />
        </TabsContent>

        {/* STEP 8-11: HISTORY & RECORDED DETAILS */}
        <TabsContent value="history" className="focus-visible:outline-none outline-none space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="glass-card p-6 bg-emerald-50/50 border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-2 flex items-center gap-2"><Receipt className="w-3 h-3" /> Recorded Payments</p>
                <p className="text-2xl font-display font-black">{history.length}</p>
             </div>
             <div className="glass-card p-6 bg-primary/5 border-primary/10">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 flex items-center gap-2"><BellRing className="w-3 h-3" /> Farmer Notifications</p>
                <p className="text-2xl font-display font-black text-primary">SENT</p>
             </div>
          </div>
          <DataTable columns={historyColumns} data={history} loading={loading} />
        </TabsContent>
      </Tabs>

      {/* Collection Details Drill-down Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black font-display tracking-tight leading-none">Settlement Breakdown</DialogTitle>
                  <DialogDescription className="text-white/70 font-medium text-sm mt-1 uppercase tracking-wider">
                    {selectedFarmer?.farmerCode} • {selectedFarmer?.farmerName}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-muted/30 rounded-2xl p-5 border grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Total Qty</p>
                <p className="text-lg font-display font-black text-foreground leading-tight">{selectedFarmer?.totalQty?.toFixed(2)} L</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Payout Date</p>
                <p className="text-lg font-display font-black text-emerald-600 leading-tight">{cycleData?.payoutDate ? formatDate(cycleData.payoutDate) : 'Pending'}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Settlement</p>
                <p className="text-lg font-display font-black text-primary leading-tight">Rs. {selectedFarmer?.totalPayment}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-black uppercase tracking-tight">Approved Collection Details</h4>
              </div>
              
              <div className="overflow-hidden border rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Col ID</th>
                      <th className="px-4 py-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Approved Date</th>
                      <th className="px-4 py-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground">Milk Type</th>
                      <th className="px-4 py-3 font-black text-[10px] uppercase tracking-wider text-muted-foreground text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedFarmer?.collections?.map((col: any) => (
                      <tr key={col.id} className="hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground font-bold">#{col.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(col.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            col.milkType === 'Buffalo' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {col.milkType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-primary">{col.quantity?.toFixed(2)} L</td>
                      </tr>
                    ))}
                    {(!selectedFarmer?.collections || selectedFarmer.collections.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No individual collection records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-muted/20 p-6 border-t">
            <Button 
              className="w-full h-12 font-bold rounded-xl btn-press bg-primary text-white"
              onClick={() => setShowDetailDialog(false)}
            >
              Close Breakdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement loading / success overlay */}
      <AnimatePresence>
        {disburseState !== 'idle' && (
          <motion.div
            key="disburse-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-border/50 p-10 max-w-md w-full text-center space-y-6"
            >
              {disburseState === 'processing' ? (
                <>
                  <div className="flex justify-center">
                    <Loader2 className="w-14 h-14 text-primary animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-black text-foreground">Processing Payments</h3>
                    <p className="text-muted-foreground text-sm">Processing payments...</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center"
                    >
                      <motion.div
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                      >
                        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                      </motion.div>
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-black text-foreground">Payment Disbursed Successfully</h3>
                    <p className="text-muted-foreground text-sm">
                      All selected farmer payments have been settled.
                    </p>
                    {disburseSummary && (
                      <p className="text-sm font-semibold text-emerald-700 pt-1">
                        {disburseSummary.count} farmer{disburseSummary.count !== 1 ? 's' : ''} · Rs. {disburseSummary.totalAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full h-12 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={closeDisburseSuccess}
                  >
                    Done
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
