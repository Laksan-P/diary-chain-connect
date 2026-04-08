import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, History, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getPricingRules, createPricingRule } from '@/services/api';
import type { PricingRule } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const PricingRules: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ 
    basePricePerLiter: '', 
    fatBonus: '0.00', 
    snfBonus: '0.00', 
    effectiveFrom: new Date().toISOString().split('T')[0] 
  });

  useEffect(() => { 
    getPricingRules().then(r => { 
      setRules(r); 
      setLoading(false); 
      if (r.length > 0) {
        const active = r[0]; // Assuming first is current
        setForm(f => ({
          ...f,
          basePricePerLiter: active.basePricePerLiter.toString(),
          fatBonus: active.fatBonus.toString(),
          snfBonus: active.snfBonus.toString(),
        }));
      }
    }); 
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const rule = await createPricingRule({
        basePricePerLiter: parseFloat(form.basePricePerLiter),
        fatBonus: parseFloat(form.fatBonus || '0'),
        snfBonus: parseFloat(form.snfBonus || '0'),
        effectiveFrom: form.effectiveFrom,
      });
      setRules(r => [rule, ...r]);
      toast({ title: 'New Pricing Rule Applied', description: `Base price set to Rs. ${form.basePricePerLiter}` });
    } catch {
      toast({ title: 'Error saving rule', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'basePricePerLiter', header: 'Unit Price (Rs)', render: (r: PricingRule) => <span className="font-bold text-foreground">Rs. {r.basePricePerLiter}</span> },
    { key: 'fatBonus', header: 'FAT Bonus', render: (r: PricingRule) => `Rs. ${r.fatBonus}` },
    { key: 'snfBonus', header: 'SNF Bonus', render: (r: PricingRule) => `Rs. ${r.snfBonus}` },
    { key: 'effectiveFrom', header: 'Effective Date', render: (r: PricingRule) => formatDate(r.effectiveFrom) },
    { key: 'isActive', header: 'Status', render: (r: PricingRule) => <StatusBadge status={r.isActive ? 'Pass' : 'Pending'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Pricing Strategy</h2>
          <p className="text-muted-foreground text-sm">Configure milk procurement rates and quality bonuses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <motion.form 
            onSubmit={handleSubmit} 
            className="glass-card p-6 space-y-5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Set Current Rates</h3>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Base Unit Price (Rs./L)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">Rs.</span>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.basePricePerLiter} 
                  onChange={e => setForm(f => ({ ...f, basePricePerLiter: e.target.value }))} 
                  className="pl-9 bg-muted/30 border-none font-bold text-lg h-12"
                  placeholder="0.00"
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Fat Content Bonus (Max)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={form.fatBonus} 
                onChange={e => setForm(f => ({ ...f, fatBonus: e.target.value }))} 
                className="bg-muted/30 border-none h-10"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">SNF Content Bonus (Max)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={form.snfBonus} 
                onChange={e => setForm(f => ({ ...f, snfBonus: e.target.value }))} 
                className="bg-muted/30 border-none h-10"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Effective Date</Label>
              <Input 
                type="date" 
                value={form.effectiveFrom} 
                onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} 
                className="bg-muted/30 border-none h-10"
                required 
              />
            </div>

            <Button type="submit" className="w-full h-12 btn-press bg-primary hover:bg-primary/90 text-white font-bold" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Updating...' : 'Apply New Pricing'}
            </Button>
            
            <p className="text-[10px] text-center text-muted-foreground">
              New pricing will apply to all payments generated after the effective date.
            </p>
          </motion.form>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-display font-bold">Pricing History</h3>
          </div>
          <DataTable columns={columns} data={rules} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default PricingRules;

