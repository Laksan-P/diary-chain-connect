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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mt-4">
          <h3 className="font-display font-semibold text-foreground mb-3">Test Result</h3>
          <div className="flex items-center gap-3">
            <StatusBadge status={result.result} />
            {result.reason && <span className="text-sm text-muted-foreground">Reason: {result.reason}</span>}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div><span className="text-muted-foreground">SNF:</span> <span className="font-medium">{result.snf}%</span></div>
            <div><span className="text-muted-foreground">FAT:</span> <span className="font-medium">{result.fat}%</span></div>
            <div><span className="text-muted-foreground">Water:</span> <span className="font-medium">{result.water}%</span></div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default QualityTestingPage;
