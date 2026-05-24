import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getQualityEligibleCollections,
  getDispatchEligibleCollections,
  mergeQualityEligibleCollections,
  hasCachedFarmers,
} from './offlinePreload';
import type { MilkCollection } from '@/types';

describe('offlinePreload helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
  });

  it('filters quality eligible collections', () => {
    const cols = [
      { id: 1, qualityResult: undefined },
      { id: 2, qualityResult: 'Pass' },
    ] as MilkCollection[];
    expect(getQualityEligibleCollections(cols)).toHaveLength(1);
  });

  it('filters dispatch eligible collections', () => {
    const cols = [
      { id: 1, qualityResult: 'Pass', dispatchStatus: 'Pending' },
      { id: 2, qualityResult: 'Fail', dispatchStatus: 'Pending' },
      { id: 3, qualityResult: 'Pass', dispatchStatus: 'Dispatched' },
    ] as MilkCollection[];
    expect(getDispatchEligibleCollections(cols)).toHaveLength(1);
    expect(getDispatchEligibleCollections(cols)[0].id).toBe(1);
  });

  it('includes pending offline collections for quality testing', () => {
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
            time: '10:00',
            quantity: 50,
            milkType: 'Cow',
          },
        },
      ])
    );

    const merged = mergeQualityEligibleCollections([]);
    expect(merged).toHaveLength(1);
    expect(merged[0].farmerName).toBe('Tharun Perera');
  });

  it('detects empty farmer cache', () => {
    expect(hasCachedFarmers()).toBe(false);
    localStorage.setItem('cache_farmers', JSON.stringify([{ id: 1, name: 'Tony' }]));
    expect(hasCachedFarmers()).toBe(true);
  });
});
