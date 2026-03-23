import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getDispatches, updateDispatchStatus } from '@/services/api';
import type { Dispatch } from '@/types';

const DispatchMonitoring: React.FC = () => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState('');
  const { toast } = useToast();

  useEffect(() => { getDispatches().then(d => { setDispatches(d); setLoading(false); }); }, []);

  const handleApprove = async (id: number) => {
    await updateDispatchStatus(id, 'Approved');
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'Approved' as const } : d));
    toast({ title: 'Dispatch Approved' });
  };

  const handleReject = async () => {
    if (!rejectDialog.id) return;
    await updateDispatchStatus(rejectDialog.id, 'Rejected', rejectReason);
    setDispatches(ds => ds.map(d => d.id === rejectDialog.id ? { ...d, status: 'Rejected' as const, rejectionReason: rejectReason } : d));
    toast({ title: 'Dispatch Rejected', variant: 'destructive' });
    setRejectDialog({ open: false, id: null });
    setRejectReason('');
  };

  const columns = [
    { key: 'id', header: 'ID', render: (r: Dispatch) => `#${r.id}` },
    { key: 'chillingCenterName', header: 'Center' },
    { key: 'transporterName', header: 'Transporter' },
    { key: 'vehicleNumber', header: 'Vehicle' },
    { key: 'dispatchDate', header: 'Date' },
    { key: 'totalQuantity', header: 'Qty (L)', render: (r: Dispatch) => `${r.totalQuantity} L` },
    { key: 'status', header: 'Status', render: (r: Dispatch) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: 'Actions', render: (r: Dispatch) => r.status === 'Dispatched' ? (
      <div className="flex gap-2">
        <Button size="sm" variant="default" className="btn-press text-xs" onClick={() => handleApprove(r.id)}>Approve</Button>
        <Button size="sm" variant="destructive" className="btn-press text-xs" onClick={() => setRejectDialog({ open: true, id: r.id })}>Reject</Button>
      </div>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Dispatch Monitoring</h2>
          <p className="text-sm text-muted-foreground">Approve or reject incoming dispatches</p>
        </div>
      </div>
      <DataTable columns={columns} data={dispatches} loading={loading} />

      <Dialog open={rejectDialog.open} onOpenChange={o => !o && setRejectDialog({ open: false, id: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Dispatch</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleReject} className="btn-press">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DispatchMonitoring;
