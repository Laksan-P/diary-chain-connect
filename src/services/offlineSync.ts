import { createCollection, submitQualityTest, createDispatch } from './api';
import { v4 as uuidv4 } from 'uuid';
import {
  dedupeFarmers,
  findDuplicatePendingAction,
  isDuplicateCollection,
  isOfflineId,
  isValidQualityPendingData,
  mergeFarmersWithPending as mergeFarmersWithPendingHelper,
  normalizeFarmerKey,
  pendingRegistrationsToFarmers as pendingRegistrationsToFarmersHelper,
  stripOfflineRecords,
  type PendingActionData,
} from './offlineSyncHelpers';

export type PendingAction = PendingActionData;
export {
  dedupeFarmers,
  isDuplicateCollection,
  normalizeFarmerKey,
  normalizeCollectionKey,
  normalizeQualityKey,
  normalizeDispatchKey,
  isValidQualityPendingData,
} from './offlineSyncHelpers';

const STORAGE_KEY = 'pending_actions';
const SYNC_DEBOUNCE_MS = 400;

export const getPendingActions = (): PendingAction[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const actions: PendingAction[] = stored ? JSON.parse(stored) : [];
  const valid = actions.filter(
    action => action.type !== 'quality' || isValidQualityPendingData(action.data)
  );

  if (valid.length !== actions.length) {
    persistActions(valid);
  }

  return valid;
};

const persistActions = (actions: PendingAction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
};

const updateActionStatus = (id: string, updates: Partial<PendingAction>) => {
  const actions = getPendingActions().map(a => (a.id === id ? { ...a, ...updates } : a));
  persistActions(actions);
};

export const savePendingAction = (type: PendingAction['type'], data: Record<string, unknown>): string => {
  if (type === 'quality' && !isValidQualityPendingData(data)) {
    console.warn('[OfflineSync] Refusing invalid quality pending action', data);
    return '';
  }

  const actions = getPendingActions();
  const existing = findDuplicatePendingAction(actions, type, data);
  if (existing) return existing.id;

  const newAction: PendingAction = {
    id: uuidv4(),
    type,
    data,
    timestamp: Date.now(),
    syncStatus: 'pending',
  };
  actions.push(newAction);
  persistActions(actions);
  window.dispatchEvent(new CustomEvent('offline-action-saved', { detail: newAction }));
  return newAction.id;
};

export const removePendingAction = (id: string) => {
  persistActions(getPendingActions().filter(a => a.id !== id));
  window.dispatchEvent(new CustomEvent('offline-action-saved'));
};

export const cleanOfflineFarmerCache = (): unknown[] => {
  const farmersCache = getCache('farmers') || [];
  const cleaned = stripOfflineRecords(farmersCache);
  if (cleaned.length !== farmersCache.length) {
    saveCache('farmers', cleaned);
  }
  return cleaned;
};

export const cleanAllOfflineCaches = () => {
  cleanOfflineFarmerCache();

  ['collection_history', 'dispatch_all_collections', 'dispatch_pending_collections'].forEach(key => {
    const data = getCache(key);
    if (!Array.isArray(data)) return;
    const cleaned = data.filter((item: Record<string, unknown>) => !isOfflineId(item?.id));
    if (cleaned.length !== data.length) {
      saveCache(key, cleaned);
    }
  });
};

let isSyncing = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeSyncPromise: Promise<void> | null = null;

export const isSyncInProgress = () => isSyncing;

export const getSyncSummary = () => {
  const actions = getPendingActions();
  return {
    total: actions.length,
    pending: actions.filter(a => !a.syncStatus || a.syncStatus === 'pending').length,
    syncing: actions.filter(a => a.syncStatus === 'syncing').length,
    failed: actions.filter(a => a.syncStatus === 'failed').length,
    failedActions: actions.filter(a => a.syncStatus === 'failed'),
    isSyncing,
    isOnline: navigator.onLine,
  };
};

const mapFarmerSyncResult = (
  action: PendingAction,
  serverId: number | string,
  idMappings: { farmers: Record<string, number | string> }
) => {
  const keys = [action.id, action.data.tempId, action.data.farmerId].filter(Boolean).map(String);
  for (const key of keys) {
    idMappings.farmers[key] = serverId;
  }
  updatePendingIdReferences(keys, serverId, 'farmer');
};

const updatePendingIdReferences = (
  offlineIds: string[],
  serverId: number | string,
  type: 'collection' | 'farmer'
) => {
  const offlineIdSet = new Set(offlineIds.filter(Boolean).map(String));
  let changed = false;

  const updatedActions = getPendingActions().map(action => {
    if (type === 'collection') {
      if (action.type === 'dispatch' && action.data.items) {
        action.data.items = (action.data.items as Array<Record<string, unknown>>).map(item => {
          if (item.offlineCollectionId && offlineIdSet.has(String(item.offlineCollectionId))) {
            changed = true;
            return { ...item, collectionId: serverId };
          }
          return item;
        });
      }
      if (
        action.type === 'quality' &&
        action.data.offlineCollectionId &&
        offlineIdSet.has(String(action.data.offlineCollectionId))
      ) {
        action.data.collectionId = serverId;
        changed = true;
      }
    } else if (type === 'farmer') {
      if (action.type === 'collection' && offlineIdSet.has(String(action.data.farmerId))) {
        action.data.farmerId = serverId;
        changed = true;
      }
    }
    return action;
  });

  if (changed) persistActions(updatedActions);
};

const resolveFarmerId = (
  farmerRef: string,
  idMappings: { farmers: Record<string, number | string> }
): number | string | null => {
  const resolved = idMappings.farmers[farmerRef] ?? farmerRef;
  if (String(resolved).startsWith('OFF-')) return null;
  return resolved;
};

const resolveCollectionId = (
  action: PendingAction,
  idMappings: { collections: Record<string, number | string> }
): number | null => {
  const offlineRef = action.data.offlineCollectionId
    ? String(action.data.offlineCollectionId)
    : null;
  const mapped = offlineRef ? idMappings.collections[offlineRef] : null;
  const raw = mapped ?? action.data.collectionId;
  const numeric = Number(raw);
  if (!numeric || String(raw).startsWith('OFF-')) return null;
  return numeric;
};

const canSyncDispatch = (
  action: PendingAction,
  idMappings: { collections: Record<string, number | string> }
): boolean =>
  ((action.data.items as Array<Record<string, unknown>>) || []).every(item => {
    const offlineRef = item.offlineCollectionId ? String(item.offlineCollectionId) : null;
    const mapped = offlineRef ? idMappings.collections[offlineRef] : null;
    const raw = mapped ?? item.collectionId;
    const numeric = Number(raw);
    return numeric > 0 && !String(raw).startsWith('OFF-');
  });

const getCachedCollectionsForDuplicateCheck = (): Record<string, unknown>[] => {
  const sources = ['collection_history', 'dispatch_all_collections', 'collections'];
  const merged: Record<string, unknown>[] = [];
  for (const key of sources) {
    const data = getCache(key);
    if (Array.isArray(data)) merged.push(...data);
  }
  return merged;
};

export const checkDuplicateCollection = (data: Record<string, unknown>): boolean =>
  isDuplicateCollection(data, getPendingActions(), getCachedCollectionsForDuplicateCheck());

export const pendingRegistrationsToFarmers = () =>
  pendingRegistrationsToFarmersHelper(getPendingActions());

export const mergeFarmersWithPending = (serverOrCachedFarmers: unknown[] = []) =>
  mergeFarmersWithPendingHelper(serverOrCachedFarmers as Record<string, unknown>[], getPendingActions());

export const syncActions = async (): Promise<void> => {
  if (isSyncing) return activeSyncPromise ?? Promise.resolve();

  const actions = getPendingActions();
  if (actions.length === 0) return;

  isSyncing = true;
  window.dispatchEvent(new CustomEvent('offline-sync-started'));

  const run = async () => {
    const idMappings = getCache('sync_id_mappings') || { collections: {}, farmers: {} };
    const { registerFarmerByCenter } = await import('@/services/api');

    for (const action of getPendingActions().filter(a => a.type === 'farmer_registration')) {
      updateActionStatus(action.id, { syncStatus: 'syncing', errorMessage: undefined });
      try {
        const result = await registerFarmerByCenter({ ...action.data, offline_id: action.id } as Parameters<typeof registerFarmerByCenter>[0] & { offline_id: string });
        if (result?.id) {
          mapFarmerSyncResult(action, result.id, idMappings);
          saveCache('sync_id_mappings', idMappings);
          removePendingAction(action.id);
          cleanOfflineFarmerCache();
        } else {
          updateActionStatus(action.id, {
            syncStatus: 'failed',
            errorMessage: 'Server returned no farmer ID',
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Farmer sync failed';
        updateActionStatus(action.id, { syncStatus: 'failed', errorMessage: message });
        console.error(`[OfflineSync] Farmer sync failed for ${action.data.name}:`, message);
      }
    }

    for (const action of getPendingActions().filter(a => a.type === 'collection')) {
      const farmerRef = String(action.data.farmerId);
      const resolvedFarmerId = resolveFarmerId(farmerRef, idMappings);
      if (resolvedFarmerId == null) continue;

      updateActionStatus(action.id, { syncStatus: 'syncing', errorMessage: undefined });
      try {
        const result = await createCollection({
          ...action.data,
          farmerId: Number(resolvedFarmerId),
          offline_id: action.id,
        } as Parameters<typeof createCollection>[0] & { offline_id: string });
        if (result?.id) {
          idMappings.collections[action.id] = result.id;
          updatePendingIdReferences([action.id], result.id, 'collection');
          saveCache('sync_id_mappings', idMappings);
          removePendingAction(action.id);
        } else {
          updateActionStatus(action.id, {
            syncStatus: 'failed',
            errorMessage: 'Server returned no collection ID',
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Collection sync failed';
        updateActionStatus(action.id, { syncStatus: 'failed', errorMessage: message });
        console.error('[OfflineSync] Collection sync failed:', message);
      }
    }

    saveCache('sync_id_mappings', idMappings);

    for (const action of getPendingActions().filter(a => a.type === 'quality')) {
      const collectionId = resolveCollectionId(action, idMappings);
      if (collectionId == null) continue;

      updateActionStatus(action.id, { syncStatus: 'syncing', errorMessage: undefined });
      try {
        await submitQualityTest({
          ...action.data,
          collectionId,
          offlineCollectionId: action.data.offlineCollectionId as string | undefined,
          offline_id: action.id,
        } as Parameters<typeof submitQualityTest>[0] & { offline_id: string });
        removePendingAction(action.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Quality sync failed';
        updateActionStatus(action.id, { syncStatus: 'failed', errorMessage: message });
        console.error('[OfflineSync] Quality sync failed:', message);
      }
    }

    for (const action of getPendingActions().filter(a => a.type === 'dispatch')) {
      if (!canSyncDispatch(action, idMappings)) continue;

      updateActionStatus(action.id, { syncStatus: 'syncing', errorMessage: undefined });
      try {
        const resolvedItems = (action.data.items as Array<Record<string, unknown>>)?.map(item => {
          const offlineRef = item.offlineCollectionId ? String(item.offlineCollectionId) : null;
          const mapped = offlineRef ? idMappings.collections[offlineRef] : null;
          const raw = mapped ?? item.collectionId;
          return { ...item, collectionId: Number(raw) || 0 };
        });

        const result = await createDispatch({
          ...action.data,
          items: resolvedItems,
          offline_id: action.id,
        } as Parameters<typeof createDispatch>[0] & { offline_id: string });

        if (result?.id) {
          removePendingAction(action.id);
        } else {
          updateActionStatus(action.id, {
            syncStatus: 'failed',
            errorMessage: 'Server returned no dispatch ID',
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Dispatch sync failed';
        updateActionStatus(action.id, { syncStatus: 'failed', errorMessage: message });
        console.error('[OfflineSync] Dispatch sync failed:', message);
      }
    }

    cleanAllOfflineCaches();
  };

  activeSyncPromise = run()
    .catch(err => console.error('[OfflineSync] Sync cycle error:', err))
    .finally(() => {
      isSyncing = false;
      activeSyncPromise = null;
      window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    });

  return activeSyncPromise;
};

export const requestSync = () => {
  if (!navigator.onLine) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    syncActions().catch(err => console.error('[OfflineSync] Debounced sync failed:', err));
  }, SYNC_DEBOUNCE_MS);
};

export const isOnline = () => navigator.onLine;

export const saveCache = (key: string, data: unknown) => {
  localStorage.setItem(`cache_${key}`, JSON.stringify(data));
};

export const getCache = (key: string) => {
  const data = localStorage.getItem(`cache_${key}`);
  return data ? JSON.parse(data) : null;
};

export const getPendingByType = (type: PendingAction['type']) =>
  getPendingActions().filter(a => a.type === type);

export const shouldShowOfflineRecord = (_offlineId: string, _serverIds: number[]) =>
  !navigator.onLine;

export { preloadOfflineData, OFFLINE_EMPTY_MESSAGE, OFFLINE_FARMERS_EMPTY_MESSAGE } from './offlinePreload';

if (typeof window !== 'undefined') {
  window.addEventListener('offline-action-saved', () => requestSync());

  window.addEventListener('online', () => requestSync());

  setInterval(() => {
    if (navigator.onLine && !isSyncing && getPendingActions().length > 0) {
      requestSync();
    }
  }, 60000);

  if (navigator.onLine) {
    requestSync();
  }
}
