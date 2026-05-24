import type { MilkCollection } from '@/types';
import { normalizeCollectionKey, type PendingActionData } from './offlineSyncHelpers';

export type IdMappings = {
  collections?: Record<string, number | string>;
  farmers?: Record<string, number | string>;
};

export type HistoryCollection = MilkCollection & {
  isOffline?: boolean;
  realOfflineId?: string;
  farmerCode?: string;
};

export const resolveCollectionRef = (
  ref: string | number | undefined,
  idMappings?: IdMappings
): string => {
  if (ref == null) return '';
  const key = String(ref);
  const mapped = idMappings?.collections?.[key];
  return mapped != null ? String(mapped) : key;
};

export const resolveFarmerRef = (
  ref: string | number | undefined,
  idMappings?: IdMappings
): string => {
  if (ref == null) return '';
  const key = String(ref);
  const mapped = idMappings?.farmers?.[key];
  return mapped != null ? String(mapped) : key;
};

export const normalizeCollectionDisplayKey = (
  collection: Partial<HistoryCollection>,
  idMappings?: IdMappings
): string => {
  const offlineActionId = collection.realOfflineId ?? (collection.isOffline ? collection.id : null);
  if (offlineActionId != null) {
    const mapped = idMappings?.collections?.[String(offlineActionId)];
    if (mapped != null) return `id:${mapped}`;
    return `offline:${offlineActionId}`;
  }

  if (collection.id != null && !collection.isOffline) {
    return `id:${collection.id}`;
  }

  return normalizeCollectionKey(collection as Record<string, unknown>);
};

export const collectionRecordsMatch = (
  a: Partial<HistoryCollection>,
  b: Partial<HistoryCollection>,
  idMappings?: IdMappings
): boolean => {
  if (normalizeCollectionDisplayKey(a, idMappings) === normalizeCollectionDisplayKey(b, idMappings)) {
    return true;
  }

  const aRefs = new Set<string>([
    resolveCollectionRef(a.realOfflineId ?? a.id, idMappings),
    String(a.id ?? ''),
  ].filter(Boolean));

  const bRefs = new Set<string>([
    resolveCollectionRef(b.realOfflineId ?? b.id, idMappings),
    String(b.id ?? ''),
  ].filter(Boolean));

  for (const ref of aRefs) {
    if (bRefs.has(ref)) return true;
  }

  return normalizeCollectionKey(a as Record<string, unknown>) ===
    normalizeCollectionKey(b as Record<string, unknown>);
};

const resolveFarmer = (
  farmerId: unknown,
  farmers: Array<Record<string, unknown>>,
  idMappings?: IdMappings
) => {
  const refs = new Set([
    String(farmerId ?? ''),
    resolveFarmerRef(farmerId as string | number, idMappings),
  ].filter(Boolean));

  return farmers.find(f =>
    refs.has(String(f.id ?? '')) ||
    refs.has(String(f.farmerId ?? '')) ||
    refs.has(String(f.tempId ?? ''))
  );
};

const collectionRefVariants = (
  collection: Partial<HistoryCollection>,
  idMappings?: IdMappings
): Set<string> => {
  const refs = new Set<string>();
  const primary = collection.realOfflineId ?? collection.id;
  if (primary != null) {
    refs.add(String(primary));
    refs.add(resolveCollectionRef(primary, idMappings));
  }
  return refs;
};

export const findQualityActionForCollection = (
  collection: Partial<HistoryCollection>,
  qualityActions: PendingActionData[],
  idMappings?: IdMappings
): PendingActionData | undefined => {
  const refs = collectionRefVariants(collection, idMappings);

  return qualityActions.find(action => {
    const offlineRef = action.data?.offlineCollectionId;
    const collectionId = action.data?.collectionId;

    if (offlineRef && refs.has(String(offlineRef))) return true;
    if (collectionId && refs.has(String(collectionId))) return true;
    if (offlineRef && refs.has(resolveCollectionRef(String(offlineRef), idMappings))) return true;
    return false;
  });
};

export const isCollectionInPendingDispatch = (
  collection: Partial<HistoryCollection>,
  dispatchActions: PendingActionData[],
  idMappings?: IdMappings
): boolean => {
  const refs = collectionRefVariants(collection, idMappings);

  return dispatchActions.some(action =>
    (action.data?.items as Array<Record<string, unknown>> | undefined)?.some(item => {
      const itemRefs = [
        item.offlineCollectionId,
        item.collectionId,
        item.collection_id,
      ]
        .filter(Boolean)
        .flatMap(value => [String(value), resolveCollectionRef(String(value), idMappings)]);

      return itemRefs.some(ref => refs.has(ref));
    })
  );
};

export const applyCollectionHistoryOverlays = (
  collection: HistoryCollection,
  qualityActions: PendingActionData[],
  dispatchActions: PendingActionData[],
  idMappings?: IdMappings
): HistoryCollection => {
  const qualityTest = findQualityActionForCollection(collection, qualityActions, idMappings);
  const pendingDispatch = isCollectionInPendingDispatch(collection, dispatchActions, idMappings);

  let qualityResult = collection.qualityResult;
  let failureReason = collection.failureReason;

  if (qualityTest?.data?.result) {
    qualityResult = qualityTest.data.result as MilkCollection['qualityResult'];
    failureReason = (qualityTest.data.reason as string | undefined) ?? failureReason;
  }

  let dispatchStatus = collection.dispatchStatus ?? 'Pending';

  if (pendingDispatch) {
    dispatchStatus = collection.isOffline ? 'Pending Sync' : (dispatchStatus === 'Dispatched' ? dispatchStatus : 'Pending Sync');
  }

  return {
    ...collection,
    qualityResult,
    failureReason: failureReason || '—',
    dispatchStatus,
  };
};

export const isPendingCollectionOnServer = (
  pendingAction: PendingActionData,
  serverCollections: Partial<HistoryCollection>[],
  idMappings?: IdMappings
): boolean => {
  const pendingRow: HistoryCollection = {
    ...(pendingAction.data as HistoryCollection),
    id: pendingAction.id,
    realOfflineId: pendingAction.id,
    isOffline: true,
  };

  return serverCollections.some(server =>
    collectionRecordsMatch(pendingRow, server, idMappings)
  );
};

export const dedupeCollectionHistory = (
  collections: HistoryCollection[],
  idMappings?: IdMappings
): HistoryCollection[] => {
  const result: HistoryCollection[] = [];

  for (const collection of collections) {
    const matchIndex = result.findIndex(existing =>
      collectionRecordsMatch(existing, collection, idMappings)
    );

    if (matchIndex === -1) {
      result.push(collection);
      continue;
    }

    const existing = result[matchIndex];
    if (existing.isOffline && !collection.isOffline) {
      result[matchIndex] = collection;
      continue;
    }

    if (!existing.isOffline && collection.isOffline) {
      // Keep the server row; pending duplicate is dropped.
    }
  }

  return result;
};

export const mergeCollectionHistory = (
  serverCollections: HistoryCollection[],
  pendingActions: PendingActionData[],
  farmers: Array<Record<string, unknown>> = [],
  idMappings?: IdMappings
): HistoryCollection[] => {
  const pendingCollections = pendingActions.filter(action => action.type === 'collection');
  const pendingQuality = pendingActions.filter(action => action.type === 'quality');
  const pendingDispatches = pendingActions.filter(action => action.type === 'dispatch');

  const serverRows = serverCollections.map(collection =>
    applyCollectionHistoryOverlays(
      { ...collection, isOffline: false },
      pendingQuality,
      pendingDispatches,
      idMappings
    )
  );

  const pendingRows = pendingCollections
    .filter(action => !isPendingCollectionOnServer(action, serverCollections, idMappings))
    .map(action => {
      const farmer = resolveFarmer(action.data?.farmerId, farmers, idMappings);
      const farmerCode =
        (action.data?.farmerId as string | undefined) ||
        (farmer?.farmerId as string | undefined) ||
        (farmer?.id != null ? String(farmer.id) : 'OFF-F');

      const row: HistoryCollection = {
        ...(action.data as HistoryCollection),
        id: action.id,
        realOfflineId: action.id,
        isOffline: true,
        farmerCode,
        farmerName:
          (action.data?.farmerName as string | undefined)?.trim() ||
          (farmer?.name as string | undefined)?.trim() ||
          'Offline Farmer',
        createdAt: new Date(action.timestamp).toISOString(),
        qualityResult: undefined,
        dispatchStatus: 'Pending',
      };

      return applyCollectionHistoryOverlays(row, pendingQuality, pendingDispatches, idMappings);
    });

  return dedupeCollectionHistory([...pendingRows, ...serverRows], idMappings).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return dateB - dateA;
  });
};
