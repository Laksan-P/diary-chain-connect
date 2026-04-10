import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { getCollections, createDispatch, getDispatches } from '@/services/api';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection, Dispatch } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DispatchPage: React.FC = () => {
  const { user } = useAuth();
  const centerId = user?.chillingCenterId;
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingDispatch, setViewingDispatch] = useState<Dispatch | null>(null);
  const { toast } = useToast();
  const getLocalDateTime = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [form, setForm] = useState({ 
    transporterName: '', 
    vehicleNumber: '', 
    driverContact: '', 
    dispatchDate: getLocalDateTime(), 
    tankerCapacity: '' 
  });

  const selectedTotal = selected.reduce((sum, id) => {
    const col = collections.find(c => c.id === id);
    return sum + (col ? Number(col.quantity) : 0);
  }, 0);
  const capacityNum = Number(form.tankerCapacity) || 0;
  const isOverCapacity = capacityNum > 0 && selectedTotal > capacityNum;

  const loadData = async () => {
    if (!centerId) return;
    setIsRefreshing(true);
    try {
      const c = await getCollections(centerId);
      setCollections(c.filter(col => col.qualityResult === 'Pass' && col.dispatchStatus === 'Pending'));
      const d = await getDispatches(centerId);
      setDispatches(d);
      // Wait for at least 600ms to show the animation clearly
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (centerId) loadData();
  }, [centerId]);


  const toggleSelect = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) { toast({ title: 'Error', description: 'Select at least one collection', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await createDispatch({
        chillingCenterId: centerId,
        ...form,
        items: selected.map(id => ({ id: 0, dispatchId: 0, collectionId: id })),
      });
      toast({ title: 'Dispatch Created', description: `${selected.length} collections dispatched` });
      setSelected([]);
      setForm({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: form.dispatchDate, tankerCapacity: '' });
      loadData();
    } catch {
      toast({ title: 'Error', description: 'Database configuration missing for dispatches. Please run the SQL schema script.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const dispatchColumns = [
    { key: 'id', header: 'ID', render: (r: Dispatch) => `#${r.id}` },
    { key: 'transporterName', header: 'Transporter' },
    { key: 'vehicleNumber', header: 'Vehicle' },
    { key: 'dispatchDate', header: 'Date & Time', render: (r: Dispatch) => new Date(r.dispatchDate).toLocaleString() },
    { key: 'totalQuantity', header: 'Qty (L)', render: (r: Dispatch) => `${r.totalQuantity} L` },
    { key: 'status', header: 'Status', render: (r: Dispatch) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Milk Dispatch</h2>
          <p className="text-sm text-muted-foreground">Create and track dispatches</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="glass-card p-6 space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2"><Label>Transporter Name</Label><Input value={form.transporterName} maxLength={50} onChange={e => setForm(f => ({ ...f, transporterName: e.target.value }))} placeholder="e.g. Lanka Logistics" required /></div>
          <div className="space-y-2"><Label>Vehicle Number</Label><Input value={form.vehicleNumber} maxLength={15} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} placeholder="e.g. WP LV-1234" required /></div>
          <div className="space-y-2"><Label>Driver Contact</Label><Input value={form.driverContact} type="tel" maxLength={10} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setForm(f => ({ ...f, driverContact: val })); }} placeholder="e.g. 0771234567" required /></div>
          <div className="space-y-2"><Label>Date & Time</Label><Input type="datetime-local" value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))} required /></div>
          <div className="space-y-2"><Label>Tanker Capacity (L)</Label><Input type="number" min="0" value={form.tankerCapacity} onChange={e => setForm(f => ({ ...f, tankerCapacity: e.target.value }))} placeholder="e.g. 5000" required /></div>
        </div>

        {collections.length > 0 && (
          <div>
            <Label className="mb-2 block">Select Collections to Dispatch</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {collections.map(c => (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                  <span className="text-sm text-foreground">#{c.id} — {c.farmerName} — {c.quantity}L — {c.date}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {capacityNum > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className={`p-4 rounded-lg border ${isOverCapacity ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-300' : 'bg-primary/5 border-primary/20 text-foreground'}`}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-sm tracking-wide uppercase">Tanker Capacity Status</span>
              <span className="font-bold">{selectedTotal} L / {capacityNum} L</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${isOverCapacity ? 'bg-red-500' : 'bg-primary'} transition-all duration-300 ease-out`} 
                style={{ width: `${Math.min(100, (selectedTotal / capacityNum) * 100)}%` }} 
              />
            </div>
            {isOverCapacity && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs mt-3 font-semibold flex items-center gap-1">
                ⚠️ Tanker limit exceeded! Please deselect some collections.
              </motion.p>
            )}
          </motion.div>
        )}

        <Button type="submit" className="btn-press mt-2" disabled={loading || selected.length === 0 || isOverCapacity}>
          {loading ? 'Creating...' : `Dispatch ${selected.length} Collection(s)`}
        </Button>
      </motion.form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-display font-semibold text-foreground">Dispatch History</h3>
          <Button variant="ghost" size="sm" onClick={loadData} className="gap-2 text-primary hover:text-primary hover:bg-primary/5" disabled={isRefreshing}>
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <DataTable 
          columns={dispatchColumns} 
          data={dispatches.filter(d => d.chillingCenterId === centerId)} 
          onRowClick={(row) => setViewingDispatch(row)}
        />
      </div>

      <Dialog open={!!viewingDispatch} onOpenChange={() => setViewingDispatch(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispatch Details — #{viewingDispatch?.id}</DialogTitle>
          </DialogHeader>
          {viewingDispatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Transporter</p>
                  <p className="font-semibold">{viewingDispatch.transporterName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle Number</p>
                  <p className="font-semibold">{viewingDispatch.vehicleNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Driver Contact</p>
                  <p className="font-semibold">{viewingDispatch.driverContact}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dispatch Date</p>
                  <p className="font-semibold">{new Date(viewingDispatch.dispatchDate).toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Associated Collections</h4>
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-2 text-left">Coll ID</th>
                        <th className="px-4 py-2 text-left">Farmer</th>
                        <th className="px-4 py-2 text-right">Qty (L)</th>
                        <th className="px-4 py-2 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {viewingDispatch.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-muted-foreground">#{item.collectionId}</td>
                          <td className="px-4 py-2 font-medium">{item.farmerName}</td>
                          <td className="px-4 py-2 text-right">{item.quantity} L</td>
                          <td className="px-4 py-2 text-center">
                            <StatusBadge status={item.qualityResult || 'Pass'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-bold border-t">
                        <td colSpan={2} className="px-4 py-2 text-right">Total Quantity:</td>
                        <td className="px-4 py-2 text-right">{viewingDispatch.totalQuantity} L</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              {viewingDispatch.status === 'Rejected' && viewingDispatch.rejectionReason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  <p className="font-bold mb-1 uppercase tracking-tight text-[10px]">Rejection Reason</p>
                  <p>{viewingDispatch.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DispatchPage;
