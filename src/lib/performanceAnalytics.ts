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
