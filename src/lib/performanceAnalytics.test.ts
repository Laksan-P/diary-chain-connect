import { describe, expect, it } from 'vitest';
import {
  formatPassRate,
  formatTrendPassRate,
  formatVolumeLiters,
  getQualityTone,
  hasEnoughTrendMonths,
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
});
