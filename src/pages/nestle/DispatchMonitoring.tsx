import React, { useEffect, useState } from 'react';
import { Truck, ChevronDown, ChevronUp, Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getDispatches, updateDispatchStatus } from '@/services/api';
import type { Dispatch } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatQuantity, parseNumber } from '@/lib/utils';

const DispatchMonitoring: React.FC = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState('');
  const { toast } = useToast();

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

  useEffect(() => { fetchDispatches(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await updateDispatchStatus(id, 'Approved');
      setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Approved' as const } : d));
      toast({ title: 'Dispatch Approved', description: `Dispatch #${id} has been accepted.` });
    } catch (error) {
      toast({ title: 'Approval Failed', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.id) return;
    try {
      await updateDispatchStatus(rejectDialog.id, 'Rejected', rejectReason);
      setDispatches(ds => ds.map(d => d.id === rejectDialog.id ? { ...d, status: 'Rejected' as const, rejectionReason: rejectReason } : d));
      toast({ title: 'Dispatch Rejected', description: `Dispatch #${rejectDialog.id} has been rejected.`, variant: 'destructive' });
      setRejectDialog({ open: false, id: null });
      setRejectReason('');
    } catch (error) {
      toast({ title: 'Rejection Failed', variant: 'destructive' });
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
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No dispatch records found</td>
                </tr>
              ) : dispatches.map((dispatch) => (
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
                      <StatusBadge status={dispatch.status} />
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {dispatch.status === 'Dispatched' ? (
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="default" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
                            onClick={() => handleApprove(dispatch.id)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-8 px-3"
                            onClick={() => setRejectDialog({ open: true, id: dispatch.id })}
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
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
                                  <span className="text-muted-foreground">Driver Contact:</span>
                                  <span className="font-medium text-foreground">{dispatch.driverContact}</span>
                                  <span className="text-muted-foreground">Dispatch Time:</span>
                                  <span className="font-medium text-foreground">{new Date(dispatch.dispatchDate).toLocaleTimeString()}</span>
                                  {dispatch.rejectionReason && (
                                    <>
                                      <span className="text-destructive font-semibold">Rejection Reason:</span>
                                      <span className="text-destructive">{dispatch.rejectionReason}</span>
                                    </>
                                  )}
                                </div>
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
              Please provide a reason for rejecting this milk dispatch. This will notify the Chilling Center.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Input 
                id="reason" 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)} 
                placeholder="e.g., Temperature above limit, Quality concerns..." 
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
    </div>
  );
};

export default DispatchMonitoring;

