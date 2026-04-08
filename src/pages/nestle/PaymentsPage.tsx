import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  Calculator, ShieldCheck, CreditCard, ChevronRight, Search,
  ArrowRight, Landmark, Receipt, BellRing
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';

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

const getCycleSummary = async (skip = false) => {
  const res = await fetch(`/api/payments?action=cycle-summary${skip ? '&skipCycle=true' : ''}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to fetch summary');
  }
  return res.json();
};

const processBatchDetails = async (summaryItems: any[]) => {
  const res = await fetch('/api/payments?action=process-batch', {
    method: 'POST',
    body: JSON.stringify({ summaryItems }),
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Processing failed');
  return res.json();
};

const getPaymentHistory = async () => {
  const res = await fetch('/api/payments?action=list');
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

const PaymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cycleData, setCycleData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('cycle');

  const loadCycle = async (skip = false) => {
    setLoading(true);
    try {
      const data = await getCycleSummary(skip);
      setCycleData(data);
      if (data.cycleReached) {
        toast({ title: 'System: Step 5 Complete', description: 'Payment summary generated successfully.' });
        setActiveTab('review');
      }
    } catch (e: any) {
      toast({ title: 'Flow Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await getPaymentHistory();
      setHistory(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleProcessBatch = async () => {
    setLoading(true);
    try {
      // Step 8: Process Payment
      await processBatchDetails(cycleData.summary);
      
      // Step 9, 10, 11 happen on backend
      toast({ 
        title: 'Payments Processed (Steps 8-11)', 
        description: 'Collections marked Paid, transactions recorded, and farmers notified.' 
      });
      
      setCycleData(null);
      setActiveTab('history');
      loadHistory();
    } catch (e: any) {
      toast({ title: 'Critical Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const summaryColumns = [
    { key: 'farmerName', header: 'Farmer' },
    { key: 'farmerCode', header: 'Farmer ID' },
    { key: 'totalQty', header: 'Total Quantity', render: (v: any) => <span className="font-medium">{v.totalQty.toFixed(2)} L</span> },
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
              <RefreshCw className="w-3 h-3 text-primary animate-pulse" /> Activity Diagram Flow Sync
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-[10px] font-bold text-muted-foreground border uppercase tracking-wider">
             <Landmark className="w-3 h-3" /> Nestlé Corporate Bank API Linked
           </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/30 p-1.5 rounded-2xl border flex-shrink-0 h-auto gap-1">
            <TabsTrigger value="cycle" className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <Calculator className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-none text-[10px] font-bold uppercase opacity-50">Step 1-5</p>
                <p className="leading-tight font-bold">System Flow</p>
              </div>
            </TabsTrigger>
            <TabsTrigger value="review" disabled={!cycleData?.cycleReached} className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <ShieldCheck className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-none text-[10px] font-bold uppercase opacity-50">Step 6-7</p>
                <p className="leading-tight font-bold">Nestlé Review</p>
              </div>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-6 py-3 gap-3 text-sm rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all group">
              <CreditCard className="w-4 h-4 text-muted-foreground group-data-[state=active]:text-primary" /> 
              <div className="text-left">
                <p className="leading-none text-[10px] font-bold uppercase opacity-50">Step 8-11</p>
                <p className="leading-tight font-bold">Recorded Details</p>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* STEP 1-5: SYSTEM AUTOMATED PROCESS */}
        <TabsContent value="cycle" className="focus-visible:outline-none outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="lg:col-span-3 glass-card p-10 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden"
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

              <div className="space-y-2 relative">
                <h3 className="text-2xl font-display font-black">Bi-weekly Cycle Verification</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  The system is currently monitoring the calendar to trigger the next settlement phase as per the Activity Diagram.
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
                        <p className="font-black text-sm uppercase tracking-tighter">Bi-weekly Period Active</p>
                        <p className="text-xs opacity-80 mt-1 text-center">System is currently waiting until the next payment date (1st or 15th).</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <Button 
                        className="w-full h-14 btn-press text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20" 
                        onClick={() => loadCycle(true)}
                        disabled={loading}
                      >
                        {loading ? 'Processing Steps 1-5...' : 'Manual Skip: Start Payment Cycle'}
                      </Button>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">
                        Force System to identify collections and generate summary (Bypass Step 2)
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
                        <p className="font-black text-sm uppercase tracking-tighter">Payment Cycle Reached</p>
                        <p className="text-xs opacity-80 mt-1">Steps 1-5 Complete: Grouped & Summarized</p>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 btn-press bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-lg shadow-emerald-200" 
                      onClick={() => setActiveTab('review')}
                    >
                      Enter Nestlé Review (Step 6) <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-8 border-none bg-muted/20">
                <h4 className="font-black flex items-center gap-2 mb-6 text-xs uppercase tracking-widest text-muted-foreground border-b pb-4">
                  <Calculator className="w-4 h-4" /> Activity Diagram Flow Sync
                </h4>
                <div className="space-y-6 relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border -z-10" />
                  {[
                    { label: 'Identify Approved Collections', step: 'Step 1' },
                    { label: 'Check Bi-weekly Cycle', step: 'Step 2' },
                    { label: 'Calculate Payment for Each Farmer', step: 'Step 3' },
                    { label: 'Apply Pricing Rules', step: 'Step 4' },
                    { label: 'Generate Payment Summary', step: 'Step 5' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border-2 transition-colors ${cycleData?.cycleReached && i < 5 ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}>
                        {cycleData?.cycleReached && i < 5 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="pt-1">
                        <p className={`text-xs font-black uppercase tracking-tighter leading-none ${cycleData?.cycleReached && i < 5 ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>{s.step}</p>
                        <p className={`text-sm font-bold mt-1 ${cycleData?.cycleReached && i < 5 ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-6 border-none bg-primary/5 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-primary" />
                 </div>
                 <div>
                    <p className="text-xs font-black uppercase tracking-tighter text-primary">Bi-Weekly Rule</p>
                    <p className="text-sm font-medium leading-snug">Payments are calculated every 1st and 15th based on approved quality tests.</p>
                 </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* STEP 6-7: NESTLÉ OFFICER REVIEW & APPROVAL */}
        <TabsContent value="review" className="focus-visible:outline-none outline-none space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-6 rounded-3xl border border-border/50">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Step 6: Officer Action</p>
              <h3 className="text-xl font-display font-black">Review & Approve Payment Summaries</h3>
              <p className="text-muted-foreground text-sm">Please verify the calculated settlement amounts for all regrouped farmers.</p>
            </div>
            <div className="flex gap-2">
              <Button size="lg" variant="outline" className="h-14 font-bold rounded-2xl border-2" onClick={() => setCycleData(null)}>Reject & Recalculate</Button>
              <Button 
                size="lg" 
                className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 px-8 btn-press" 
                onClick={handleProcessBatch} 
                disabled={loading || !cycleData?.summary?.length}
              >
                {loading ? 'Step 8: Processing...' : 'Step 7: Approve & Process Batch'}
              </Button>
            </div>
          </motion.div>
          
          <DataTable columns={summaryColumns} data={cycleData?.summary || []} loading={loading} />
        </TabsContent>

        {/* STEP 8-11: HISTORY & RECORDED DETAILS */}
        <TabsContent value="history" className="focus-visible:outline-none outline-none space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="glass-card p-6 bg-emerald-50/50 border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-2 flex items-center gap-2"><Receipt className="w-3 h-3" /> Step 10: Recorded Trans</p>
                <p className="text-2xl font-display font-black">{history.length}</p>
             </div>
             <div className="glass-card p-6 bg-primary/5 border-primary/10">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 flex items-center gap-2"><BellRing className="w-3 h-3" /> Step 11: Notifications</p>
                <p className="text-2xl font-display font-black text-primary">SENT</p>
             </div>
          </div>
          <DataTable columns={historyColumns} data={history} loading={loading} />
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
