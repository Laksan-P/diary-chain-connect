export type PendingActionType = 'collection' | 'quality' | 'dispatch' | 'farmer_registration';
export type SyncStatus = 'pending' | 'syncing' | 'failed';

export interface PendingActionData {
  id: string;
  type: PendingActionType;
  data: Record<string, unknown>;
  timestamp: number;
  syncStatus?: SyncStatus;
  errorMessage?: string;
  syncedServerId?: number | string;
}

export const isOfflineId = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith('OFF-');

export const normalizeFarmerKey = (farmer: Record<string, unknown>): string => {
  const serverId = farmer?.id;
  if (serverId != null && !isOfflineId(serverId) && !Number.isNaN(Number(serverId))) {
    return `id:${serverId}`;
  }

  const farmerCode = farmer?.farmerId;
  if (farmerCode && !isOfflineId(farmerCode)) {
    return `farmerId:${farmerCode}`;
  }

  const tempId =
    farmer?.tempId ??
    (isOfflineId(farmer?.id) ? farmer.id : null) ??
    (isOfflineId(farmerCode) ? farmerCode : null);
  if (tempId) return `temp:${tempId}`;

  if (typeof farmer?.nic === 'string' && farmer.nic.trim()) {
    return `nic:${farmer.nic.trim().toUpperCase()}`;
  }
  if (typeof farmer?.phone === 'string' && farmer.phone.trim()) {
    return `phone:${farmer.phone.trim()}`;
  }
  if (typeof farmer?.email === 'string' && farmer.email.trim()) {
    return `email:${farmer.email.trim().toLowerCase()}`;
  }

  const name = typeof farmer?.name === 'string' ? farmer.name.trim().toLowerCase() : '';
  const ccId = farmer?.chillingCenterId ?? '';
  if (name && ccId) return `name-cc:${name}:${ccId}`;

  return `unknown:${JSON.stringify(farmer)}`;
};

export const isOfflineFarmerRecord = (farmer: Record<string, unknown>): boolean =>
  isOfflineId(farmer?.id) ||
  isOfflineId(farmer?.farmerId) ||
  isOfflineId(farmer?.tempId) ||
  Boolean(farmer?._pending);

export const dedupeFarmers = <T extends Record<string, unknown>>(farmers: T[]): T[] => {
  const farmersMatch = (a: T, b: T): boolean => {
    if (normalizeFarmerKey(a) === normalizeFarmerKey(b)) return true;
    if (a.nic && b.nic && String(a.nic) === String(b.nic)) return true;
    if (a.phone && b.phone && String(a.phone) === String(b.phone)) return true;
    if (a.email && b.email && String(a.email).toLowerCase() === String(b.email).toLowerCase()) return true;
    return false;
  };

  const result: T[] = [];

  for (const farmer of farmers) {
    const existingIndex = result.findIndex(existing => farmersMatch(existing, farmer));

    if (existingIndex === -1) {
      result.push(farmer);
      continue;
    }

    if (isOfflineFarmerRecord(result[existingIndex]) && !isOfflineFarmerRecord(farmer)) {
      result[existingIndex] = farmer;
    }
  }

  return result;
};

export const normalizeCollectionKey = (data: Record<string, unknown>): string => {
  const farmerId = data.farmerId ?? data.farmer_id;
  const centerId = data.chillingCenterId ?? data.chilling_center_id;
  const date = data.date;
  const time = data.time;
  const quantity = data.quantity;
  const milkType = data.milkType ?? data.milk_type ?? 'Cow';
  return `col:${farmerId}:${centerId}:${date}:${time}:${quantity}:${milkType}`;
};

export const normalizeQualityKey = (data: Record<string, unknown>): string => {
  const collectionId = data.offlineCollectionId ?? data.collectionId ?? data.collection_id;
  const fat = data.fat;
  const snf = data.snf;
  const water = data.water;
  return `qt:${collectionId}:${fat}:${snf}:${water}`;
};

export const normalizeDispatchKey = (data: Record<string, unknown>): string => {
  const centerId = data.chillingCenterId;
  const vehicle = data.vehicleNumber;
  const date = data.dispatchDate;
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const collectionRefs = items
    .map(i => i.offlineCollectionId ?? i.collectionId ?? i.collection_id)
    .filter(Boolean)
    .map(String)
    .sort()
    .join(',');
  return `dp:${centerId}:${vehicle}:${date}:${collectionRefs}`;
};

export const findDuplicatePendingAction = (
  actions: PendingActionData[],
  type: PendingActionType,
  data: Record<string, unknown>
): PendingActionData | undefined => {
  if (type === 'farmer_registration') {
    return actions.find(a => {
      if (a.type !== 'farmer_registration') return false;
      const d = a.data;
      if (data.tempId && d.tempId === data.tempId) return true;
      if (data.nic && d.nic && data.nic === d.nic) return true;
      if (data.phone && d.phone && data.phone === d.phone) return true;
      if (data.email && d.email && data.email === d.email) return true;
      if (data.name && d.name && data.name === d.name && data.chillingCenterId === d.chillingCenterId) {
        return true;
      }
      return false;
    });
  }

  if (type === 'collection') {
    const key = normalizeCollectionKey(data);
    return actions.find(a => a.type === 'collection' && normalizeCollectionKey(a.data) === key);
  }

  if (type === 'quality') {
    const key = normalizeQualityKey(data);
    return actions.find(a => a.type === 'quality' && normalizeQualityKey(a.data) === key);
  }

  if (type === 'dispatch') {
    const key = normalizeDispatchKey(data);
    return actions.find(a => a.type === 'dispatch' && normalizeDispatchKey(a.data) === key);
  }

  return undefined;
};

export const isDuplicateCollection = (
  data: Record<string, unknown>,
  pendingActions: PendingActionData[],
  cachedCollections: Record<string, unknown>[] = []
): boolean => {
  const key = normalizeCollectionKey(data);

  if (pendingActions.some(a => a.type === 'collection' && normalizeCollectionKey(a.data) === key)) {
    return true;
  }

  return cachedCollections.some(c => normalizeCollectionKey(c) === key);
};

export const pendingRegistrationsToFarmers = (actions: PendingActionData[]) =>
  actions
    .filter(a => a.type === 'farmer_registration')
    .map(a => ({
      id: a.data.tempId || a.data.farmerId || `OFF-${a.id}`,
      farmerId: a.data.farmerId || a.data.tempId || `OFF-${a.id}`,
      tempId: a.data.tempId,
      name: a.data.name,
      nic: a.data.nic,
      phone: a.data.phone,
      email: a.data.email,
      address: a.data.address || '',
      chillingCenterId: a.data.chillingCenterId,
      userId: 0,
      createdAt: new Date(a.timestamp).toISOString(),
      _pending: true,
    }));

export const mergeFarmersWithPending = (
  serverOrCachedFarmers: Record<string, unknown>[] = [],
  pendingActions: PendingActionData[]
): Record<string, unknown>[] => {
  const withoutOfflineCache = (serverOrCachedFarmers || []).filter(
    f => !isOfflineId(f?.id) && !isOfflineId(f?.farmerId)
  );
  return dedupeFarmers([...withoutOfflineCache, ...pendingRegistrationsToFarmers(pendingActions)]);
};

export const stripOfflineRecords = <T extends Record<string, unknown>>(records: T[]): T[] =>
  records.filter(r => !isOfflineId(r?.id) && !isOfflineId(r?.farmerId));
