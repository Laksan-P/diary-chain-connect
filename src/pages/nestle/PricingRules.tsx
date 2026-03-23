import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getPricingRules, createPricingRule } from '@/services/api';
import type { PricingRule } from '@/types';

const PricingRules: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ basePricePerLiter: '', fatBonus: '', snfBonus: '', effectiveFrom: '' });

  useEffect(() => { getPricingRules().then(r => { setRules(r); setLoading(false); }); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const rule = await createPricingRule({
        basePricePerLiter: parseFloat(form.basePricePerLiter),
        fatBonus: parseFloat(form.fatBonus),
        snfBonus: parseFloat(form.snfBonus),
        effectiveFrom: form.effectiveFrom,
      });
      setRules(r => [rule, ...r]);
      toast({ title: 'Pricing Rule Created' });
      setForm({ basePricePerLiter: '', fatBonus: '', snfBonus: '', effectiveFrom: '' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'basePricePerLiter', header: 'Base Price/L', render: (r: PricingRule) => `Rs. ${r.basePricePerLiter}` },
    { key: 'fatBonus', header: 'FAT Bonus', render: (r: PricingRule) => `Rs. ${r.fatBonus}` },
    { key: 'snfBonus', header: 'SNF Bonus', render: (r: PricingRule) => `Rs. ${r.snfBonus}` },
    { key: 'effectiveFrom', header: 'Effective From' },
    { key: 'isActive', header: 'Status', render: (r: PricingRule) => <StatusBadge status={r.isActive ? 'Pass' : 'Pending'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Settings className="w-5 h-5 text-primary" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Pricing Rules</h2>
          <p className="text-sm text-muted-foreground">Manage milk pricing parameters</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="glass-card p-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>Base Price/L (Rs.)</Label><Input type="number" step="0.01" value={form.basePricePerLiter} onChange={e => setForm(f => ({ ...f, basePricePerLiter: e.target.value }))} placeholder="e.g. 85.00" required /></div>
          <div className="space-y-2"><Label>FAT Bonus (Rs.)</Label><Input type="number" step="0.01" value={form.fatBonus} onChange={e => setForm(f => ({ ...f, fatBonus: e.target.value }))} placeholder="e.g. 2.50" required /></div>
          <div className="space-y-2"><Label>SNF Bonus (Rs.)</Label><Input type="number" step="0.01" value={form.snfBonus} onChange={e => setForm(f => ({ ...f, snfBonus: e.target.value }))} placeholder="e.g. 1.80" required /></div>
          <div className="space-y-2"><Label>Effective From</Label><Input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} required /></div>
        </div>
        <Button type="submit" className="mt-4 btn-press" disabled={saving}>{saving ? 'Saving...' : 'Create Rule'}</Button>
      </motion.form>

      <DataTable columns={columns} data={rules} loading={loading} />
    </div>
  );
};

export default PricingRules;
