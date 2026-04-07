import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getCenterPerformance, createChillingCenter, getChillingCenters } from '@/services/api';
import type { CenterPerformance, ChillingCenter } from '@/types';

const ChillingCentersView: React.FC = () => {
  const [centers, setCenters] = useState<(CenterPerformance & { location?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', contact: '' });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const perfs = await getCenterPerformance();
      const list = await getChillingCenters();
      
      const combined = perfs.map(p => {
        const matching = list.find(l => l.id === p.centerId);
        return { ...p, location: matching?.location || 'Unknown' };
      });
      setCenters(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createChillingCenter({ name: form.name, location: form.location });
      toast({ title: 'Success', description: 'Chilling Center added successfully.' });
      setForm({ name: '', location: '', contact: '' });
      setShowForm(false);
      loadData();
    } catch {
      toast({ title: 'Error', description: 'Failed to add chilling center.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'rank', header: 'Rank' },
    { key: 'centerName', header: 'Center Name' },
    { key: 'location', header: 'Location' },
    { key: 'collectionCount', header: 'Total Collections' },
    { key: 'totalQuantity', header: 'Total Milk (L)', render: (r: any) => `${r.totalQuantity.toLocaleString()} L` },
    { key: 'qualityRate', header: 'Pass Rate', render: (r: any) => `${r.qualityRate}%` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Chilling Centers</h2>
            <p className="text-sm text-muted-foreground">Manage and monitor chilling centers</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel Registration' : 'Register Center'}
        </Button>
      </div>

      {showForm && (
        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <h3 className="font-semibold border-b pb-2">Register New Chilling Center</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Center Name</Label>
              <Input value={form.name} maxLength={50} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Province Center" required />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} maxLength={50} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Jaffna" required />
            </div>
            <div className="space-y-2">
              <Label>Contact Details (Optional)</Label>
              <Input 
                value={form.contact} 
                maxLength={10} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, ''); // Numbers only
                  setForm(f => ({ ...f, contact: val })); 
                }} 
                placeholder="e.g. 0771234567" 
              />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>{submitting ? 'Registering...' : 'Complete Registration'}</Button>
        </motion.form>
      )}

      <DataTable columns={columns} data={centers} loading={loading} />
    </div>
  );
};

export default ChillingCentersView;
