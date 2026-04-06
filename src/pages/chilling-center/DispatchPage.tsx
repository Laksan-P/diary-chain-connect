import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
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

const DispatchPage: React.FC = () => {
  const { user } = useAuth();
  const centerId = user?.chillingCenterId || 1;
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: new Date().toISOString().split('T')[0] });

  const loadData = () => {
    getCollections(centerId).then(c => setCollections(c.filter(col => col.qualityResult === 'Pass' && col.dispatchStatus === 'Pending')));
    getDispatches(centerId).then(setDispatches);
  };

  useEffect(() => {
    loadData();
  }, [user]);

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
      setForm({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: form.dispatchDate });
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
    { key: 'dispatchDate', header: 'Date' },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>Transporter Name</Label><Input value={form.transporterName} maxLength={50} onChange={e => setForm(f => ({ ...f, transporterName: e.target.value }))} placeholder="e.g. Lanka Logistics" required /></div>
          <div className="space-y-2"><Label>Vehicle Number</Label><Input value={form.vehicleNumber} maxLength={15} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} placeholder="e.g. WP LV-1234" required /></div>
          <div className="space-y-2"><Label>Driver Contact</Label><Input value={form.driverContact} type="tel" maxLength={10} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setForm(f => ({ ...f, driverContact: val })); }} placeholder="e.g. 0771234567" required /></div>
          <div className="space-y-2"><Label>Dispatch Date</Label><Input type="date" value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))} required /></div>
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

        <Button type="submit" className="btn-press" disabled={loading || selected.length === 0}>
          {loading ? 'Creating...' : `Dispatch ${selected.length} Collection(s)`}
        </Button>
      </motion.form>

      <div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-3">Dispatch History</h3>
        <DataTable columns={dispatchColumns} data={dispatches.filter(d => d.chillingCenterId === 1)} />
      </div>
    </div>
  );
};

export default DispatchPage;
