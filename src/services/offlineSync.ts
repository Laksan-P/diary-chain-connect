import { createCollection, submitQualityTest, createDispatch } from './api';
import { v4 as uuidv4 } from 'uuid';

export interface PendingAction {
  id: string;
  type: 'collection' | 'quality' | 'dispatch' | 'farmer_registration';
  data: any;
  timestamp: number;
  syncedServerId?: number | string; // Set after successful sync
}

const STORAGE_KEY = 'pending_actions';

export const getPendingActions = (): PendingAction[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const savePendingAction = (type: PendingAction['type'], data: any) => {
  const actions = getPendingActions();
  const newAction: PendingAction = {
    id: uuidv4(),
    type,
    data,
    timestamp: Date.now(),
  };
  actions.push(newAction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  window.dispatchEvent(new CustomEvent('offline-action-saved', { detail: newAction }));
  return newAction.id;
};

export const removePendingAction = (id: string) => {
  const actions = getPendingActions();
  const filtered = actions.filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('offline-action-saved'));
};

// Trigger sync whenever something is saved and we are online
window.addEventListener('offline-action-saved', () => {
  if (navigator.onLine && !isSyncing) {
    console.log('[OfflineSync] Action saved. Triggering auto-sync...');
    syncActions().catch(err => console.error('[OfflineSync] Auto-sync failed:', err));
  }
});

let isSyncing = false;

export const syncActions = async () => {
  if (isSyncing) return;
  const actions = getPendingActions();
  if (actions.length === 0) return;

  console.log(`[OfflineSync] Starting sync for ${actions.length} actions...`);
  isSyncing = true;

  const remainingActions: PendingAction[] = [];

  // Sync in order: farmer_registration → collection → quality → dispatch
  const farmers = actions.filter(a => a.type === 'farmer_registration');
  const collections = actions.filter(a => a.type === 'collection');
  const qualities = actions.filter(a => a.type === 'quality');
  const dispatches = actions.filter(a => a.type === 'dispatch');

  // Load persistent mappings (offlineId -> serverId)
  const idMappings = getCache('sync_id_mappings') || { collections: {}, farmers: {} };

  const { registerFarmerByCenter } = await import('@/services/api');

  // Helper to update all pending actions when an ID is resolved
  const updatePendingIdReferences = (offlineId: string, serverId: number | string, type: 'collection' | 'farmer') => {
    const allActions = getPendingActions();
    let changed = false;

    const updatedActions = allActions.map(action => {
      if (type === 'collection') {
        if (action.type === 'dispatch' && action.data.items) {
          action.data.items = action.data.items.map((item: any) => {
            if (item.offlineCollectionId === offlineId) {
              changed = true;
              return { ...item, collectionId: serverId };
            }
            return item;
          });
        }
        if (action.type === 'quality' && action.data.offlineCollectionId === offlineId) {
          action.data.collectionId = serverId;
          changed = true;
        }
      } else if (type === 'farmer') {
        if (action.type === 'collection' && action.data.farmerId === offlineId) {
          action.data.farmerId = serverId;
          changed = true;
        }
      }
      return action;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedActions));
    }
  };

  for (const action of farmers) {
    try {
      console.log(`[OfflineSync] Syncing farmer: ${action.data.name}...`);
      const result = await registerFarmerByCenter({ ...action.data, offline_id: action.id });

      if (result?.id) {
        console.log(`[OfflineSync] Farmer ${action.data.name} synced successfully. New ID: ${result.id}`);
        idMappings.farmers[action.id] = result.id;
        updatePendingIdReferences(action.id, result.id, 'farmer');
        removePendingAction(action.id);
      } else {
        console.warn(`[OfflineSync] Farmer ${action.data.name} sync returned no ID.`, result);
      }
    } catch (error: any) {
      console.error(`[OfflineSync] Farmer sync failed for ${action.data.name}:`, error.message || error);
      if (error.message?.includes('409') || error.message?.includes('already registered')) {
        console.warn(`[OfflineSync] Conflict detected for ${action.data.name}. Removing duplicate action.`);
        removePendingAction(action.id);
      }
    }
  }

  for (const action of collections) {
    try {
      const resolvedFarmerId = idMappings.farmers[action.data.farmerId] || action.data.farmerId;
      const result = await createCollection({ ...action.data, farmerId: resolvedFarmerId, offline_id: action.id });
      if (result?.id) {
        idMappings.collections[action.id] = result.id;
        updatePendingIdReferences(action.id, result.id, 'collection');
        removePendingAction(action.id); // Remove immediately on success
      }
    } catch (error) {
      console.error(`[OfflineSync] Collection sync failed:`, error);
    }
  }

  saveCache('sync_id_mappings', idMappings);

  for (const action of qualities) {
    try {
      const realId = action.data.offlineCollectionId
        ? (idMappings.collections[action.data.offlineCollectionId] || action.data.collectionId)
        : action.data.collectionId;

      await submitQualityTest({
        ...action.data,
        collectionId: Number(realId) || 0,
        offlineCollectionId: action.data.offlineCollectionId,
        offline_id: action.id,
      });
      removePendingAction(action.id); // Remove immediately on success
    } catch (error) {
      console.error(`[OfflineSync] Quality sync failed:`, error);
    }
  }

  for (const action of dispatches) {
    try {
      const resolvedItems = action.data.items?.map((item: any) => {
        const realId = item.offlineCollectionId
          ? (idMappings.collections[item.offlineCollectionId] || item.collectionId)
          : item.collectionId;
        return { ...item, collectionId: Number(realId) || 0 };
      });

      const result = await createDispatch({ ...action.data, items: resolvedItems, offline_id: action.id });
      if (result && result.id) {
        removePendingAction(action.id); // Remove immediately on success
      }
    } catch (error) {
      console.error(`[OfflineSync] Dispatch sync failed:`, error);
    }
  }

  console.log(`[OfflineSync] Sync cycle complete.`);

  // Final Cache Cleanup to prevent duplication in UI
  const farmersCache = getCache('farmers') || [];
  const updatedFarmersCache = farmersCache.filter((f: any) => !String(f.id).startsWith('OFF-') && !String(f.farmerId).startsWith('OFF-'));
  if (farmersCache.length !== updatedFarmersCache.length) {
    saveCache('farmers', updatedFarmersCache);
  }

  isSyncing = false;
  window.dispatchEvent(new CustomEvent('offline-sync-complete'));
};

export const isOnline = () => navigator.onLine;

export const saveCache = (key: string, data: any) => {
  localStorage.setItem(`cache_${key}`, JSON.stringify(data));
};

export const getCache = (key: string) => {
  const data = localStorage.getItem(`cache_${key}`);
  return data ? JSON.parse(data) : null;
};

export const getPendingByType = (type: PendingAction['type']) => {
  return getPendingActions().filter(a => a.type === type);
};

// Show offline pending records only when offline OR when server doesn't have them yet
export const shouldShowOfflineRecord = (offlineId: string, serverIds: number[]) => {
  // If we're online and the server already has this record, don't show the offline copy
  return !navigator.onLine;
};

window.addEventListener('online', async () => {
  console.log('Online restored, syncing...');
  await syncActions();
});

// Periodic sync (heartbeat) to ensure stuck records are eventually pushed
setInterval(async () => {
  if (navigator.onLine && !isSyncing) {
    const actions = getPendingActions();
    if (actions.length > 0) {
      console.log(`Periodic sync: ${actions.length} actions pending...`);
      await syncActions();
    }
  }
}, 60000); // Every 60 seconds

// Immediate sync on load if online
if (navigator.onLine) {
  syncActions().catch(err => console.error('Initial sync failed:', err));
}
