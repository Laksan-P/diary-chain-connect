import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dedupeFarmers,
  findDuplicatePendingAction,
  isDuplicateCollection,
  mergeFarmersWithPending,
  normalizeCollectionKey,
  normalizeFarmerKey,
  type PendingActionData,
} from './offlineSyncHelpers';

const farmerPending = (overrides: Partial<PendingActionData['data']> = {}): PendingActionData => ({
  id: 'action-1',
  type: 'farmer_registration',
  timestamp: Date.now(),
  data: {
    name: 'Tharun Perera',
    nic: '199012345678',
    phone: '0771234567',
    email: 'tharun@example.com',
    chillingCenterId: 1,
    tempId: 'OFF-1779613391441',
    farmerId: 'OFF-1779613391441',
    ...overrides,
  },
});

describe('normalizeFarmerKey', () => {
  it('uses server id when available', () => {
    expect(normalizeFarmerKey({ id: 28, farmerId: 'FRM-028', name: 'Tharun Perera' })).toBe('id:28');
  });

  it('uses temp id for offline farmers', () => {
    expect(normalizeFarmerKey({ id: 'OFF-123', farmerId: 'OFF-123', name: 'Tharun Perera' })).toBe('temp:OFF-123');
  });

  it('falls back to NIC', () => {
    expect(normalizeFarmerKey({ name: 'Tharun Perera', nic: '199012345678' })).toBe('nic:199012345678');
  });
});

describe('dedupeFarmers', () => {
  it('shows offline farmer only once when in cache and pending', () => {
    const cached = {
      id: 'OFF-1779613391441',
      farmerId: 'OFF-1779613391441',
      name: 'Tharun Perera',
      nic: '199012345678',
    };
    const pending = pendingRegistrationsToFarmersFromAction();

    const result = dedupeFarmers([cached, ...pending]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tharun Perera');
  });

  it('prefers server farmer over offline duplicate with same NIC', () => {
    const server = { id: 28, farmerId: 'FRM-028', name: 'Tharun Perera', nic: '199012345678' };
    const offline = { id: 'OFF-999', farmerId: 'OFF-999', name: 'Tharun Perera', nic: '199012345678', _pending: true };
    const result = dedupeFarmers([offline, server]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(28);
  });
});

function pendingRegistrationsToFarmersFromAction() {
  return [
    {
      id: 'OFF-1779613391441',
      farmerId: 'OFF-1779613391441',
      tempId: 'OFF-1779613391441',
      name: 'Tharun Perera',
      nic: '199012345678',
      phone: '0771234567',
      _pending: true,
    },
  ];
}

describe('mergeFarmersWithPending', () => {
  it('merges server farmers with unsynced pending only once', () => {
    const server = [{ id: 1, farmerId: 'FRM-001', name: 'Tony', nic: '111' }];
    const pending = [farmerPending()];
    const merged = mergeFarmersWithPending(server, pending);
    expect(merged).toHaveLength(2);
  });

  it('does not double-count duplicate offline sources', () => {
    const cachedWithOffline = [
      { id: 'OFF-1779613391441', farmerId: 'OFF-1779613391441', name: 'Tharun Perera', nic: '199012345678' },
    ];
    const pending = [farmerPending()];
    const merged = mergeFarmersWithPending(cachedWithOffline, pending);
    expect(merged).toHaveLength(1);
  });
});

describe('findDuplicatePendingAction', () => {
  const actions: PendingActionData[] = [
    farmerPending(),
    {
      id: 'col-1',
      type: 'collection',
      timestamp: Date.now(),
      data: {
        farmerId: 'OFF-1779613391441',
        chillingCenterId: 1,
        date: '2026-05-24',
        time: '14:33',
        quantity: 120.5,
        milkType: 'Cow',
      },
    },
  ];

  it('detects duplicate farmer registration by NIC', () => {
    const dup = findDuplicatePendingAction(actions, 'farmer_registration', {
      name: 'Other Name',
      nic: '199012345678',
      chillingCenterId: 1,
    });
    expect(dup?.id).toBe('action-1');
  });

  it('detects duplicate collection by farmer/date/time/quantity', () => {
    const dup = findDuplicatePendingAction(actions, 'collection', {
      farmerId: 'OFF-1779613391441',
      chillingCenterId: 1,
      date: '2026-05-24',
      time: '14:33',
      quantity: 120.5,
      milkType: 'Cow',
    });
    expect(dup?.id).toBe('col-1');
  });
});

describe('isDuplicateCollection', () => {
  it('detects duplicate in pending actions', () => {
    const actions: PendingActionData[] = [
      {
        id: 'col-1',
        type: 'collection',
        timestamp: Date.now(),
        data: {
          farmerId: 5,
          chillingCenterId: 1,
          date: '2026-05-24',
          time: '14:33',
          quantity: 50,
          milkType: 'Cow',
        },
      },
    ];
    expect(
      isDuplicateCollection(
        { farmerId: 5, chillingCenterId: 1, date: '2026-05-24', time: '14:33', quantity: 50, milkType: 'Cow' },
        actions,
        []
      )
    ).toBe(true);
  });

  it('detects duplicate in cached collections', () => {
    const cached = [
      { farmerId: 5, chillingCenterId: 1, date: '2026-05-24', time: '14:33', quantity: 50, milkType: 'Cow' },
    ];
    expect(
      isDuplicateCollection(
        { farmerId: 5, chillingCenterId: 1, date: '2026-05-24', time: '14:33', quantity: 50, milkType: 'Cow' },
        [],
        cached
      )
    ).toBe(true);
  });

  it('allows different time for same farmer', () => {
    expect(
      normalizeCollectionKey({
        farmerId: 5,
        chillingCenterId: 1,
        date: '2026-05-24',
        time: '15:00',
        quantity: 50,
        milkType: 'Cow',
      })
    ).not.toBe(
      normalizeCollectionKey({
        farmerId: 5,
        chillingCenterId: 1,
        date: '2026-05-24',
        time: '14:33',
        quantity: 50,
        milkType: 'Cow',
      })
    );
  });
});

describe('offlineSync storage integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
  });

  it('returns existing pending farmer id instead of creating duplicate', async () => {
    const { savePendingAction, getPendingActions } = await import('./offlineSync');
    const data = {
      name: 'Tharun Perera',
      nic: '199012345678',
      phone: '0771234567',
      email: 'tharun@example.com',
      chillingCenterId: 1,
      tempId: 'OFF-100',
      farmerId: 'OFF-100',
    };
    const firstId = savePendingAction('farmer_registration', data);
    const secondId = savePendingAction('farmer_registration', data);
    expect(secondId).toBe(firstId);
    expect(getPendingActions()).toHaveLength(1);
  });

  it('prevents duplicate offline collection pending actions', async () => {
    const { savePendingAction, getPendingActions } = await import('./offlineSync');
    const data = {
      farmerId: 'OFF-1',
      chillingCenterId: 1,
      date: '2026-05-24',
      time: '09:00',
      temperature: 4,
      quantity: 25,
      milkType: 'Cow',
    };
    const a = savePendingAction('collection', data);
    const b = savePendingAction('collection', data);
    expect(a).toBe(b);
    expect(getPendingActions()).toHaveLength(1);
  });

  it('survives refresh — pending farmer still deduped in merge list', async () => {
    const { savePendingAction, mergeFarmersWithPending } = await import('./offlineSync');
    savePendingAction('farmer_registration', {
      name: 'Tharun Perera',
      nic: '199012345678',
      chillingCenterId: 1,
      tempId: 'OFF-REFRESH',
      farmerId: 'OFF-REFRESH',
    });
    const afterRefresh = mergeFarmersWithPending([]);
    expect(afterRefresh).toHaveLength(1);
    expect(afterRefresh[0].name).toBe('Tharun Perera');
  });

  it('dedupes dashboard farmer count via mergeFarmersWithPending', async () => {
    const { savePendingAction, mergeFarmersWithPending } = await import('./offlineSync');
    savePendingAction('farmer_registration', {
      name: 'Tharun Perera',
      nic: '199012345678',
      chillingCenterId: 1,
      tempId: 'OFF-200',
      farmerId: 'OFF-200',
    });
    const serverFarmers = [{ id: 1, farmerId: 'FRM-001', name: 'Tony' }];
    expect(mergeFarmersWithPending(serverFarmers)).toHaveLength(2);
    expect(
      mergeFarmersWithPending([
        ...serverFarmers,
        { id: 'OFF-200', farmerId: 'OFF-200', name: 'Tharun Perera', nic: '199012345678' },
      ])
    ).toHaveLength(2);
  });
});

describe('syncActions ordering and failure handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
  });

  it('syncs farmer before collection and removes only successful actions', async () => {
    const registerFarmerByCenter = vi.fn().mockResolvedValue({ id: 99, farmerId: 'FRM-099' });
    const createCollection = vi.fn().mockResolvedValue({ id: 501 });
    const submitQualityTest = vi.fn();
    const createDispatch = vi.fn();

    vi.doMock('./api', () => ({
      registerFarmerByCenter,
      createCollection,
      submitQualityTest,
      createDispatch,
    }));

    const { savePendingAction, syncActions, getPendingActions } = await import('./offlineSync');

    savePendingAction('collection', {
      farmerId: 'OFF-FARM',
      chillingCenterId: 1,
      date: '2026-05-24',
      time: '10:00',
      temperature: 4,
      quantity: 10,
      milkType: 'Cow',
    });
    savePendingAction('farmer_registration', {
      name: 'Tharun Perera',
      chillingCenterId: 1,
      tempId: 'OFF-FARM',
      farmerId: 'OFF-FARM',
      nic: '199012345678',
    });

    await syncActions();

    expect(registerFarmerByCenter).toHaveBeenCalledTimes(1);
    expect(createCollection).toHaveBeenCalledTimes(1);
    expect(registerFarmerByCenter.mock.invocationCallOrder[0]).toBeLessThan(
      createCollection.mock.invocationCallOrder[0]
    );
    expect(createCollection).toHaveBeenCalledWith(
      expect.objectContaining({ farmerId: expect.anything() })
    );
    expect(Number(createCollection.mock.calls[0][0].farmerId)).toBe(99);
    expect(getPendingActions()).toHaveLength(0);
  });

  it('keeps failed actions pending with error status', async () => {
    vi.doMock('./api', () => ({
      registerFarmerByCenter: vi.fn().mockRejectedValue(new Error('Network error')),
      createCollection: vi.fn(),
      submitQualityTest: vi.fn(),
      createDispatch: vi.fn(),
    }));

    const { savePendingAction, syncActions, getPendingActions } = await import('./offlineSync');

    savePendingAction('farmer_registration', {
      name: 'Fail Farmer',
      chillingCenterId: 1,
      tempId: 'OFF-FAIL',
      farmerId: 'OFF-FAIL',
    });

    await syncActions();

    const remaining = getPendingActions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].syncStatus).toBe('failed');
    expect(remaining[0].errorMessage).toContain('Network error');
  });
});
