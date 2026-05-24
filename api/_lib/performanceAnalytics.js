/** Shared Nestlé performance rules — 70% threshold everywhere. */

export const PASS_RATE_THRESHOLD = 70;
export const MIN_MONTHS_FOR_TREND = 2;

const NESTLE_INSPECTED_STATUSES = ['Approved', 'Rejected', 'Paid'];
const NESTLE_PASSED_STATUSES = ['Approved', 'Paid'];

export function isNestleInspected(col) {
  return NESTLE_INSPECTED_STATUSES.includes(col?.dispatch_status);
}

export function isNestlePassed(col) {
  return NESTLE_PASSED_STATUSES.includes(col?.dispatch_status);
}

export function calculateFarmerPassRate(collections = []) {
  const inspected = collections.filter(isNestleInspected);
  if (inspected.length === 0) {
    return { passRate: null, inspectedCount: 0, passedCount: 0 };
  }
  const passed = inspected.filter(isNestlePassed).length;
  const passRate = Number(((passed / inspected.length) * 100).toFixed(1));
  return { passRate, inspectedCount: inspected.length, passedCount: passed };
}

export function calculateCenterPassRate(dispatches = []) {
  const inspected = (dispatches || []).filter(
    d => d.status === 'Approved' || d.status === 'Rejected'
  );
  if (inspected.length === 0) {
    return { passRate: null, inspectedCount: 0, passedCount: 0, rejectionRate: null };
  }
  const rejected = inspected.filter(d => d.status === 'Rejected').length;
  const passed = inspected.length - rejected;
  const passRate = Number(((passed / inspected.length) * 100).toFixed(1));
  const rejectionRate = Number(((rejected / inspected.length) * 100).toFixed(1));
  return { passRate, inspectedCount: inspected.length, passedCount: passed, rejectionRate };
}

export function calculateSupplyFrequency(collections = [], inspectedCount = 0) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (!collections.length) {
    return { frequency: 'New Farmer', frequencySubtext: 'No supply history' };
  }

  const recent = collections.filter(c => c.date && new Date(c.date) >= thirtyDaysAgo);

  if (!recent.length) {
    return { frequency: 'Inactive', frequencySubtext: 'No supply in last 30 days' };
  }

  if (inspectedCount === 0 && collections.length < 5) {
    return { frequency: 'New Farmer', frequencySubtext: 'Not enough history for frequency analysis' };
  }

  const uniqueDays = new Set(recent.map(c => c.date.substring(0, 10))).size;

  if (uniqueDays >= 8 || recent.length >= 8) {
    return { frequency: 'Regular', frequencySubtext: 'Active supply patterns detected' };
  }

  if (recent.length >= 2) {
    return { frequency: 'Irregular', frequencySubtext: 'Inconsistent supply schedule in recent period' };
  }

  return { frequency: 'New Farmer', frequencySubtext: 'Limited supply history' };
}

export function calculateFarmerMonthlyTrends(collections = [], monthsBack = 6) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const cutoffStr = cutoff.toISOString().substring(0, 10);

  const trends = {};

  collections
    .filter(c => c.date && c.date >= cutoffStr)
    .forEach(c => {
      const month = c.date.substring(0, 7);
      if (!trends[month]) {
        trends[month] = { month, volume: 0, passCount: 0, inspectedCount: 0 };
      }
      trends[month].volume += parseFloat(c.quantity) || 0;
      if (isNestleInspected(c)) {
        trends[month].inspectedCount++;
        if (isNestlePassed(c)) trends[month].passCount++;
      }
    });

  return Object.keys(trends)
    .sort()
    .map(month => {
      const t = trends[month];
      return {
        month,
        volume: Number(t.volume.toFixed(2)),
        passRate:
          t.inspectedCount > 0
            ? Number(((t.passCount / t.inspectedCount) * 100).toFixed(1))
            : null,
        inspectedCount: t.inspectedCount,
      };
    });
}

export function calculateCenterMonthlyTrends(dispatches = [], monthsBack = 6) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const cutoffStr = cutoff.toISOString().substring(0, 10);

  const trends = {};

  (dispatches || [])
    .filter(d => d.dispatch_date && d.dispatch_date >= cutoffStr)
    .forEach(d => {
      const month = d.dispatch_date.substring(0, 7);
      if (!trends[month]) {
        trends[month] = { month, volume: 0, passCount: 0, inspectedCount: 0 };
      }

      if (d.status === 'Approved' || d.status === 'Rejected') {
        trends[month].inspectedCount++;
        if (d.status === 'Approved') trends[month].passCount++;
      }

      let vol = 0;
      if (Array.isArray(d.quantity)) {
        vol = d.quantity.reduce((sum, item) => {
          const mc = item.milk_collections;
          const q =
            mc && !Array.isArray(mc)
              ? mc.quantity
              : Array.isArray(mc)
                ? mc[0]?.quantity
                : 0;
          return sum + (parseFloat(q) || 0);
        }, 0);
      }
      trends[month].volume += vol;
    });

  return Object.keys(trends)
    .sort()
    .map(month => {
      const t = trends[month];
      return {
        month,
        volume: Number(t.volume.toFixed(2)),
        passRate:
          t.inspectedCount > 0
            ? Number(((t.passCount / t.inspectedCount) * 100).toFixed(1))
            : null,
        inspectedCount: t.inspectedCount,
      };
    });
}

export function derivePerformanceStatus(passRate, trends, inspectedCount, supplyFrequency) {
  if (inspectedCount === 0) {
    if (supplyFrequency === 'Inactive') return 'Inactive';
    return 'Not Enough Data';
  }

  if (passRate >= PASS_RATE_THRESHOLD) {
    const withRates = trends.filter(t => t.passRate != null);
    if (withRates.length >= 2) {
      const last = withRates[withRates.length - 1].passRate;
      const prev = withRates[withRates.length - 2].passRate;
      if (last - prev < -15) return 'Stable';
    }
    return 'Good';
  }

  const withRates = trends.filter(t => t.passRate != null);
  if (withRates.length >= 2) {
    const last = withRates[withRates.length - 1].passRate;
    const prev = withRates[withRates.length - 2].passRate;
    if (last > prev) return 'Improving';
  }

  return 'Needs Improvement';
}

export function listPerformanceStatus(passRate, inspectedCount, supplyFrequency) {
  if (inspectedCount === 0) {
    if (supplyFrequency === 'Inactive') return 'Inactive';
    return 'Not Enough Data';
  }
  if (passRate >= PASS_RATE_THRESHOLD) return 'Good';
  return 'Needs Improvement';
}

export function generateRecommendations({
  passRate,
  frequency,
  trends,
  inspectedCount,
}) {
  if (inspectedCount === 0) {
    return ['More collection history is needed before generating accurate recommendations.'];
  }

  const tips = [];

  if (passRate != null && passRate < PASS_RATE_THRESHOLD) {
    tips.push('Improve milk hygiene and reduce contamination risk.');
    tips.push('Check water mixing, fat/SNF levels, and storage temperature before handover.');
  }

  if (frequency === 'Irregular') {
    tips.push('Maintain a consistent supply schedule to improve reliability score.');
  }

  if (trends.length >= 2) {
    const lastVol = trends[trends.length - 1].volume;
    const prevVol = trends[trends.length - 2].volume;
    if (prevVol > 0 && lastVol < prevVol * 0.85) {
      tips.push('Review herd health, feeding schedule, and collection consistency.');
    }
  }

  if (passRate != null && passRate >= PASS_RATE_THRESHOLD && frequency === 'Regular') {
    return ['Performance is good. Continue maintaining quality and regular supply.'];
  }

  if (!tips.length) {
    if (passRate != null && passRate >= PASS_RATE_THRESHOLD) {
      return ['Performance is good. Continue maintaining quality and regular supply.'];
    }
    return ['Continue monitoring supply quality and consistency.'];
  }

  return tips;
}
