import { describe, it, expect } from 'vitest';
import {
  applyCollectionHistoryOverlays,
  collectionRecordsMatch,
  mergeCollectionHistory,
} from './collectionDisplayHelpers';
import type { PendingActionData } from './offlineSyncHelpers';

const pendingCollection: PendingActionData = {
  id: 'col-action-uuid',
  type: 'collection',
  timestamp: Date.now(),
  data: {
    farmerId: 'OFF-FARM-1',
    farmerName: 'Tharun Perera',
    chillingCenterId: 1,
    date: '2026-05-24',
    time: '10:00',
    temperature: 4,
    quantity: 50,
    milkType: 'Cow',
  },
};

const pendingQuality: PendingActionData = {
  id: 'quality-uuid',
  type: 'quality',
  timestamp: Date.now(),
  data: {
    collectionId: 0,
    offlineCollectionId: 'col-action-uuid',
    snf: 8.6,
    fat: 3.6,
    water: 0.4,
    result: 'Pass',
    reason: undefined,
  },
};

const pendingDispatch: PendingActionData = {
  id: 'dispatch-uuid',
  type: 'dispatch',
  timestamp: Date.now(),
  data: {
    chillingCenterId: 1,
    vehicleNumber: 'WP LV-1234',
    transporterName: 'Lanka Logistics',
    dispatchDate: '2026-05-24T10:30:00+05:30',
    items: [{ collectionId: 'col-action-uuid', offlineCollectionId: 'col-action-uuid', quantity: 50 }],
  },
};

describe('mergeCollectionHistory', () => {
  it('shows offline collection immediately without server data', () => {
    const merged = mergeCollectionHistory([], [pendingCollection], [], {});
    expect(merged).toHaveLength(1);
    expect(merged[0].isOffline).toBe(true);
    expect(merged[0].farmerName).toBe('Tharun Perera');
  });

  it('applies offline quality result to collection history row', () => {
    const merged = mergeCollectionHistory([], [pendingCollection, pendingQuality], [], {});
    expect(merged).toHaveLength(1);
    expect(merged[0].qualityResult).toBe('Pass');
  });

  it('applies pending dispatch status while offline', () => {
    const merged = mergeCollectionHistory(
      [],
      [pendingCollection, pendingQuality, pendingDispatch],
      [],
      {}
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].dispatchStatus).toBe('Pending Sync');
  });

  it('does not duplicate during sync when server record matches pending', () => {
    const serverCollection = {
      id: 501,
      farmerId: 99,
      farmerCode: 'FRM-028',
      farmerName: 'Tharun Perera',
      chillingCenterId: 1,
      date: '2026-05-24',
      time: '10:00',
      temperature: 4,
      quantity: 50,
      milkType: 'Cow' as const,
      qualityResult: 'Pass' as const,
      dispatchStatus: 'Dispatched' as const,
      createdAt: '2026-05-24T10:00:00Z',
    };

    const idMappings = { collections: { 'col-action-uuid': 501 }, farmers: {} };
    const merged = mergeCollectionHistory(
      [serverCollection],
      [pendingCollection, pendingQuality, pendingDispatch],
      [],
      idMappings
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(501);
    expect(merged[0].isOffline).toBeFalsy();
  });
});

describe('collectionRecordsMatch', () => {
  it('matches pending and server rows via sync_id_mappings', () => {
    expect(
      collectionRecordsMatch(
        { id: 'col-action-uuid', realOfflineId: 'col-action-uuid', isOffline: true, ...pendingCollection.data },
        { id: 501, ...pendingCollection.data, isOffline: false },
        { collections: { 'col-action-uuid': 501 } }
      )
    ).toBe(true);
  });
});

describe('applyCollectionHistoryOverlays', () => {
  it('overlays pending quality onto server collection during sync', () => {
    const updated = applyCollectionHistoryOverlays(
      {
        id: 501,
        farmerId: 99,
        chillingCenterId: 1,
        date: '2026-05-24',
        time: '10:00',
        temperature: 4,
        quantity: 50,
        createdAt: '2026-05-24T10:00:00Z',
      },
      [pendingQuality],
      [],
      { collections: { 'col-action-uuid': 501 } }
    );

    expect(updated.qualityResult).toBe('Pass');
  });
});
