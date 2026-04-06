import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Beaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getCollections, submitQualityTest } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection, QualityTest } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

const QualityTestingPage: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QualityTest | null>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ collectionId: '', snf: '', fat: '', water: '' });

  useEffect(() => { 
    if (user?.chillingCenterId) {
      getCollections(user.chillingCenterId).then(cols => setCollections(cols.filter(c => !c.qualityResult))); 
    }
  }, [user]);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await submitQualityTest({
        collectionId: parseInt(form.collectionId),
        snf: parseFloat(form.snf),
        fat: parseFloat(form.fat),
        water: parseFloat(form.water),
      });
      setResult(res);
      toast({ title: `Quality: ${res.result}`, description: res.reason || 'All parameters within range' });
      setForm({ collectionId: '', snf: '', fat: '', water: '' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit test', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Beaker className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Quality Testing</h2>
          <p className="text-sm text-muted-foreground">Enter lab test values</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="glass-card p-6 space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="space-y-2">
          <Label>Milk Collection</Label>
          <Select value={form.collectionId} onValueChange={v => update('collectionId', v)}>
            <SelectTrigger><SelectValue placeholder="Select collection" /></SelectTrigger>
            <SelectContent>
              {collections.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  #{c.id} — {c.farmerName} — {c.milkType || 'Cow'} — {c.quantity}L
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>SNF % (Solid-Not-Fat)</Label><Input type="number" step="0.01" placeholder="e.g. 8.5" value={form.snf} onChange={e => update('snf', e.target.value)} required /></div>
          <div className="space-y-2"><Label>FAT %</Label><Input type="number" step="0.01" placeholder="e.g. 3.5" value={form.fat} onChange={e => update('fat', e.target.value)} required /></div>
          <div className="space-y-2"><Label>Water %</Label><Input type="number" step="0.01" placeholder="e.g. 0.3" value={form.water} onChange={e => update('water', e.target.value)} required /></div>
        </div>
        <Button type="submit" className="w-full btn-press" disabled={loading}>
          {loading ? 'Testing...' : 'Submit Quality Test'}
        </Button>
      </motion.form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mt-4 border-primary/20 bg-primary/5">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Last Test Result
          </h3>
          <div className="flex items-center gap-3">
            <StatusBadge status={result.result} />
            {result.reason && (
              <span className="text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md">
                Reason: {result.reason}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
              <span className="text-muted-foreground block mb-1">SNF:</span> 
              <span className="font-bold text-lg">{result.snf}%</span>
            </div>
            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
              <span className="text-muted-foreground block mb-1">FAT:</span> 
              <span className="font-bold text-lg">{result.fat}%</span>
            </div>
            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
              <span className="text-muted-foreground block mb-1">Water:</span> 
              <span className="font-bold text-lg">{result.water}%</span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="mt-12 space-y-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border/60"></div>
          </div>
          <div className="relative flex justify-start">
            <span className="pr-3 bg-background text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Quality Standards Reference
            </span>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card overflow-hidden border-border/40 shadow-xl shadow-foreground/5"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="px-6 py-4 font-bold text-foreground/80 uppercase tracking-tight text-xs">Parameter</th>
                  <th className="px-6 py-4 font-bold text-foreground/80 uppercase tracking-tight text-xs text-center border-x border-border/20">Normal Range</th>
                  <th className="px-6 py-4 font-bold text-foreground/80 uppercase tracking-tight text-xs text-center">Fail Condition</th>
                  <th className="px-6 py-4 font-bold text-rose-500/80 uppercase tracking-tight text-xs text-right">Reason for Rejection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                <tr className="group hover:bg-muted/20 transition-all duration-300">
                  <td className="px-6 py-5">
                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">FAT %</div>
                    <div className="text-[10px] text-muted-foreground font-medium">Milk Fat Percentage</div>
                  </td>
                  <td className="px-6 py-5 text-center border-x border-border/20">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Lower Bound</span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ≥ 3.5%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center bg-rose-500/5">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-rose-500/70 font-bold">Reject Below</span>
                      <span className="font-mono font-bold text-rose-500">&lt; 3.5%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-rose-600 dark:text-rose-400">
                    Low FAT
                  </td>
                </tr>
                <tr className="group hover:bg-muted/20 transition-all duration-300">
                  <td className="px-6 py-5">
                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">SNF %</div>
                    <div className="text-[10px] text-muted-foreground font-medium">Solid-Not-Fat Content</div>
                  </td>
                  <td className="px-6 py-5 text-center border-x border-border/20">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Lower Bound</span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ≥ 8.5%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center bg-rose-500/5">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-rose-500/70 font-bold">Reject Below</span>
                      <span className="font-mono font-bold text-rose-500">&lt; 8.5%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-rose-600 dark:text-rose-400">
                    Low SNF
                  </td>
                </tr>
                <tr className="group hover:bg-muted/20 transition-all duration-300">
                  <td className="px-6 py-5">
                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">Water %</div>
                    <div className="text-[10px] text-muted-foreground font-medium">Added Water Percentage</div>
                  </td>
                  <td className="px-6 py-5 text-center border-x border-border/20">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Upper Bound</span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ≤ 0.5%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center bg-rose-500/5">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase tracking-tighter text-rose-500/70 font-bold">Reject Above</span>
                      <span className="font-mono font-bold text-rose-500">&gt; 0.5%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-rose-600 dark:text-rose-400">
                    Excess Water
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
        
        <div className="flex items-start gap-2 px-1">
          <div className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5" />
          <p className="text-[10px] leading-relaxed text-muted-foreground/80 font-medium italic">
            Quality control measures are automatically enforced. Collections failing to meet these minimum standards will be rejected to maintain supply chain integrity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QualityTestingPage;
