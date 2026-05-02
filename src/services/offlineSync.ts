import { createCollection, submitQualityTest, createDispatch } from './api';
import { v4 as uuidv4 } from 'uuid';

export interface PendingAction {
  id: string;
  type: 'collection' | 'quality' | 'dispatch' | 'farmer_registration';
  data: any;
  timestamp: number;
  syncedServerId?: number; // Set after successful sync
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

export const syncActions = async () => {
  const actions = getPendingActions();
  if (actions.length === 0) return;

  const remainingActions: PendingAction[] = [];

  // Sync in order: farmer_registration → collection → quality → dispatch
  const farmers = actions.filter(a => a.type === 'farmer_registration');
  const collections = actions.filter(a => a.type === 'collection');
  const qualities = actions.filter(a => a.type === 'quality');
  const dispatches = actions.filter(a => a.type === 'dispatch');

  // Map offlineId → real server ID
  const collectionIdMap: Record<string, number> = {};
  const farmerIdMap: Record<number, number> = {};
  
  // We need api import for farmer registration
  const { registerFarmerByCenter } = await import('@/services/api');

  for (const action of farmers) {
    try {
      const result = await registerFarmerByCenter({ ...action.data, offline_id: action.id });
      if (result?.id && action.data.tempId) {
        farmerIdMap[action.data.tempId] = result.id;
      }
    } catch (error) {
      console.error(`Failed to sync farmer ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  for (const action of collections) {
    try {
      const resolvedFarmerId = farmerIdMap[action.data.farmerId] || action.data.farmerId;
      const result = await createCollection({ ...action.data, farmerId: resolvedFarmerId, offline_id: action.id });
      // Store mapping: offlineId → real DB id
      if (result?.id) collectionIdMap[action.id] = result.id;
      // Success — do NOT keep in remaining
    } catch (error) {
      console.error(`Failed to sync collection ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  for (const action of qualities) {
    try {
      // Replace offlineCollectionId with the real server ID if we just synced it
      const realId = action.data.offlineCollectionId
        ? collectionIdMap[action.data.offlineCollectionId]
        : action.data.collectionId;

      if (action.data.offlineCollectionId && !realId) {
        // Collection hasn't synced yet, retry later
        remainingActions.push(action);
        continue;
      }

      await submitQualityTest({
        ...action.data,
        collectionId: realId,
        offline_id: action.id,
      });
    } catch (error) {
      console.error(`Failed to sync quality test ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  for (const action of dispatches) {
    try {
      // Resolve any offline collection IDs to real server IDs
      const resolvedItems = action.data.items?.map((item: any) => ({
        ...item,
        collectionId: item.offlineCollectionId
          ? (collectionIdMap[item.offlineCollectionId] ?? 0)
          : item.collectionId,
      }));

      await createDispatch({
        ...action.data,
        items: resolvedItems,
        offline_id: action.id,
      });
    } catch (error) {
      console.error(`Failed to sync dispatch ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingActions));
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
