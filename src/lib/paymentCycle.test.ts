import { describe, it, expect } from 'vitest';
import {
  getCyclePayoutDate,
  getCyclePeriod,
  isInCyclePeriod,
  resolveActivePaymentCycle,
  normalizeDate,
} from '@/lib/paymentCycle';

describe('paymentCycle', () => {
  it('assigns 1st-15th collections to the 16th payout date', () => {
    const payout = getCyclePayoutDate('2026-05-10');
    expect(payout.getDate()).toBe(16);
    expect(payout.getMonth()).toBe(4);
  });

  it('assigns 16th-end collections to the next month 1st payout date', () => {
    const payout = getCyclePayoutDate('2026-05-20');
    expect(payout.getDate()).toBe(1);
    expect(payout.getMonth()).toBe(5);
  });

  it('includes only collections from the earliest unpaid cycle', () => {
    const unpaid = [
      { id: 1, date: '2026-05-05' },
      { id: 2, date: '2026-05-20' },
    ];

    const active = resolveActivePaymentCycle(unpaid, new Date('2026-05-24'));
    expect(active?.cycleCollections.map(c => c.id)).toEqual([1]);
  });

  it('advances to the next cycle after the first cycle is disbursed', () => {
    const unpaid = [{ id: 2, date: '2026-05-20' }];
    const active = resolveActivePaymentCycle(unpaid, new Date('2026-05-24'));

    expect(active?.cycleCollections.map(c => c.id)).toEqual([2]);
    expect(active?.cycleReached).toBe(false);
    expect(active?.daysUntilCycle).toBeGreaterThan(0);
  });

  it('marks past payout dates as cycle reached', () => {
    const unpaid = [{ id: 3, date: '2026-05-08' }];
    const active = resolveActivePaymentCycle(unpaid, new Date('2026-05-24'));

    expect(active?.cycleReached).toBe(true);
    expect(isInCyclePeriod('2026-05-08', active!.period)).toBe(true);
    expect(normalizeDate('2026-05-15') < active!.period.end).toBe(true);
  });
});
