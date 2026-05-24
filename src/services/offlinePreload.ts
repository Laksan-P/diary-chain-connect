import { getFarmers, getCollections, getDispatches, getChillingCenter } from './api';
import { getCache, saveCache, getPendingActions, mergeFarmersWithPending } from './offlineSync';
import type { MilkCollection, Dispatch } from '@/types';
import type { PendingActionData } from './offlineSyncHelpers';

export const OFFLINE_EMPTY_MESSAGE =
  'No offline data available. Please connect once to sync farmers and collection data.';

export const OFFLINE_FARMERS_EMPTY_MESSAGE =
  'No cached farmers available. Connect to internet once to prepare offline data.';

export const getQualityEligibleCollections = (collections: MilkCollection[]): MilkCollection[] =>
  collections.filter(c => !c.qualityResult);

export const getDispatchEligibleCollections = (collections: MilkCollection[]): MilkCollection[] =>
  collections.filter(
    c => c.qualityResult === 'Pass' && (!c.dispatchStatus || c.dispatchStatus === 'Pending')
  );

export const hasCachedFarmers = (): boolean => {
  const farmers = getCache('farmers');
  return Array.isArray(farmers) && farmers.length > 0;
};

export const hasCachedCollections = (): boolean => {
  const keys = ['collection_history', 'collections', 'quality_eligible_collections', 'dispatch_all_collections'];
  return keys.some(key => {
    const data = getCache(key);
    return Array.isArray(data) && data.length > 0;
  });
};

export const getCachedCollections = (): MilkCollection[] =>
  getCache('collection_history') ||
  getCache('collections') ||
  getCache('dispatch_all_collections') ||
  [];

export async function preloadOfflineData(centerId: number): Promise<void> {
  if (!centerId || !navigator.onLine) return;

  const [farmersResult, collectionsResult, dispatchesResult, centerResult] = await Promise.allSettled([
    getFarmers(centerId),
    getCollections(centerId),
    getDispatches(centerId),
    getChillingCenter(centerId),
  ]);

  if (farmersResult.status === 'fulfilled') {
    saveCache('farmers', farmersResult.value);
  }

  if (collectionsResult.status === 'fulfilled') {
    const collections = collectionsResult.value;
    saveCache('collection_history', collections);
    saveCache('collections', collections);
    saveCache('quality_eligible_collections', getQualityEligibleCollections(collections));
    saveCache('dispatch_eligible_collections', getDispatchEligibleCollections(collections));
    saveCache('dispatch_all_collections', collections);
  }

  if (dispatchesResult.status === 'fulfilled') {
    saveCache('dispatch_history', dispatchesResult.value);
  }

  if (centerResult.status === 'fulfilled') {
    saveCache('chilling_center_details', centerResult.value);
  }
}

export const mergeQualityEligibleCollections = (
  serverOrCached: MilkCollection[] = [],
  pendingActions: PendingActionData[] = getPendingActions()
): MilkCollection[] => {
  const allPendingQuality = pendingActions.filter(a => a.type === 'quality');
  const alreadyTestedOnlineIds = new Set(
    allPendingQuality.map(q => String(q.data.collectionId)).filter(id => id !== '0' && id !== '')
  );
  const alreadyTestedOfflineIds = new Set(
    allPendingQuality.map(q => q.data.offlineCollectionId).filter(Boolean).map(String)
  );

  const farmers = mergeFarmersWithPending(getCache('farmers') || []) as Array<Record<string, unknown>>;

  const pendingFromServer = serverOrCached.filter(
    c => !c.qualityResult && !alreadyTestedOnlineIds.has(String(c.id))
  );

  const offlinePending = pendingActions
    .filter(a => a.type === 'collection')
    .filter(a => !alreadyTestedOfflineIds.has(a.id))
    .map(a => {
      const farmer = farmers.find(f => String(f.id) === String(a.data?.farmerId));
      const finalFarmerName =
        (a.data?.farmerName as string | undefined)?.trim() ||
        (farmer?.name as string | undefined)?.trim() ||
        'Offline Farmer';

      return {
        ...(a.data as MilkCollection),
        id: a.id,
        displayId: `OFF-${a.id.substring(0, 4).toUpperCase()}`,
        isOffline: true,
        farmerName: finalFarmerName,
        qualityResult: undefined,
      } as MilkCollection;
    });

  const offlineIds = new Set(offlinePending.map(o => String(o.id)));
  const uniquePendingFromServer = pendingFromServer.filter(
    c => !offlineIds.has(String(c.id))
  );

  return [...offlinePending, ...uniquePendingFromServer];
};

type IdMappings = { collections?: Record<string, number | string>; farmers?: Record<string, number | string> };

export const mergeDispatchEligibleCollections = (
  serverOrCached: MilkCollection[] = [],
  pendingActions: PendingActionData[] = getPendingActions(),
  idMappings: IdMappings = getCache('sync_id_mappings') || { collections: {}, farmers: {} }
): MilkCollection[] => {
  const allQuality = pendingActions.filter(a => a.type === 'quality');
  const allDispatches = pendingActions.filter(a => a.type === 'dispatch');
  const farmers = mergeFarmersWithPending(getCache('farmers') || []) as Array<Record<string, unknown>>;

  const updatedServer = serverOrCached.map(col => {
    const qualityTest = allQuality.find(
      q =>
        String(q.data?.collectionId) === String(col.id) ||
        String(q.data?.offlineCollectionId) === String(col.id)
    );
    const dispatchedLocally = allDispatches.some(act =>
      act.data?.items?.some(
        (i: { collectionId?: number | string; offlineCollectionId?: string }) =>
          String(i.collectionId) === String(col.id) ||
          String(i.offlineCollectionId) === String(col.id)
      )
    );

    return {
      ...col,
      qualityResult: qualityTest ? (qualityTest.data.result as MilkCollection['qualityResult']) : col.qualityResult,
      dispatchStatus: dispatchedLocally ? 'Dispatched' : col.dispatchStatus,
    } as MilkCollection;
  });

  const eligibleServer = getDispatchEligibleCollections(updatedServer);

  const dispatchedIds = new Set<string>();
  allDispatches.forEach(action => {
    action.data?.items?.forEach((item: { collectionId?: number | string; offlineCollectionId?: string }) => {
      if (item.collectionId != null) dispatchedIds.add(String(item.collectionId));
      if (item.offlineCollectionId) dispatchedIds.add(String(item.offlineCollectionId));
      const mapped = idMappings.collections?.[String(item.offlineCollectionId ?? item.collectionId)];
      if (mapped != null) dispatchedIds.add(String(mapped));
    });
  });

  eligibleServer.forEach(col => {
    dispatchedIds.add(String(col.id));
    const mapped = idMappings.collections?.[String(col.id)];
    if (mapped != null) dispatchedIds.add(String(mapped));
  });

  const offlineCollections = pendingActions
    .filter(a => a.type === 'collection')
    .filter(a => !dispatchedIds.has(a.id))
    .map(a => {
      const qualityTest = allQuality.find(q => String(q.data?.offlineCollectionId) === String(a.id));
      if (!qualityTest || qualityTest.data?.result !== 'Pass') return null;

      const farmer = farmers.find(f => String(f.id) === String(a.data?.farmerId));
      return {
        ...(a.data as MilkCollection),
        id: a.id,
        displayId: `OFF-${a.id.substring(0, 4).toUpperCase()}`,
        isOffline: true,
        farmerName:
          (a.data?.farmerName as string | undefined)?.trim() ||
          (farmer?.name as string | undefined)?.trim() ||
          'Offline Farmer',
        qualityResult: 'Pass' as const,
        dispatchStatus: 'Pending' as const,
      } as MilkCollection;
    })
    .filter(Boolean) as MilkCollection[];

  const uniqueServer = eligibleServer.filter(
    serverCol =>
      !offlineCollections.some(
        offlineCol =>
          String(offlineCol.farmerName).trim().toLowerCase() ===
            String(serverCol.farmerName).trim().toLowerCase() &&
          Number(offlineCol.quantity) === Number(serverCol.quantity) &&
          String(offlineCol.date) === String(serverCol.date)
      )
  );

  return [...offlineCollections, ...uniqueServer];
};

export const getCachedDispatches = (): Dispatch[] => getCache('dispatch_history') || [];
