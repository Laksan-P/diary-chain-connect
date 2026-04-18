import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, History, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { getPricingRules, createPricingRule, updatePricingRule, deletePricingRule } from '@/services/api';
import type { PricingRule } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const AnimatedDeleteButton: React.FC<{ onDelete: () => Promise<void> }> = ({ onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = async () => {
    if (!confirm('Are you sure you want to delete this pricing strategy? This action cannot be undone.')) return;
    
    setIsDeleting(true);
    // Instant feel: 300ms
    await new Promise(resolve => setTimeout(resolve, 300));
    await onDelete();
    setIsDeleting(false);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative group p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-all ${isDeleting ? 'pointer-events-none' : ''}`}
      title="Delete Pricing Strategy"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Lid */}
        <motion.div
          animate={isDeleting ? { rotate: -45, x: -1, y: -2 } : { rotate: 0, x: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute top-0 w-4 h-0.5 bg-destructive rounded-full origin-left z-10"
          style={{ top: '3px' }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-destructive rounded-t-full" />
        </motion.div>

        {/* Bin body */}
        <div className="absolute bottom-0 w-3.5 h-3.5 border-[1.5px] border-destructive rounded-[2px] flex justify-around px-[2px] pt-[2px] bg-background">
           <div className="w-[1px] h-2 bg-destructive/50" />
           <div className="w-[1px] h-2 bg-destructive/50" />
        </div>
        
        {/* The "File" - More visible white paper style */}
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.2 }}
          animate={isDeleting ? { 
            opacity: [0, 1, 1, 0], 
            y: [-6, -2, 4, 6], 
            scale: [0.4, 0.7, 0.7, 0.4],
            rotate: [0, -10, 10, 0] 
          } : { opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="absolute w-2 h-2.5 bg-white border border-destructive/30 shadow-sm rounded-[1px] z-0"
          style={{ top: '2px' }}
        />
      </div>
    </button>
  );
};

const PricingRules: React.FC = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ 
    basePricePerLiter: '', 
    fatBonus: '0.00', 
    snfBonus: '0.00', 
    effectiveFrom: new Date().toLocaleDateString('en-CA') 
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
      toast({ title: 'New Pricing Rule Created (Pending)', description: `Base price set to Rs. ${form.basePricePerLiter}` });
    } catch {
      toast({ title: 'Error saving rule', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (id: number, currentStatus: boolean) => {
    try {
      await updatePricingRule(id, !currentStatus);
      const updated = await getPricingRules();
      setRules(updated);
      toast({ title: !currentStatus ? 'Pricing Rule Activated' : 'Pricing Rule Deactivated' });
    } catch {
      toast({ title: 'Operation failed', variant: 'destructive' });
    }
  };

  const executeDelete = async (id: number) => {
    try {
      await deletePricingRule(id);
      setRules(r => r.filter(rule => rule.id !== id));
      toast({ title: 'Pricing Strategy Deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'basePricePerLiter', header: 'Unit Price (Rs)', render: (r: PricingRule) => <span className="font-bold text-foreground">Rs. {r.basePricePerLiter}</span> },
    { key: 'fatBonus', header: 'FAT Bonus', render: (r: PricingRule) => `Rs. ${r.fatBonus}` },
    { key: 'snfBonus', header: 'SNF Bonus', render: (r: PricingRule) => `Rs. ${r.snfBonus}` },
    { key: 'effectiveFrom', header: 'Effective Date', render: (r: PricingRule) => formatDate(r.effectiveFrom) },
    { 
      key: 'isActive', 
      header: 'Status', 
      render: (r: PricingRule) => r.isActive ? (
        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max shadow-sm border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Current Active
        </span>
      ) : (
        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-wider w-max border">
          Pending / Offline
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Manage',
      render: (r: PricingRule) => (
        <div className="flex items-center justify-between w-full pr-2 gap-4">
          <Button 
            size="sm" 
            variant={r.isActive ? "ghost" : "default"}
            className={`h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${r.isActive ? 'text-amber-600 hover:bg-amber-100' : 'bg-primary hover:bg-primary/90 text-white shadow-md'}`}
            onClick={() => toggleRule(r.id, r.isActive)}
          >
            {r.isActive ? 'Pause Rule' : 'Activate Now'}
          </Button>
          <div className="flex-shrink-0">
            <AnimatedDeleteButton onDelete={() => executeDelete(r.id)} />
          </div>
        </div>
      )
    }
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

      {/* PRICING SIMULATOR / EXAMPLE TABLE */}
      {(rules.length > 0 || !loading) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">Live Pricing Simulator</h3>
                <p className="text-sm text-muted-foreground">Example earnings based on the **{rules.find(r => r.isActive)?.basePricePerLiter ? `Rs. ${rules.find(r => r.isActive)?.basePricePerLiter}` : 'Current'} Active** strategy</p>
              </div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-primary/5 border border-primary/20 text-[10px] font-black uppercase text-primary tracking-widest">
              Live Preview
            </div>
          </div>

          <div className="glass-card overflow-hidden border-primary/20">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary/5 border-b border-primary/10">
                <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Scenario / Milk Quality</th>
                  <th className="px-6 py-4 text-center">Fat %</th>
                  <th className="px-6 py-4 text-center">SNF %</th>
                  <th className="px-6 py-4 text-center">Base Rate</th>
                  <th className="px-6 py-4 text-center">Quality Bonus</th>
                  <th className="px-6 py-4 text-right">Final Rate / L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {[
                  { name: 'Premium (Buffalo)', fat: 7.0, snf: 9.5, labelColor: 'bg-indigo-500' },
                  { name: 'Choice (Cow)', fat: 4.5, snf: 8.8, labelColor: 'bg-emerald-500' },
                  { name: 'Standard (Cow)', fat: 3.5, snf: 8.5, labelColor: 'bg-amber-500' },
                  { name: 'Below Standard', fat: 3.0, snf: 8.0, labelColor: 'bg-rose-500' },
                ].map((scenario, idx) => {
                  const activeRule = rules.find(r => r.isActive) || rules[0] || { basePricePerLiter: 0, fatBonus: 0, snfBonus: 0 };
                  
                  // Logic: 
                  // bonus = (Actual - Minimum) * BonusRate
                  // Minimums: Fat 3.5, SNF 8.5
                  const fBonus = Math.max(0, (scenario.fat - 3.5) * activeRule.fatBonus);
                  const sBonus = Math.max(0, (scenario.snf - 8.5) * activeRule.snfBonus);
                  const totalBonus = fBonus + sBonus;
                  const finalRate = activeRule.basePricePerLiter + totalBonus;

                  return (
                    <tr key={idx} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full ${scenario.labelColor}`} />
                          <div>
                            <p className="font-bold text-foreground leading-none mb-1">{scenario.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Quality Tier {4-idx}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center font-mono font-medium">{scenario.fat.toFixed(1)}%</td>
                      <td className="px-6 py-5 text-center font-mono font-medium">{scenario.snf.toFixed(1)}%</td>
                      <td className="px-6 py-5 text-center text-muted-foreground font-medium">Rs. {activeRule.basePricePerLiter.toFixed(2)}</td>
                      <td className="px-6 py-5 text-center">
                        {totalBonus > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-100">
                            +Rs. {totalBonus.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-display font-black text-primary">Rs. {finalRate.toFixed(2)}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Est. Rs. {(finalRate * 100).toLocaleString()} for 100L</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground italic px-2">
            * Note: These are simulated examples. Actual payouts are calculated based on precise lab results and the active pricing strategy at the time of collection.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default PricingRules;

