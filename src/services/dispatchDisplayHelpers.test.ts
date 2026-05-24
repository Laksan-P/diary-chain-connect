import { describe, it, expect } from 'vitest';
import {
  dedupeDispatchHistory,
  dispatchRecordsMatch,
  isPendingDispatchOnServer,
  mergeDispatchHistory,
} from './dispatchDisplayHelpers';
import type { Dispatch } from '@/types';

const serverDispatch: Dispatch = {
  id: 12,
  chillingCenterId: 1,
  transporterName: 'Lanka Logistics',
  vehicleNumber: 'WP LV-1234',
  driverContact: '0771234567',
  dispatchDate: '2026-05-24T14:30:00+05:30',
  status: 'Dispatched',
  createdAt: '2026-05-24T14:30:00+05:30',
  totalQuantity: 120,
  items: [{ id: 1, dispatchId: 12, collectionId: 501, quantity: 120, qualityResult: 'Pass' }],
};

const pendingAction = {
  id: 'pending-action-uuid',
  data: {
    chillingCenterId: 1,
    transporterName: 'Lanka Logistics',
    vehicleNumber: 'WP LV-1234',
    driverContact: '0771234567',
    dispatchDate: '2026-05-24T14:30:00+05:30',
    totalQuantity: 120,
    items: [
      {
        id: 0,
        dispatchId: 0,
        collectionId: 'offline-col-uuid',
        offlineCollectionId: 'offline-col-uuid',
        quantity: 120,
        qualityResult: 'Pass',
      },
    ],
  },
};

const idMappings = {
  collections: { 'offline-col-uuid': 501 },
  farmers: {},
};

describe('dispatchRecordsMatch', () => {
  it('matches pending and server dispatches via mapped collection IDs', () => {
    expect(
      dispatchRecordsMatch(
        { ...pendingAction.data, realOfflineId: pendingAction.id, isOffline: true },
        serverDispatch,
        idMappings
      )
    ).toBe(true);
  });

  it('matches by vehicle, transporter, date, and quantity when collection IDs differ', () => {
    expect(
      dispatchRecordsMatch(
        {
          ...pendingAction.data,
          items: [{ id: 0, dispatchId: 0, collectionId: 999, quantity: 120 }],
          isOffline: true,
        },
        serverDispatch
      )
    ).toBe(true);
  });
});

describe('mergeDispatchHistory', () => {
  it('shows only one dispatch during sync when server already has the record', () => {
    const merged = mergeDispatchHistory([serverDispatch], [pendingAction], idMappings);
    expect(merged).toHaveLength(1);
    expect(merged[0].isOffline).toBeFalsy();
    expect(merged[0].id).toBe(12);
  });

  it('shows one pending dispatch offline before server sync', () => {
    const merged = mergeDispatchHistory([], [pendingAction], idMappings);
    expect(merged).toHaveLength(1);
    expect(merged[0].isOffline).toBe(true);
    expect(merged[0].status).toBe('Pending Sync');
  });

  it('dedupes duplicate server and pending entries', () => {
    const pendingDisplay = {
      ...pendingAction.data,
      id: 99,
      realOfflineId: pendingAction.id,
      isOffline: true,
      status: 'Pending Sync' as const,
    };
    const deduped = dedupeDispatchHistory([serverDispatch, pendingDisplay], idMappings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(12);
  });
});

describe('isPendingDispatchOnServer', () => {
  it('detects synced pending dispatch on server', () => {
    expect(
      isPendingDispatchOnServer(
        { ...pendingAction.data, realOfflineId: pendingAction.id, isOffline: true },
        [serverDispatch],
        idMappings
      )
    ).toBe(true);
  });
});
