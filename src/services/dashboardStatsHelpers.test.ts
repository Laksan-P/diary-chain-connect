import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildDashboardStats, calculateQualityPassRate } from './dashboardStatsHelpers';
import type { MilkCollection } from '@/types';

describe('dashboardStatsHelpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
  });

  it('calculates quality pass rate from tested collections', () => {
    const cols = [
      { qualityResult: 'Pass' },
      { qualityResult: 'Pass' },
      { qualityResult: 'Fail' },
      { qualityResult: undefined },
    ] as MilkCollection[];

    expect(calculateQualityPassRate(cols)).toBe(67);
  });

  it('builds dashboard stats from cached collections and pending actions', () => {
    localStorage.setItem('cache_farmers', JSON.stringify([{ id: 1, farmerId: 'FRM-001', name: 'Tony' }]));
    localStorage.setItem(
      'cache_collection_history',
      JSON.stringify([
        {
          id: 10,
          farmerId: 1,
          farmerCode: 'FRM-001',
          farmerName: 'Tony',
          date: '2026-05-24',
          time: '09:00',
          quantity: 100,
          qualityResult: 'Pass',
          dispatchStatus: 'Pending',
          createdAt: '2026-05-24T09:00:00Z',
        },
      ])
    );
    localStorage.setItem(
      'pending_actions',
      JSON.stringify([
        {
          id: 'offline-col-1',
          type: 'collection',
          timestamp: Date.now(),
          data: {
            farmerId: 'OFF-1',
            farmerName: 'Tharun Perera',
            date: '2026-05-24',
            time: '11:00',
            quantity: 50,
            milkType: 'Cow',
          },
        },
        {
          id: 'quality-1',
          type: 'quality',
          timestamp: Date.now(),
          data: {
            offlineCollectionId: 'offline-col-1',
            collectionId: 0,
            result: 'Pass',
          },
        },
      ])
    );

    const stats = buildDashboardStats();
    expect(stats.farmerCount).toBe(1);
    expect(stats.totalQuantity).toBe(150);
    expect(stats.recentCollections.length).toBeGreaterThan(0);
    expect(stats.qualityPassRate).toBeGreaterThan(0);
  });

  it('includes pending dispatch count from cache and pending actions', () => {
    localStorage.setItem(
      'cache_dispatch_history',
      JSON.stringify([{ id: 1, transporterName: 'A', vehicleNumber: 'WP-1', dispatchDate: '2026-05-24', status: 'Dispatched', items: [], createdAt: '2026-05-24' }])
    );
    localStorage.setItem(
      'pending_actions',
      JSON.stringify([
        {
          id: 'dispatch-pending',
          type: 'dispatch',
          timestamp: Date.now(),
          data: {
            chillingCenterId: 1,
            vehicleNumber: 'WP-2',
            transporterName: 'B',
            dispatchDate: '2026-05-24T12:00:00+05:30',
            items: [{ collectionId: 99, quantity: 20 }],
          },
        },
      ])
    );

    const stats = buildDashboardStats();
    expect(stats.dispatchCount).toBe(2);
  });
});
