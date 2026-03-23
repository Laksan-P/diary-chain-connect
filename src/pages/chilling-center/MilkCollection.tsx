import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Milk } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getFarmers, createCollection } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Farmer } from '@/types';

const MilkCollectionPage: React.FC = () => {
  const { user } = useAuth();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ farmerId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), temperature: '', quantity: '', milkType: 'Cow' });

  useEffect(() => { getFarmers().then(setFarmers); }, []);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.chillingCenterId) {
      toast({ title: 'Error', description: 'No chilling center associated with your account', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await createCollection({
        farmerId: parseInt(form.farmerId),
        chillingCenterId: user.chillingCenterId,
        date: form.date,
        time: form.time,
        temperature: parseFloat(form.temperature),
        quantity: parseFloat(form.quantity),
        milkType: form.milkType as 'Buffalo' | 'Cow' | 'Goat',
      });
      toast({ title: 'Collection Recorded', description: 'Milk collection saved successfully' });
      setForm({ farmerId: '', date: form.date, time: new Date().toTimeString().slice(0, 5), temperature: '', quantity: '', milkType: 'Cow' });
    } catch {
      toast({ title: 'Error', description: 'Failed to record collection', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Milk className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Record Milk Collection</h2>
          <p className="text-sm text-muted-foreground">Enter milk delivery details</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="glass-card p-6 space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Farmer</Label>
            <Select value={form.farmerId} onValueChange={v => update('farmerId', v)}>
              <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
              <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.farmerId} — {f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Milk Type</Label>
            <Select value={form.milkType} onValueChange={v => update('milkType', v)}>
              <SelectTrigger><SelectValue placeholder="Select milk type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cow">Cow Milk</SelectItem>
                <SelectItem value="Buffalo">Buffalo Milk</SelectItem>
                <SelectItem value="Goat">Goat Milk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} required /></div>
          <div className="space-y-2"><Label>Time</Label><Input type="time" value={form.time} onChange={e => update('time', e.target.value)} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Temperature (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={e => update('temperature', e.target.value)} placeholder="e.g. 4.0" required /></div>
          <div className="space-y-2"><Label>Quantity (Liters)</Label><Input type="number" step="0.1" value={form.quantity} onChange={e => update('quantity', e.target.value)} placeholder="e.g. 120.5" required /></div>
        </div>
        <Button type="submit" className="w-full btn-press" disabled={loading}>
          {loading ? 'Saving...' : 'Record Collection'}
        </Button>
      </motion.form>
    </div>
  );
};

export default MilkCollectionPage;
