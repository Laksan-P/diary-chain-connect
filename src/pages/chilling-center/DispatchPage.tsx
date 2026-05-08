import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, RefreshCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { getCollections, createDispatch, getDispatches, deleteDispatch } from '@/services/api';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkCollection, Dispatch } from '@/types';
import { savePendingAction, isOnline, saveCache, getCache, getPendingByType, syncActions, removePendingAction } from '@/services/offlineSync';
import { formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DispatchPage: React.FC = () => {
  const { user } = useAuth();
  const centerId = user?.chillingCenterId;
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selected, setSelected] = useState<(number | string)[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingDispatch, setViewingDispatch] = useState<Dispatch | null>(null);
  const { toast } = useToast();
  const getLocalDateTime = () => {
    const now = new Date();
    // Offset in minutes, e.g. -330 for GMT+5:30
    const offset = now.getTimezoneOffset();
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const mins = absOffset % 60;
    const sign = offset <= 0 ? '+' : '-';

    // Naive local ISO: 2026-04-11T00:42
    const pad = (n: number) => String(n).padStart(2, '0');
    const localISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // We'll return just the local ISO digits for the datetime-local input
    return localISO;
  };

  // Helper to convert datetime-local string to full ISO with offset for DB
  const toISOWithOffset = (dt: string) => {
    if (!dt) return dt;
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const absOffset = Math.abs(offset);
    const sign = offset <= 0 ? '+' : '-';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt}:00${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
  };
  const [form, setForm] = useState({
    transporterName: '',
    vehicleNumber: '',
    driverContact: '',
    dispatchDate: getLocalDateTime(),
    tankerCapacity: ''
  });

  const selectedTotal = selected.reduce<number>((sum, id) => {
    const col = collections.find(c => String(c.id) === String(id));
    return sum + (col ? Number(col.quantity) : 0);
  }, 0);
  const capacityNum = Number(form.tankerCapacity) || 0;
  const isOverCapacity = capacityNum > 0 && selectedTotal > capacityNum;

  const loadData = async () => {
    if (!centerId) return;
    setIsRefreshing(true);

    // Trigger a sync attempt whenever we refresh
    if (navigator.onLine) {
      syncActions().catch(() => { });
    }

    try {
      // 1. Load from cache immediately for instant UI
      let c = getCache('dispatch_all_collections') || getCache('dispatch_pending_collections') || [];
      let d = getCache('dispatch_history') || [];

      // 2. Only attempt network fetch if online — parallel for speed
      if (navigator.onLine) {
        try {
          const [colsResult, dispResult] = await Promise.allSettled([
            getCollections(centerId),
            getDispatches(centerId)
          ]);
          if (colsResult.status === 'fulfilled') {
            c = colsResult.value;
            saveCache('dispatch_pending_collections', c.filter((col: any) => col.qualityResult === 'Pass' && col.dispatchStatus === 'Pending'));
            saveCache('dispatch_all_collections', c);
          }
          if (dispResult.status === 'fulfilled') {
            d = dispResult.value;
            saveCache('dispatch_history', d);
          }
        } catch (err) {
          console.error('Failed to fetch fresh data:', err);
        }
      }

      const allQuality = getPendingByType('quality');
      const allDispatches = getPendingByType('dispatch');

      // Update server collections with local quality/dispatch tests first
      // Update server collections with local quality/dispatch tests first
      const updatedC = c.map((col: any) => {
        if (!col) return null;
        const qualityTest = allQuality.find(q => q.data && String(q.data.collectionId) === String(col.id));
        
        // Safety check: is this collection in any pending dispatch OR any synced dispatch record?
        const dispatchedLocally = allDispatches.some(act => act.data?.items?.some((i: any) => String(i.collectionId) === String(col.id)));
        const dispatchedOnServer = d.some(disp => disp.items?.some((i: any) => String(i.collectionId) === String(col.id)));

        return {
          ...col,
          qualityResult: qualityTest ? qualityTest.data.result : col.qualityResult,
          dispatchStatus: (dispatchedLocally || dispatchedOnServer) ? 'Dispatched' : col.dispatchStatus
        };
      }).filter(Boolean) as MilkCollection[];

      const filteredCols = updatedC.filter(col => col.qualityResult === 'Pass' && col.dispatchStatus === 'Pending');

      const maxId = d.reduce((max: number, curr: any) => (typeof curr?.id === 'number' && curr.id > max ? curr.id : max), 0);

      const offlinePendingDispatches = allDispatches
        .map((a, index) => {
          if (!a.data) return null;
          
          // Check if this exact dispatch (same items) already exists in server history 'd'
          const itemIds = a.data.items?.map((i: any) => i.collectionId).filter(Boolean) || [];
          const isAlreadyOnServer = d.some(sd => {
          const serverItemIds = sd.items?.map(si => String(si.collectionId)) || [];
          const offlineItemIds = itemIds.map(id => String(id));

          const sameVehicle = sd.vehicleNumber === a.data.vehicleNumber;

          const sameItems =
            offlineItemIds.length > 0 &&
            offlineItemIds.every(id => serverItemIds.includes(id));

          return sameVehicle && sameItems;
        });
          
          if (isAlreadyOnServer) return null;

          return {
            ...a.data,
            id: maxId + index + 1,
            realOfflineId: a.id,
            status: 'Pending Sync',
            isOffline: true
          };
        }).filter(Boolean) as Dispatch[];
      const mergedDispatches = [...offlinePendingDispatches, ...d].sort((a, b) => {
        const dateA = new Date(a.dispatchDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.dispatchDate || b.createdAt || 0).getTime();
        return dateB - dateA; // Newest first
      });
      setDispatches(mergedDispatches);

      // Always merge offline collections that passed quality testing
      const cachedFarmers = getCache('farmers') || [];

      // IDs already dispatched offline
      const alreadyDispatchedIds = allDispatches
        .flatMap(d => d.data?.items?.map((i: any) => i.offlineCollectionId).filter(Boolean) || []);

      const offlineCollections = getPendingByType('collection')
        .filter(a => a && !alreadyDispatchedIds.includes(a.id)) // skip already dispatched
        .map(a => {
          if (!a.data) return null;
          const qualityTest = allQuality.find(q => q.data && String(q.data.offlineCollectionId) === String(a.id));
          if (!qualityTest || qualityTest.data.result !== 'Pass') return null; // Only passed
          const farmer = cachedFarmers.find((f: any) => f && String(f.id) === String(a.data.farmerId));
          const finalFarmerName = a.data.farmerName?.trim() || farmer?.name?.trim() || 'Offline Farmer';
          return {
            ...a.data,
            id: a.id,
            displayId: `OFF-${String(a.id).substring(0, 4).toUpperCase()}`,
            isOffline: true,
            farmerName: finalFarmerName,
            qualityResult: 'Pass',
            dispatchStatus: 'Pending'
          };
        })
        .filter(Boolean) as MilkCollection[];
      setCollections([...offlineCollections, ...filteredCols]);

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error('Critical load data error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (centerId) loadData();

    const handleUpdate = () => {
      // Small delay to ensure server processing is finished
      setTimeout(() => {
        if (centerId) loadData();
      }, 1000);
    };
    window.addEventListener('offline-action-saved', handleUpdate);
    window.addEventListener('offline-sync-complete', handleUpdate);
    window.addEventListener('online', handleUpdate);

    return () => {
      window.removeEventListener('offline-action-saved', handleUpdate);
      window.removeEventListener('offline-sync-complete', handleUpdate);
      window.removeEventListener('online', handleUpdate);
    };
  }, [centerId]);


  const toggleSelect = (id: number | string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) { toast({ title: 'Error', description: 'Select at least one collection', variant: 'destructive' }); return; }

    const dispatchData: any = {
      chillingCenterId: centerId,
      ...form,
      dispatchDate: toISOWithOffset(form.dispatchDate),
      totalQuantity: Number(selectedTotal),
      items: selected.map(id => {
      const isOfflineId = isNaN(Number(id)) || String(id).includes('-');

      const collection = collections.find(c => String(c.id) === String(id));

      return {
        id: 0,
        dispatchId: 0,
        collectionId: isOfflineId ? 0 : Number(id),
        offlineCollectionId: isOfflineId ? String(id) : undefined,

        // extra offline display data
        farmerName: collection?.farmerName || 'Offline Farmer',
        quantity: collection?.quantity || 0,
        qualityResult: collection?.qualityResult || 'Pass'
      };
    }),
    };

    if (!isOnline() || dispatchData.items.some(i => i.offlineCollectionId)) {
      savePendingAction('dispatch', dispatchData);
      toast({
        title: 'Saved Offline',
        description: 'Dispatch record saved locally. Will sync once online.'
      });
      setSelected([]);
      setForm({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: form.dispatchDate, tankerCapacity: '' });
      return;
    }

    setLoading(true);
    try {
      await createDispatch(dispatchData);
      toast({ title: 'Dispatch Created', description: `${selected.length} collections dispatched` });
      setSelected([]);
      setForm({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: form.dispatchDate, tankerCapacity: '' });
      loadData();
    } catch {
      // API failed — save offline as fallback
      savePendingAction('dispatch', dispatchData);
      toast({
        title: 'Saved Offline',
        description: 'Network unavailable. Dispatch saved locally and will sync when online.'
      });
      setSelected([]);
      setForm({ transporterName: '', vehicleNumber: '', driverContact: '', dispatchDate: form.dispatchDate, tankerCapacity: '' });
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dispatch: Dispatch) => {
    if (!confirm('Are you sure you want to delete this dispatch record?')) return;

    try {
      if (dispatch.isOffline && dispatch.realOfflineId) {
        removePendingAction(dispatch.realOfflineId);
        toast({ title: 'Removed', description: 'Pending dispatch removed locally' });
      } else {
        await deleteDispatch(Number(dispatch.id));
        toast({ title: 'Deleted', description: 'Dispatch record deleted successfully' });
      }
      loadData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete dispatch', variant: 'destructive' });
    }
  };

  const dispatchColumns = [
    { key: 'id', header: 'ID', render: (r: Dispatch) => `#${r.id}` },
    { key: 'transporterName', header: 'Transporter' },
    { key: 'vehicleNumber', header: 'Vehicle' },
    { key: 'dispatchDate', header: 'Date & Time', render: (r: Dispatch) => new Date(r.dispatchDate).toLocaleString() },
    { key: 'totalQuantity', header: 'Qty (L)', render: (r: Dispatch) => `${r.totalQuantity} L` },
    {
      key: 'status',
      header: 'Status',
      render: (r: any) => {
        if (r.isOffline) return <StatusBadge status="Pending Sync" />;
        const hasPass = r.items?.some((i: any) => i.qualityResult === 'Pass');
        const hasFail = r.items?.some((i: any) => i.qualityResult === 'Fail');
        const isManualReject = r.status === 'Rejected' &&
          r.rejectionReason &&
          !r.rejectionReason.startsWith('Quality Check Failed');
        return (
          <StatusBadge status={isManualReject ? 'Rejected' : (hasPass && hasFail ? 'Mixed' : r.status)} />
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: Dispatch) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(r)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  try {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Milk Dispatch</h2>
            <p className="text-sm text-muted-foreground">Create and track dispatches</p>
          </div>
        </div>

        <motion.form onSubmit={handleSubmit} className="glass-card p-6 space-y-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-2"><Label>Transporter Name</Label><Input value={form.transporterName} maxLength={50} onChange={e => setForm(f => ({ ...f, transporterName: e.target.value }))} placeholder="e.g. Lanka Logistics" required /></div>
            <div className="space-y-2"><Label>Vehicle Number</Label><Input value={form.vehicleNumber} maxLength={15} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} placeholder="e.g. WP LV-1234" required /></div>
            <div className="space-y-2"><Label>Driver Contact</Label><Input value={form.driverContact} type="tel" maxLength={10} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setForm(f => ({ ...f, driverContact: val })); }} placeholder="e.g. 0771234567" required /></div>
            <div className="space-y-2"><Label>Date & Time</Label><Input type="datetime-local" value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Tanker Capacity (L)</Label><Input type="number" min="0" value={form.tankerCapacity} onChange={e => setForm(f => ({ ...f, tankerCapacity: e.target.value }))} placeholder="e.g. 5000" required /></div>
          </div>

          {(collections || []).length > 0 && (
            <div>
              <Label className="mb-2 block">Select Collections to Dispatch</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {collections.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium">#{c.displayId || c.id}</span>
                      {c.isOffline && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">OFF</span>}
                      <span className="text-sm text-muted-foreground">— {c.farmerName} — {c.quantity}L — {formatDate(c.date)}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {capacityNum > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className={`p-4 rounded-lg border ${isOverCapacity ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-300' : 'bg-primary/5 border-primary/20 text-foreground'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-sm tracking-wide uppercase">Tanker Capacity Status</span>
                <span className="font-bold">{selectedTotal} L / {capacityNum} L</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${isOverCapacity ? 'bg-red-500' : 'bg-primary'} transition-all duration-300 ease-out`}
                  style={{ width: `${Math.min(100, (Number(selectedTotal) / capacityNum) * 100)}%` }}
                />
              </div>
              {isOverCapacity && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs mt-3 font-semibold flex items-center gap-1">
                  ⚠️ Tanker limit exceeded! Please deselect some collections.
                </motion.p>
              )}
            </motion.div>
          )}

          <Button type="submit" className="btn-press mt-2" disabled={loading || selected.length === 0 || isOverCapacity}>
            {loading ? 'Creating...' : `Dispatch ${selected.length} Collection(s)`}
          </Button>
        </motion.form>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-display font-semibold text-foreground">Dispatch History</h3>
            <Button variant="ghost" size="sm" onClick={loadData} className="gap-2 text-primary hover:text-primary hover:bg-primary/5" disabled={isRefreshing}>
              <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <DataTable
            columns={dispatchColumns}
            data={dispatches || []}
            onRowClick={(row) => setViewingDispatch(row)}
          />
        </div>

        <Dialog open={!!viewingDispatch} onOpenChange={() => setViewingDispatch(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Dispatch Details — #{viewingDispatch?.id}</DialogTitle>
            </DialogHeader>
            {viewingDispatch && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Transporter</p>
                    <p className="font-semibold">{viewingDispatch.transporterName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vehicle Number</p>
                    <p className="font-semibold">{viewingDispatch.vehicleNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Driver Contact</p>
                    <p className="font-semibold">{viewingDispatch.driverContact}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dispatch Date</p>
                    <p className="font-semibold">{viewingDispatch.dispatchDate ? new Date(viewingDispatch.dispatchDate).toLocaleString() : '—'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Associated Collections</h4>
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-4 py-2 text-left">Coll ID</th>
                          <th className="px-4 py-2 text-left">Farmer</th>
                          <th className="px-4 py-2 text-right">Qty (L)</th>
                          <th className="px-4 py-2 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {viewingDispatch.items?.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-muted-foreground">#{item.collectionId}</td>
                            <td className="px-4 py-2 font-medium">{item.farmerName}</td>
                            <td className="px-4 py-2 text-right">{item.quantity} L</td>
                            <td className="px-4 py-2 text-center">
                              <StatusBadge status={item.qualityResult || 'Pass'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30 font-bold border-t">
                          <td colSpan={2} className="px-4 py-2 text-right">Total Quantity:</td>
                          <td className="px-4 py-2 text-right">{viewingDispatch.totalQuantity} L</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {viewingDispatch.status === 'Rejected' && viewingDispatch.rejectionReason && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    <p className="font-bold mb-1 uppercase tracking-tight text-[10px]">Rejection Reason</p>
                    <p>{viewingDispatch.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    );
  } catch (renderError) {
    console.error('Render error in DispatchPage:', renderError);
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">The dispatch page encountered an error while rendering.</p>
        <Button onClick={() => window.location.reload()}>Reload Page</Button>
      </div>
    );
  }
};

export default DispatchPage;
