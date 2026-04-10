import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getCenterPerformance, registerChillingCenterByAdmin, getChillingCenters } from '@/services/api';
import type { CenterPerformance, ChillingCenter } from '@/types';

const ChillingCentersView: React.FC = () => {
  const [centers, setCenters] = useState<(CenterPerformance & { location?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', contact: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      await registerChillingCenterByAdmin({ 
        name: form.name, 
        location: form.location,
        email: form.email,
        password: form.password
      });
      toast({ title: 'Success', description: 'Chilling Center registered with credentials.' });
      setForm({ name: '', location: '', contact: '', email: '', password: '' });
      setShowForm(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add chilling center.', variant: 'destructive' });
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Center Name</Label>
              <Input value={form.name} maxLength={50} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Province Center" required />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} maxLength={50} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Jaffna" required />
            </div>
            <div className="space-y-2">
              <Label>Login Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. center@nestle.com" required />
            </div>
            <div className="space-y-2">
              <Label>Login Password</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  value={form.password} 
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                  required 
                  className="pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
