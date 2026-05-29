/** Client-side Nestlé performance display rules — mirrors api/_lib/performanceAnalytics.js */

export const PASS_RATE_THRESHOLD = 70;
export const MIN_MONTHS_FOR_TREND = 2;

export type QualityTone = 'success' | 'warning' | 'neutral';

export function formatPassRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'No Data';
  return `${Number(value.toFixed(1))}%`;
}

export function getQualityTone(passRate: number | null | undefined, inspectedCount = 0): QualityTone {
  if (inspectedCount === 0 || passRate == null) return 'neutral';
  if (passRate >= PASS_RATE_THRESHOLD) return 'success';
  return 'warning';
}

export function getQualityCardClasses(tone: QualityTone): { icon: string; bar: string } {
  switch (tone) {
    case 'success':
      return { icon: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500' };
    case 'warning':
      return { icon: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500' };
    default:
      return { icon: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' };
  }
}

export function getStatusCardClasses(status: string): string {
  switch (status) {
    case 'Good':
      return 'bg-emerald-100 text-emerald-600';
    case 'Stable':
    case 'Improving':
      return 'bg-blue-100 text-blue-600';
    case 'Not Enough Data':
    case 'New Farmer':
      return 'bg-slate-100 text-slate-500';
    case 'Inactive':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-amber-100 text-amber-600';
  }
}

export function getListBadgeClasses(status: string, type: 'farmer' | 'center' = 'farmer'): string {
  switch (status) {
    case 'Good':
      return 'bg-emerald-50 text-emerald-700';
    case 'Stable':
    case 'Improving':
      return 'bg-blue-50 text-blue-700';
    case 'Not Enough Data':
    case 'New Farmer':
      return 'bg-slate-50 text-slate-600';
    case 'Inactive':
      return type === 'center' ? 'bg-gray-50 text-gray-600' : 'bg-gray-50 text-gray-600';
    default:
      return type === 'center' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  }
}

export function hasEnoughTrendMonths(trends: { month: string }[] | undefined): boolean {
  return (trends?.length ?? 0) >= MIN_MONTHS_FOR_TREND;
}

export function formatTrendPassRate(value: number | null | undefined): string {
  if (value == null) return '';
  return `${Number(value.toFixed(1))}%`;
}

export function formatVolumeLiters(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0 L';
  return `${Number(value.toFixed(1))} L`;
}

export interface MonthlyTrendPoint {
  month: string;
  volume: number;
  passRate?: number | null;
  inspectedCount?: number;
}

/** Mirrors generateRecommendations volume decline rule (last month < 85% of previous). */
export function isDecliningVolumeTrend(trends: MonthlyTrendPoint[] | undefined): boolean {
  if (!trends || trends.length < 2) return false;
  const last = trends[trends.length - 1]?.volume ?? 0;
  const prev = trends[trends.length - 2]?.volume ?? 0;
  return prev > 0 && last < prev * 0.85;
}

export function getFailedCollectionCount(inspectedCount: number, passedCount: number): number {
  return Math.max(0, inspectedCount - passedCount);
}

export interface CollectionQualityRow {
  qualityResult?: string | null;
  date?: string;
  time?: string;
}

export function getLatestQualityStatus(collections: CollectionQualityRow[]): string {
  const sorted = [...collections].sort((a, b) => {
    const da = `${a.date ?? ''} ${a.time ?? '00:00:00'}`;
    const db = `${b.date ?? ''} ${b.time ?? '00:00:00'}`;
    return db.localeCompare(da);
  });
  for (const col of sorted) {
    const q = (col.qualityResult ?? '').toString().trim().toLowerCase();
    if (q === 'pass' || q === 'passed') return 'Pass';
    if (q === 'fail' || q === 'failed') return 'Fail';
  }
  return 'Not tested';
}

/** Active streak: 3+ quality failures since the most recent pass (newest first). */
export function hasRepeatedQualityFailures(collections: CollectionQualityRow[]): boolean {
  const sorted = [...collections].sort((a, b) => {
    const da = `${a.date ?? ''} ${a.time ?? '00:00:00'}`;
    const db = `${b.date ?? ''} ${b.time ?? '00:00:00'}`;
    return db.localeCompare(da);
  });
  let failCount = 0;
  for (const col of sorted) {
    const q = (col.qualityResult ?? '').toString().trim().toLowerCase();
    if (q === 'pass' || q === 'passed') break;
    if (q === 'fail' || q === 'failed') {
      failCount++;
      if (failCount >= 3) return true;
    }
  }
  return false;
}

export type AttentionReason = 'low_pass_rate' | 'declining_volume' | 'repeated_failures';

export function getFarmerAttentionReasons(
  perf: {
    passRateDisplay?: number | null;
    passRate?: number | null;
    inspectedCount?: number;
    trends?: MonthlyTrendPoint[];
  } | undefined,
  collections: CollectionQualityRow[],
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const passRate = perf?.passRateDisplay ?? perf?.passRate ?? null;
  const inspected = perf?.inspectedCount ?? 0;

  if (inspected > 0 && passRate != null && passRate < PASS_RATE_THRESHOLD) {
    reasons.push('low_pass_rate');
  }
  if (isDecliningVolumeTrend(perf?.trends)) {
    reasons.push('declining_volume');
  }
  if (hasRepeatedQualityFailures(collections)) {
    reasons.push('repeated_failures');
  }
  return reasons;
}

export function attentionReasonLabel(reason: AttentionReason): string {
  switch (reason) {
    case 'low_pass_rate':
      return 'Low pass rate';
    case 'declining_volume':
      return 'Declining volume';
    case 'repeated_failures':
      return 'Repeated failures';
  }
}

export function getAttentionSeverity(reasonCount: number): 'critical' | 'warning' | 'good' {
  if (reasonCount >= 2) return 'critical';
  if (reasonCount === 1) return 'warning';
  return 'good';
}
