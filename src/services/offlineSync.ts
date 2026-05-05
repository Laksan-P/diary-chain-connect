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

    allActions.forEach(action => {
      if (type === 'collection') {
        // Update dispatches referencing this collection
        if (action.type === 'dispatch' && action.data.items) {
          action.data.items.forEach((item: any) => {
            if (item.offlineCollectionId === offlineId) {
              item.collectionId = serverId;
              changed = true;
            }
          });
        }
        // Update quality tests referencing this collection
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
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allActions));
    }
  };

  for (const action of farmers) {
    try {
      console.log(`[OfflineSync] Registering farmer: ${action.data.name}`);
      const result = await registerFarmerByCenter({ ...action.data, offline_id: action.id });
      if (result?.userId) {
        idMappings.farmers[action.id] = result.userId;
        updatePendingIdReferences(action.id, result.userId, 'farmer');
      }
    } catch (error) {
      console.error(`[OfflineSync] Failed to sync farmer ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  for (const action of collections) {
    try {
      const resolvedFarmerId = idMappings.farmers[action.data.farmerId] || action.data.farmerId;
      console.log(`[OfflineSync] Syncing collection: Farmer ${resolvedFarmerId}, Qty ${action.data.quantity}`);
      const result = await createCollection({ ...action.data, farmerId: resolvedFarmerId, offline_id: action.id });
      if (result?.id) {
        idMappings.collections[action.id] = result.id;
        updatePendingIdReferences(action.id, result.id, 'collection');
      }
    } catch (error) {
      console.error(`[OfflineSync] Failed to sync collection ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  // Save updated mappings
  saveCache('sync_id_mappings', idMappings);

  for (const action of qualities) {
    try {
      const realId = action.data.offlineCollectionId
        ? (idMappings.collections[action.data.offlineCollectionId] || action.data.collectionId)
        : action.data.collectionId;

      console.log(`[OfflineSync] Syncing quality test for collection: ${realId}`);
      await submitQualityTest({
        ...action.data,
        collectionId: Number(realId) || 0,
        offlineCollectionId: action.data.offlineCollectionId,
        offline_id: action.id,
      });
    } catch (error) {
      console.error(`[OfflineSync] Failed to sync quality test ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  for (const action of dispatches) {
    try {
      // Final resolution of IDs
      const resolvedItems = action.data.items?.map((item: any) => {
        const realId = item.offlineCollectionId
          ? (idMappings.collections[item.offlineCollectionId] || item.collectionId)
          : item.collectionId;

        return {
          ...item,
          collectionId: Number(realId) || 0,
          offlineCollectionId: item.offlineCollectionId
        };
      });

      console.log(`[OfflineSync] Sync started for record ${action.id}`);
      const payload = {
        ...action.data,
        items: resolvedItems,
        offline_id: action.id,
      };
      
      const result = await createDispatch(payload);

      if (result && result.id) {
        console.log(`[OfflineSync] Dispatch sync success. Server ID: ${result.id}`);
      } else {
        throw new Error("Invalid sync response");
      }
    } catch (error) {
      console.error(`[OfflineSync] Dispatch sync failed for ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  // Preserve any new actions that were created WHILE we were syncing
  const currentActions = getPendingActions();
  const newActions = currentActions.filter(ca => !actions.some(a => a.id === ca.id));

  localStorage.setItem(STORAGE_KEY, JSON.stringify([...remainingActions, ...newActions]));

  console.log(`[OfflineSync] Sync cycle complete. Remaining: ${remainingActions.length}`);
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
