import { describe, expect, it } from 'vitest';
import {
  formatPassRate,
  formatTrendPassRate,
  formatVolumeLiters,
  getFarmerAttentionReasons,
  getLatestQualityStatus,
  getQualityTone,
  hasEnoughTrendMonths,
  hasRepeatedQualityFailures,
  isDecliningVolumeTrend,
  PASS_RATE_THRESHOLD,
} from './performanceAnalytics';

describe('performanceAnalytics', () => {
  it('uses 70% as the quality pass threshold', () => {
    expect(PASS_RATE_THRESHOLD).toBe(70);
  });

  it('marks pass rate at or above 70% as success', () => {
    expect(getQualityTone(70, 10)).toBe('success');
    expect(getQualityTone(70.6, 10)).toBe('success');
    expect(getQualityTone(69.9, 10)).toBe('warning');
  });

  it('uses neutral tone when no inspected data exists', () => {
    expect(getQualityTone(null, 0)).toBe('neutral');
    expect(getQualityTone(100, 0)).toBe('neutral');
  });

  it('formats pass rates without long decimals', () => {
    expect(formatPassRate(71.42857142857143)).toBe('71.4%');
    expect(formatTrendPassRate(71)).toBe('71%');
    expect(formatTrendPassRate(80)).toBe('80%');
    expect(formatPassRate(null)).toBe('No Data');
  });

  it('formats volume liters cleanly', () => {
    expect(formatVolumeLiters(150)).toBe('150 L');
    expect(formatVolumeLiters(123.456)).toBe('123.5 L');
  });

  it('requires at least two months for trend history', () => {
    expect(hasEnoughTrendMonths([])).toBe(false);
    expect(hasEnoughTrendMonths([{ month: '2025-03' }])).toBe(false);
    expect(hasEnoughTrendMonths([{ month: '2025-03' }, { month: '2025-04' }])).toBe(true);
  });

  it('detects declining volume when last month drops below 85% of previous', () => {
    expect(
      isDecliningVolumeTrend([
        { month: '2025-01', volume: 400 },
        { month: '2025-02', volume: 320 },
      ]),
    ).toBe(true);
    expect(
      isDecliningVolumeTrend([
        { month: '2025-01', volume: 400 },
        { month: '2025-02', volume: 380 },
      ]),
    ).toBe(false);
  });

  it('flags repeated quality failures in active streak', () => {
    const cols = [
      { qualityResult: 'Fail', date: '2025-03-03', time: '10:00:00' },
      { qualityResult: 'Fail', date: '2025-03-02', time: '10:00:00' },
      { qualityResult: 'Fail', date: '2025-03-01', time: '10:00:00' },
    ];
    expect(hasRepeatedQualityFailures(cols)).toBe(true);
  });

  it('resolves latest quality status from collections', () => {
    expect(
      getLatestQualityStatus([
        { qualityResult: 'Pass', date: '2025-03-05', time: '08:00:00' },
        { qualityResult: 'Fail', date: '2025-03-01', time: '08:00:00' },
      ]),
    ).toBe('Pass');
  });

  it('builds attention reasons from pass rate, volume, and failures', () => {
    const reasons = getFarmerAttentionReasons(
      {
        passRateDisplay: 55,
        inspectedCount: 10,
        trends: [
          { month: '2025-01', volume: 400 },
          { month: '2025-02', volume: 300 },
        ],
      },
      [{ qualityResult: 'Fail', date: '2025-03-01' }],
    );
    expect(reasons).toContain('low_pass_rate');
    expect(reasons).toContain('declining_volume');
  });
});
