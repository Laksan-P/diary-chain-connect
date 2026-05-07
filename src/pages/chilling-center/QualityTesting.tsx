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
import { savePendingAction, isOnline, saveCache, getCache, getPendingByType } from '@/services/offlineSync';

const QualityTestingPage: React.FC = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QualityTest | null>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ collectionId: '', snf: '', fat: '', water: '' });

  useEffect(() => { 
    const loadCollections = async () => {
      if (user?.chillingCenterId) {
        // 1. Load from cache and offline actions immediately for instant UI
        const allPendingQuality = getPendingByType('quality');
        const alreadyTestedOnlineIds = allPendingQuality.map(q => String(q.data.collectionId));
        const alreadyTestedOfflineIds = allPendingQuality.map(q => q.data.offlineCollectionId).filter(Boolean);
        const cachedFarmers = getCache('farmers') || [];

        const getLocalCollections = (sCols: MilkCollection[]) => {
          const pendingQuality = sCols.filter(c => 
            !c.qualityResult && 
            !alreadyTestedOnlineIds.includes(String(c.id))
          );

          const offlinePending = getPendingByType('collection')
            .filter(a => {
              // Be lenient with chillingCenterId filter for offline records
              const centerMatch = !user.chillingCenterId || !a.data.chillingCenterId || String(a.data.chillingCenterId) === String(user.chillingCenterId);
              const alreadyTested = alreadyTestedOfflineIds.includes(a.id);
              return centerMatch && !alreadyTested;
            })
            .map(a => {
              const farmer = cachedFarmers.find((f: any) => String(f.id) === String(a.data.farmerId));
              const finalFarmerName = a.data.farmerName?.trim() || farmer?.name?.trim() || 'Offline Farmer';
              return {
                ...a.data,
                id: a.id,
                displayId: `OFF-${a.id.substring(0, 4).toUpperCase()}`,
                isOffline: true,
                farmerName: finalFarmerName,
                qualityResult: undefined,
              } as unknown as MilkCollection;
            });

          // De-duplicate: if a record is in both offlinePending and sCols (via cache), prefer offlinePending version
          const offlineIds = new Set<string | number>(offlinePending.map(o => o.id));
          const uniquePendingQuality = pendingQuality.filter(c => !offlineIds.has(c.id) && !offlineIds.has(String(c.id)));

          return [...offlinePending, ...uniquePendingQuality];
        };

    // Show cached version first
    const initialCols = getCache('pending_quality_collections') || [];
    setCollections(getLocalCollections(initialCols));

        // 2. Then try to fetch fresh data if online
        if (isOnline()) {
          try {
            const freshCols = await getCollections(user.chillingCenterId);
            saveCache('pending_quality_collections', freshCols);
            setCollections(getLocalCollections(freshCols));
          } catch (err) {
            console.error("Failed to fetch fresh collections:", err);
          }
        }
      }
    };
    loadCollections();

    const handleUpdate = () => loadCollections();
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
    
    // Check if it's an offline ID (UUID)
    const isOfflineId = isNaN(parseInt(form.collectionId)) || form.collectionId.includes('-');
    
    const testData = {
      collectionId: isOfflineId ? 0 : parseInt(form.collectionId),
      offlineCollectionId: isOfflineId ? form.collectionId : undefined,
      snf: parseFloat(form.snf),
      fat: parseFloat(form.fat),
      water: parseFloat(form.water),
    };

    if (!isOnline() || isOfflineId) {
      // Compute result locally — same logic as server
      const fat = parseFloat(form.fat);
      const snf = parseFloat(form.snf);
      const water = parseFloat(form.water);
      const reasons: string[] = [];
      if (fat < 3.5) reasons.push('Low FAT');
      if (snf < 8.5) reasons.push('Low SNF');
      if (water > 0.5) reasons.push('Excess Water');
      const localResult = reasons.length === 0 ? 'Pass' : 'Fail';
      const localReason = reasons.join(', ') || undefined;

      savePendingAction('quality', { ...testData, result: localResult, reason: localReason });
      
      // Show result on screen — same as online
      setResult({
        id: 0,
        collectionId: testData.collectionId,
        snf,
        fat,
        water,
        result: localResult as 'Pass' | 'Fail',
        reason: localReason,
        testedAt: new Date().toISOString(),
      });

      toast({ 
        title: `Quality: ${localResult}`, 
        description: localReason || 'All parameters within range',
      });
      setCollections(prev => prev.filter(c => String(c.id) !== String(form.collectionId)));
      setForm({ collectionId: '', snf: '', fat: '', water: '' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await submitQualityTest(testData);
      setResult(res);
      toast({ title: `Quality: ${res.result}`, description: res.reason || 'All parameters within range' });
      setCollections(prev => prev.filter(c => String(c.id) !== String(form.collectionId)));
      setForm({ collectionId: '', snf: '', fat: '', water: '' });
    } catch {
      // API failed — compute locally and save offline
      const fat = parseFloat(form.fat);
      const snf = parseFloat(form.snf);
      const water = parseFloat(form.water);
      const reasons: string[] = [];
      if (fat < 3.5) reasons.push('Low FAT');
      if (snf < 8.5) reasons.push('Low SNF');
      if (water > 0.5) reasons.push('Excess Water');
      const localResult = reasons.length === 0 ? 'Pass' : 'Fail';
      const localReason = reasons.join(', ') || undefined;

      savePendingAction('quality', { ...testData, result: localResult, reason: localReason });
      setResult({
        id: 0, collectionId: testData.collectionId,
        snf, fat, water,
        result: localResult as 'Pass' | 'Fail',
        reason: localReason,
        testedAt: new Date().toISOString(),
      });
      toast({ title: `Quality: ${localResult}`, description: localReason || 'All parameters within range' });
      setCollections(prev => prev.filter(c => String(c.id) !== String(form.collectionId)));
      setForm({ collectionId: '', snf: '', fat: '', water: '' });
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
                  #{c.displayId || c.id} — {c.farmerName} — {c.milkType || 'Cow'} — {c.quantity}L
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>SNF % (Solid-Not-Fat)</Label><Input type="number" step="0.01" min="0" max="100" placeholder="e.g. 8.5" value={form.snf} onChange={e => { if (e.target.value.length <= 5) update('snf', e.target.value) }} required /></div>
          <div className="space-y-2"><Label>FAT %</Label><Input type="number" step="0.01" min="0" max="100" placeholder="e.g. 3.5" value={form.fat} onChange={e => { if (e.target.value.length <= 5) update('fat', e.target.value) }} required /></div>
          <div className="space-y-2"><Label>Water %</Label><Input type="number" step="0.01" min="0" max="100" placeholder="e.g. 0.3" value={form.water} onChange={e => { if (e.target.value.length <= 5) update('water', e.target.value) }} required /></div>
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
