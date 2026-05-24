import type { Dispatch } from '@/types';

type IdMappings = { collections?: Record<string, number | string>; farmers?: Record<string, number | string> };

const calcTotalQuantity = (dispatch: Partial<Dispatch>): number => {
  if (dispatch.totalQuantity != null) return Number(dispatch.totalQuantity);
  return (dispatch.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
};

export const getDispatchCollectionIds = (
  dispatch: Partial<Dispatch>,
  idMappings?: IdMappings
): string[] => {
  const items = dispatch.items || [];
  const refs = items.flatMap(item => {
    const raw = item.offlineCollectionId ?? item.collectionId;
    return raw != null ? [String(raw)] : [];
  });

  const resolved = refs.map(ref => {
    const mapped = idMappings?.collections?.[ref];
    return String(mapped ?? ref);
  });

  return [...new Set(resolved.filter(Boolean))].sort();
};

const dispatchDateKey = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const normalizeDispatchDisplayKey = (
  dispatch: Partial<Dispatch> & { realOfflineId?: string },
  idMappings?: IdMappings
): string => {
  const offlineId = dispatch.realOfflineId ?? dispatch.offline_id;
  if (offlineId) return `offline:${offlineId}`;

  if (dispatch.id != null && !dispatch.isOffline) return `id:${dispatch.id}`;

  const collectionIds = getDispatchCollectionIds(dispatch, idMappings);
  if (collectionIds.length) return `collections:${collectionIds.join(',')}`;

  const date = dispatchDateKey(dispatch.dispatchDate);
  const qty = calcTotalQuantity(dispatch);
  return `sig:${dispatch.chillingCenterId}:${String(dispatch.vehicleNumber || '').toUpperCase()}:${String(dispatch.transporterName || '').trim().toLowerCase()}:${date}:${qty}`;
};

export const sameDispatchSignature = (a: Partial<Dispatch>, b: Partial<Dispatch>): boolean => {
  const vehicleMatch =
    String(a.vehicleNumber || '').toUpperCase() === String(b.vehicleNumber || '').toUpperCase();
  const transporterMatch =
    String(a.transporterName || '').trim().toLowerCase() ===
    String(b.transporterName || '').trim().toLowerCase();
  const dateMatch = dispatchDateKey(a.dispatchDate) === dispatchDateKey(b.dispatchDate);
  const qtyMatch =
    Math.abs(calcTotalQuantity(a) - calcTotalQuantity(b)) < 0.01;

  return vehicleMatch && transporterMatch && dateMatch && qtyMatch;
};

export const dispatchRecordsMatch = (
  a: Partial<Dispatch> & { realOfflineId?: string },
  b: Partial<Dispatch> & { realOfflineId?: string },
  idMappings?: IdMappings
): boolean => {
  if (a.realOfflineId && (b.offline_id === a.realOfflineId || b.realOfflineId === a.realOfflineId)) {
    return true;
  }

  if (a.id != null && b.id != null && String(a.id) === String(b.id) && !a.isOffline && !b.isOffline) {
    return true;
  }

  const aCols = getDispatchCollectionIds(a, idMappings);
  const bCols = getDispatchCollectionIds(b, idMappings);
  if (aCols.length && bCols.length && aCols.join(',') === bCols.join(',')) {
    return true;
  }

  if (aCols.length && bCols.length) {
    const overlap = aCols.filter(id => bCols.includes(id));
    if (overlap.length === aCols.length || overlap.length === bCols.length) {
      return true;
    }
  }

  return sameDispatchSignature(a, b);
};

export const isPendingDispatchOnServer = (
  pending: Partial<Dispatch> & { realOfflineId?: string },
  serverDispatches: Partial<Dispatch>[],
  idMappings?: IdMappings
): boolean =>
  serverDispatches.some(server => dispatchRecordsMatch(pending, server, idMappings));

export const dedupeDispatchHistory = (
  dispatches: Array<Partial<Dispatch> & { realOfflineId?: string; isOffline?: boolean }>,
  idMappings?: IdMappings
): Dispatch[] => {
  const result: Array<Partial<Dispatch> & { realOfflineId?: string; isOffline?: boolean }> = [];

  for (const dispatch of dispatches) {
    const matchIndex = result.findIndex(existing =>
      dispatchRecordsMatch(existing, dispatch, idMappings)
    );

    if (matchIndex === -1) {
      result.push(dispatch);
      continue;
    }

    const existing = result[matchIndex];
    if (existing.isOffline && !dispatch.isOffline) {
      result[matchIndex] = dispatch;
    }
  }

  return result as Dispatch[];
};

export const mergeDispatchHistory = (
  serverDispatches: Dispatch[],
  pendingActions: Array<{ id: string; data: Partial<Dispatch> }>,
  idMappings?: IdMappings
): Dispatch[] => {
  const maxServerId = serverDispatches.reduce(
    (max, curr) => (typeof curr.id === 'number' && curr.id > max ? curr.id : max),
    0
  );

  const pendingDispatches = pendingActions
    .filter(a => a.data)
    .map((a, index) => ({
      ...a.data,
      id: maxServerId + index + 1,
      realOfflineId: a.id,
      offline_id: a.id,
      status: 'Pending Sync' as const,
      isOffline: true,
    })) as Array<Partial<Dispatch> & { realOfflineId?: string; isOffline?: boolean }>;

  const unsyncedPending = pendingDispatches.filter(
    pending => !isPendingDispatchOnServer(pending, serverDispatches, idMappings)
  );

  return dedupeDispatchHistory([...serverDispatches, ...unsyncedPending], idMappings).sort((a, b) => {
    const dateA = new Date(a.dispatchDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.dispatchDate || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
};
