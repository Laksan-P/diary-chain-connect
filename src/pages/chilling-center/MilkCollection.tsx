import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Milk } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getFarmers, createCollection } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Farmer } from '@/types';
import { savePendingAction, isOnline, saveCache, getCache, getPendingActions } from '@/services/offlineSync';

const MilkCollectionPage: React.FC = () => {
  const { user } = useAuth();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Get local date in YYYY-MM-DD format
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    farmerId: '',
    date: getLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    temperature: '',
    quantity: '',
    milkType: 'Cow'
  });

  useEffect(() => {
    const loadFarmers = async () => {
      // 1. Always check cache first for instant loading
      const cached = getCache('farmers') || [];
      const pendingRegistrations = getPendingActions().filter(a => a.type === 'farmer_registration');
      const offlineFarmers = pendingRegistrations.map(a => ({
      id: a.data.tempId || a.data.farmerId || `OFF-${a.id}`,
      farmerId: a.data.farmerId || a.data.tempId || `OFF-${a.id}`,
      name: a.data.name,
      nic: a.data.nic,
      phone: a.data.phone,
      address: a.data.address || '',
      chillingCenterId: a.data.chillingCenterId,
      userId: 0,
      createdAt: new Date().toISOString(),
    } as Farmer));

      setFarmers([...cached, ...offlineFarmers]);

      // 2. If online, fetch fresh data and update cache
      if (isOnline()) {
        try {
          const serverData = user?.chillingCenterId
            ? await getFarmers(user.chillingCenterId)
            : await getFarmers();

          // Merge with any pending offline registrations to ensure they don't disappear
          const pendingRegistrations = getPendingActions().filter(a => a.type === 'farmer_registration');
          const offlineFarmers = pendingRegistrations.map(a => ({
          id: a.data.tempId || a.data.farmerId || `OFF-${a.id}`,
          farmerId: a.data.farmerId || a.data.tempId || `OFF-${a.id}`,
          name: a.data.name,
          nic: a.data.nic,
          phone: a.data.phone,
          address: a.data.address || '',
          chillingCenterId: a.data.chillingCenterId,
          userId: 0,
          createdAt: new Date().toISOString(),
        } as Farmer));

          const mergedFarmers = [...serverData, ...offlineFarmers];
          setFarmers(mergedFarmers);
          saveCache('farmers', mergedFarmers);
        } catch (err) {
          console.error("Failed to fetch fresh farmers:", err);
        }
      }
    };
    loadFarmers();

    const handleUpdate = () => loadFarmers();
    window.addEventListener('offline-action-saved', handleUpdate);
    window.addEventListener('offline-sync-complete', handleUpdate);
    window.addEventListener('online', handleUpdate);

    return () => {
      window.removeEventListener('offline-action-saved', handleUpdate);
      window.removeEventListener('offline-sync-complete', handleUpdate);
      window.removeEventListener('online', handleUpdate);
    };
  }, [user]);

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.chillingCenterId) {
      toast({ title: 'Error', description: 'No chilling center associated with your account', variant: 'destructive' });
      return;
    }

    const collectionData = {
      farmerId: (form.farmerId.toString().startsWith('OFF-')) ? (form.farmerId as any) : parseInt(form.farmerId),
      chillingCenterId: user.chillingCenterId,
      date: form.date,
      time: form.time,
      temperature: parseFloat(form.temperature),
      quantity: parseFloat(form.quantity),
      milkType: form.milkType as 'Buffalo' | 'Cow' | 'Goat',
      farmerName: farmers.find(f => String(f.id) === form.farmerId)?.name || 'Unknown Farmer',
    };

    if (!isOnline()) {
      savePendingAction('collection', collectionData);
      toast({
        title: 'Saved Offline',
        description: 'Connection is down. Record will sync once online.'
      });
      setForm({ farmerId: '', date: form.date, time: new Date().toTimeString().slice(0, 5), temperature: '', quantity: '', milkType: 'Cow' });
      return;
    }

    setLoading(true);
    try {
      await createCollection(collectionData);
      toast({ title: 'Collection Recorded', description: 'Milk collection saved successfully' });
      setForm({ farmerId: '', date: form.date, time: new Date().toTimeString().slice(0, 5), temperature: '', quantity: '', milkType: 'Cow' });
    } catch {
      // API failed — save offline as fallback
      savePendingAction('collection', collectionData);
      toast({
        title: 'Saved Offline',
        description: 'Network unavailable. Record saved locally and will sync when online.'
      });
      setForm({ farmerId: '', date: form.date, time: new Date().toTimeString().slice(0, 5), temperature: '', quantity: '', milkType: 'Cow' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Milk className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Record Milk Collection</h2>
          <p className="text-muted-foreground">Enter milk delivery details</p>
        </div>
      </div>

      {getPendingActions().length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700">Synchronization Pending</p>
            <p className="text-xs text-amber-600/80">{getPendingActions().length} actions will be synced when online</p>
          </div>
        </div>
      )}

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
