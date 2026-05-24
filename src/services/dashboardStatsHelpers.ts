import { parseNumber } from '@/lib/utils';
import type { Dispatch, MilkCollection } from '@/types';
import { mergeCollectionHistory, type HistoryCollection } from './collectionDisplayHelpers';
import { mergeDispatchHistory } from './dispatchDisplayHelpers';
import {
  getCachedCollections,
  getCachedDispatches,
} from './offlinePreload';
import {
  getCache,
  getPendingActions,
  mergeFarmersWithPending,
} from './offlineSync';
import type { PendingActionData } from './offlineSyncHelpers';

export interface DashboardStats {
  farmerCount: number;
  totalQuantity: number;
  qualityPassRate: number;
  dispatchCount: number;
  recentCollections: HistoryCollection[];
}

export const calculateQualityPassRate = (collections: MilkCollection[]): number => {
  const tested = collections.filter(
    c => c.qualityResult === 'Pass' || c.qualityResult === 'Fail'
  );
  if (tested.length === 0) return 0;

  const passed = tested.filter(c => c.qualityResult === 'Pass').length;
  return Math.round((passed / tested.length) * 100);
};

export const buildDashboardStats = (
  serverCollections?: MilkCollection[],
  serverFarmers?: unknown[],
  serverDispatches?: Dispatch[],
  pendingActions: PendingActionData[] = getPendingActions()
): DashboardStats => {
  const idMappings = getCache('sync_id_mappings') || { collections: {}, farmers: {} };
  const cachedFarmers = getCache('farmers') || [];
  const farmers = mergeFarmersWithPending((serverFarmers ?? cachedFarmers) as unknown[]);

  const mergedCollections = mergeCollectionHistory(
    serverCollections ?? getCachedCollections(),
    pendingActions,
    farmers,
    idMappings
  );

  const mergedDispatches = mergeDispatchHistory(
    serverDispatches ?? getCachedDispatches(),
    pendingActions.filter(action => action.type === 'dispatch'),
    idMappings
  );

  const totalQuantity = mergedCollections.reduce(
    (sum, collection) => sum + parseNumber(collection.quantity),
    0
  );

  return {
    farmerCount: farmers.length,
    totalQuantity,
    qualityPassRate: calculateQualityPassRate(mergedCollections),
    dispatchCount: mergedDispatches.length,
    recentCollections: mergedCollections.slice(0, 10),
  };
};
