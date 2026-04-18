import React, { useEffect, useState } from 'react';
import { Truck, ChevronDown, ChevronUp, Check, X, Info, Filter, RefreshCcw, Beaker, ClipboardCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getDispatches, updateDispatchStatus, getChillingCenters, submitQualityTest } from '@/services/api';
import type { Dispatch, ChillingCenter } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatQuantity, parseNumber } from '@/lib/utils';

const DispatchMonitoring: React.FC = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [centers, setCenters] = useState<ChillingCenter[]>([]);
  const [filterCenterId, setFilterCenterId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState('');
  const { toast } = useToast();
  const [testDialog, setTestDialog] = useState<{ open: boolean; collectionId: number | null; dispatchId: number | null }>({ open: false, collectionId: null, dispatchId: null });
  const [testForm, setTestForm] = useState({ snf: '', fat: '', water: '' });
  const [testing, setTesting] = useState(false);

  const fetchDispatches = async () => {
    setLoading(true);
    try {
      const d = await getDispatches();
      setDispatches(d);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error fetching dispatches', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
    getChillingCenters().then(setCenters);
  }, []);

  const filteredDispatches = filterCenterId === 'all'
    ? dispatches
    : dispatches.filter(d => d.chillingCenterId === parseInt(filterCenterId));

  const handleApprove = async (id: number) => {
    // Optimistic Update
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Approved' as const } : d));

    try {
      await updateDispatchStatus(id, 'Approved');
      toast({ title: 'Dispatch Approved', description: `Dispatch #${id} has been accepted.` });
    } catch (error) {
      // Rollback on failure
      setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Dispatched' as const } : d));
      toast({ title: 'Approval Failed', variant: 'destructive', description: 'Could not update status. Please try again.' });
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.id) return;
    const id = rejectDialog.id;
    const reason = rejectReason;

    // Optimistic Update
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Rejected' as const, rejectionReason: reason } : d));
    setRejectDialog({ open: false, id: null });
    setRejectReason('');

    try {
      await updateDispatchStatus(id, 'Rejected', reason);
      toast({ title: 'Dispatch Rejected', description: `Dispatch #${id} has been rejected.`, variant: 'destructive' });
    } catch (error) {
      // Rollback on failure
      setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Dispatched' as const, rejectionReason: undefined } : d));
      toast({ title: 'Rejection Failed', variant: 'destructive', description: 'Could not update status. Please try again.' });
    }
  };

  const handleQualityTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDialog.collectionId || !testDialog.dispatchId) return;
    setTesting(true);
    try {
      const res = await submitQualityTest({
        collectionId: testDialog.collectionId,
        snf: parseFloat(testForm.snf),
        fat: parseFloat(testForm.fat),
        water: parseFloat(testForm.water),
      });

      if (res.result === 'Pass') {
        toast({ title: 'Quality Check Passed', description: 'Collection has been automatically approved.' });
        await fetchDispatches();
        setTestDialog({ open: false, collectionId: null, dispatchId: null });
        setTestForm({ snf: '', fat: '', water: '' });
      } else {
        // Find the farmer info for the failing collection
        const dispatch = dispatches.find(d => d.id === testDialog.dispatchId);
        const item = dispatch?.items.find(i => i.collectionId === testDialog.collectionId);
        const farmerInfo = item ? ` (ID: ${item.collectionId} - ${item.farmerName})` : '';

        // Immediately fetch to show the "Fail" state in the background
        await fetchDispatches();

        // Automatically route to rejection flow with pre-filled reason
        setTestDialog({ open: false, collectionId: null, dispatchId: null });
        setRejectDialog({ open: true, id: testDialog.dispatchId });
        setRejectReason(`Quality Check Failed: ${res.reason}${farmerInfo}`);
        toast({ title: 'Quality Check Failed', description: `Routing to rejection for: ${res.reason}${farmerInfo}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'System Error', description: 'Failed to submit quality test.', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Transport Management</h2>
            <p className="text-muted-foreground text-sm">Monitor and verify milk dispatches from chilling centers</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDispatches}
            className="h-8 w-8 p-0 hover:bg-primary/10 text-primary"
            disabled={loading}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Filter className="w-4 h-4 text-muted-foreground ml-2" />
          <Select value={filterCenterId} onValueChange={setFilterCenterId}>
            <SelectTrigger className="w-[200px] border-none bg-transparent focus:ring-0">
              <SelectValue placeholder="All Centers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chilling Centers</SelectItem>
              {centers.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">ID / Date</th>
                <th className="px-6 py-4">Chilling Center</th>
                <th className="px-6 py-4">Transporter & Vehicle</th>
                <th className="px-6 py-4 text-right">Total Qty</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <span className="text-muted-foreground">Loading dispatches...</span>
                  </td>
                </tr>
              ) : filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No dispatch records found</td>
                </tr>
              ) : filteredDispatches.map((dispatch) => (
                <React.Fragment key={dispatch.id}>

                  <tr
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${expandedRow === dispatch.id ? 'bg-muted/20' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === dispatch.id ? null : dispatch.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">#{dispatch.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(dispatch.dispatchDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{dispatch.chillingCenterName}</div>
                      <div className="text-xs text-muted-foreground">ID: {dispatch.chillingCenterId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{dispatch.transporterName}</div>
                      <div className="text-xs text-muted-foreground">{dispatch.vehicleNumber}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                      {formatQuantity(dispatch.totalQuantity || 0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge
                        status={
                          dispatch.status === 'Rejected' && dispatch.items.some(i => i.qualityResult === 'Pass')
                            ? 'Mixed'
                            : dispatch.status
                        }
                      />
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {dispatch.status === 'Dispatched' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary border-primary/20 hover:bg-primary/5 h-8 px-3"
                            onClick={() => setExpandedRow(expandedRow === dispatch.id ? null : dispatch.id)}
                          >
                            <Beaker className="w-3.5 h-3.5 mr-1" /> Inspect Quality
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-3 group"
                            onClick={() => setRejectDialog({ open: true, id: dispatch.id })}
                          >
                            <X className="w-3.5 h-3.5 mr-1 group-hover:rotate-90 transition-transform" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground"
                          onClick={() => setExpandedRow(expandedRow === dispatch.id ? null : dispatch.id)}
                        >
                          {expandedRow === dispatch.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedRow === dispatch.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-0 bg-muted/10">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden py-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                  <Info className="w-3 h-3" /> Transport Details
                                </h4>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                  <span className="text-muted-foreground">Transporter:</span>
                                  <span className="font-medium text-foreground">{dispatch.transporterName}</span>
                                  <span className="text-muted-foreground">Driver Contact:</span>
                                  <span className="font-medium text-foreground">{dispatch.driverContact}</span>
                                  <span className="text-muted-foreground">Dispatch Time:</span>
                                  <span className="font-medium text-foreground">
                                    {(() => {
                                      const d = dispatch.dispatchDate;
                                      // If it's just a date string (length 10 like '2026-04-11'), time is missing in DB
                                      if (d && d.length === 10) return 'Pending Sync (Run Fix)';
                                      // Otherwise show local time
                                      return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                                    })()}
                                  </span>
                                </div>
                                {dispatch.rejectionReason && (
                                  <>
                                    <span className="text-destructive font-semibold">Rejection Reason:</span>
                                    <span className="text-destructive">{dispatch.rejectionReason}</span>
                                  </>
                                )}
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Milk Collection Records</h4>
                                <div className="rounded-lg border bg-card overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Farmer</th>
                                        <th className="px-3 py-2 text-right">Quantity</th>
                                        <th className="px-3 py-2 text-center">Quality</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {dispatch.items.map((item) => (
                                        <tr key={item.id}>
                                          <td className="px-3 py-2 font-medium">{item.farmerName}</td>
                                          <td className="px-3 py-2 text-right">{formatQuantity(item.quantity || 0)}</td>
                                          <td className="px-3 py-2 text-center">
                                            <StatusBadge status={item.qualityResult || 'N/A'} />
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {item.dispatchStatus === 'Approved' ? (
                                              <StatusBadge status="Verified" />
                                            ) : item.dispatchStatus === 'Rejected' ? (
                                              <div className="flex flex-col items-end">
                                                <StatusBadge status="Rejected" />
                                                <div className="flex flex-col items-end gap-0.5 mt-1 border-r-2 border-destructive/20 pr-1.5 grayscale-[0.5]">
                                                  <span className="text-[9px] text-destructive font-extrabold uppercase tracking-tighter whitespace-nowrap">
                                                    {item.failureReason || 'Quality Fail'}
                                                  </span>
                                                  <span className="text-[8px] text-muted-foreground font-medium flex items-center gap-1 opacity-70">
                                                    ID: {item.collectionId} • {item.farmerName}
                                                  </span>
                                                </div>
                                              </div>
                                            ) : (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] font-bold uppercase tracking-tight"
                                                onClick={() => setTestDialog({ open: true, collectionId: item.collectionId, dispatchId: dispatch.id })}
                                              >
                                                Verify Quality
                                              </Button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={rejectDialog.open} onOpenChange={o => !o && setRejectDialog({ open: false, id: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Dispatch #{rejectDialog.id}</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection (e.g. Physical Damage, Spoiled, Leakage).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Input
                id="reason"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g., Physical damage, Temp too high..."
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testDialog.open} onOpenChange={o => !o && setTestDialog({ open: false, collectionId: null, dispatchId: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="w-5 h-5 text-primary" />
              Verify Quality — Collection #{testDialog.collectionId}
            </DialogTitle>
            <DialogDescription>
              Enter Nestlé lab test parameters for this collection.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQualityTest}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">FAT %</Label>
                  <Input
                    type="number" step="0.01" value={testForm.fat}
                    onChange={e => setTestForm({ ...testForm, fat: e.target.value })}
                    placeholder="3.5" required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">SNF %</Label>
                  <Input
                    type="number" step="0.01" value={testForm.snf}
                    onChange={e => setTestForm({ ...testForm, snf: e.target.value })}
                    placeholder="8.5" required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Water %</Label>
                  <Input
                    type="number" step="0.01" value={testForm.water}
                    onChange={e => setTestForm({ ...testForm, water: e.target.value })}
                    placeholder="0.3" required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setTestDialog({ open: false, collectionId: null, dispatchId: null })}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={testing}>
                {testing ? 'Verifying...' : 'Submit & Approve'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DispatchMonitoring;

