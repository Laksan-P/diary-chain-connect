/** Real supply prediction from valid milk collection quantities. */

export const MIN_MONTHS_FOR_FORECAST = 3;
export const MIN_WEEKS_FOR_FORECAST = 3;

const EXCLUDED_QUALITY = ['Fail'];
const EXCLUDED_DISPATCH = ['Rejected'];

export function isValidSupplyCollection(col) {
  if (!col?.date) return false;
  const qty = parseFloat(col.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (col.quality_result && EXCLUDED_QUALITY.includes(col.quality_result)) return false;
  if (col.dispatch_status && EXCLUDED_DISPATCH.includes(col.dispatch_status)) return false;
  return true;
}

export function dedupeCollections(collections = []) {
  const seen = new Set();
  return collections.filter(col => {
    const key = col.id ?? `${col.date}|${col.farmer_id}|${col.quantity}|${col.chilling_center_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getWeekPeriod(dateInput) {
  const d = new Date(dateInput);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getNextWeekPeriod(period) {
  const [yearStr, weekStr] = period.split('-W');
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10) + 1;
  if (week > 52) {
    week = 1;
    year += 1;
  }
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function addMonths(period, delta) {
  const [yearStr, monthStr] = period.split('-');
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function aggregateWeeklySupply(collections = []) {
  const totals = {};
  for (const col of collections) {
    const period = getWeekPeriod(col.date);
    totals[period] = (totals[period] || 0) + parseFloat(col.quantity);
  }
  return Object.keys(totals)
    .sort()
    .map(period => ({
      period,
      totalLiters: roundLiters(totals[period]),
    }));
}

export function aggregateMonthlySupply(collections = []) {
  const totals = {};
  for (const col of collections) {
    const period = col.date.substring(0, 7);
    totals[period] = (totals[period] || 0) + parseFloat(col.quantity);
  }
  return Object.keys(totals)
    .sort()
    .map(period => ({
      period,
      totalLiters: roundLiters(totals[period]),
    }));
}

export function roundLiters(value) {
  return Math.round(Number(value) || 0);
}

export function calculateWeightedMovingAverage(values = [], weights) {
  if (!values.length) return null;
  const w =
    weights && weights.length === values.length
      ? weights
      : values.map((_, index) => index + 1);
  const weightSum = w.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return null;
  const weightedSum = values.reduce((sum, value, index) => sum + value * w[index], 0);
  return weightedSum / weightSum;
}

export function calculateForecastConfidence(monthCount) {
  if (monthCount >= 12) return 'High';
  if (monthCount >= 6) return 'Medium';
  if (monthCount >= MIN_MONTHS_FOR_FORECAST) return 'Low';
  return 'Not Available';
}

export function averageRecent(values = [], count = 12) {
  if (!values.length) return null;
  const slice = values.slice(-count);
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function seasonalMonthForecast(monthlyHistory, stepIndex) {
  const values = monthlyHistory.map(entry => entry.totalLiters);
  const recentWma = calculateWeightedMovingAverage(values.slice(-12));
  if (recentWma == null) return null;

  const lastPeriod = monthlyHistory[monthlyHistory.length - 1].period;
  const targetPeriod = addMonths(lastPeriod, stepIndex + 1);
  const sameMonthLastYear = monthlyHistory.find(
    entry => entry.period === addMonths(targetPeriod, -12)
  )?.totalLiters;

  if (sameMonthLastYear != null) {
    return recentWma * 0.6 + sameMonthLastYear * 0.4;
  }
  return recentWma;
}

function wmaMonthForecast(monthlyHistory, stepIndex) {
  const values = monthlyHistory.map(entry => entry.totalLiters);
  const recent = values.slice(-Math.min(12, values.length));
  const base = calculateWeightedMovingAverage(recent);
  if (base == null) return null;

  if (recent.length >= 2) {
    const trend = recent[recent.length - 1] - recent[recent.length - 2];
    return base + trend * (stepIndex + 1);
  }
  return base;
}

export function forecastMonthlySupply(monthlyHistory = []) {
  const monthCount = monthlyHistory.length;
  const confidence = calculateForecastConfidence(monthCount);

  if (monthCount < MIN_MONTHS_FOR_FORECAST) {
    return { forecasts: [], confidence, forecastHorizon: 'Not available' };
  }

  let forecastCount = 3;
  let forecastHorizon = '3 months';
  if (monthCount >= 12) {
    forecastCount = 12;
    forecastHorizon = '12 months';
  } else if (monthCount >= 6) {
    forecastCount = 6;
    forecastHorizon = '6 months';
  }

  const forecasts = [];
  const lastPeriod = monthlyHistory[monthlyHistory.length - 1].period;

  for (let i = 0; i < forecastCount; i++) {
    const raw =
      monthCount >= 12
        ? seasonalMonthForecast(monthlyHistory, i)
        : wmaMonthForecast(monthlyHistory, i);
    if (raw == null) break;

    forecasts.push({
      period: addMonths(lastPeriod, i + 1),
      predictedLiters: roundLiters(Math.max(0, raw)),
      confidence,
    });
  }

  return { forecasts, confidence, forecastHorizon };
}

export function forecastWeeklySupply(weeklyHistory = [], count = 4) {
  if (weeklyHistory.length < MIN_WEEKS_FOR_FORECAST) {
    return [];
  }

  const forecasts = [];
  const working = [...weeklyHistory];
  let currentPeriod = weeklyHistory[weeklyHistory.length - 1].period;
  const confidence =
    weeklyHistory.length >= 12 ? 'High' : weeklyHistory.length >= 6 ? 'Medium' : 'Low';

  for (let i = 0; i < count; i++) {
    currentPeriod = getNextWeekPeriod(currentPeriod);
    const values = working.slice(-12).map(entry => entry.totalLiters);
    const predicted = calculateWeightedMovingAverage(values);
    if (predicted == null) break;

    const predictedLiters = roundLiters(Math.max(0, predicted));
    forecasts.push({ period: currentPeriod, predictedLiters, confidence });
    working.push({ period: currentPeriod, totalLiters: predictedLiters });
  }

  return forecasts;
}

export function forecastNextWeek(weeklyHistory = []) {
  const weeklyForecasts = forecastWeeklySupply(weeklyHistory, 1);
  if (!weeklyForecasts.length) return null;
  return weeklyForecasts[0];
}

export function calculateSupplyWarning(predictedLiters, historicalAverage) {
  if (predictedLiters == null || historicalAverage == null || historicalAverage <= 0) {
    return null;
  }

  const ratio = predictedLiters / historicalAverage;
  const pctBelow = Math.round((1 - ratio) * 100);

  if (ratio < 0.7) {
    return {
      level: 'Critical',
      type: 'Red',
      status: 'Critical',
      message: `Critical Warning: Predicted supply (${predictedLiters.toLocaleString()}L) is dangerously low. Forecast is ${pctBelow}% below recent average. Expected minimum is ${Math.round(historicalAverage * 0.7).toLocaleString()}L.`,
    };
  }

  if (ratio < 0.9) {
    return {
      level: 'Warning',
      type: 'Amber',
      status: 'Warning',
      message: `Supply Warning: Forecast is ${pctBelow}% below recent average (${Math.round(historicalAverage).toLocaleString()}L).`,
    };
  }

  return { status: 'Normal' };
}

export function buildCenterPredictions(collections = [], forecastWeekCount = 4) {
  const byCenter = {};

  for (const col of collections) {
    const centerId = col.chilling_center_id;
    if (!centerId) continue;
    if (!byCenter[centerId]) {
      byCenter[centerId] = {
        centerId: String(centerId),
        name: col.chilling_centers?.name || `Center ${centerId}`,
        collections: [],
      };
    }
    byCenter[centerId].collections.push(col);
  }

  return Object.values(byCenter).map(center => {
    const weekly = aggregateWeeklySupply(center.collections);
    const forecasts = forecastWeeklySupply(weekly, forecastWeekCount);
    return {
      centerId: center.centerId,
      name: center.name,
      predictions: forecasts.map(entry => ({
        week: entry.period,
        value: entry.predictedLiters,
        confidence: entry.confidence,
      })),
    };
  });
}

export function buildSupplyPredictionResponse(rawCollections = []) {
  const collections = dedupeCollections(rawCollections.filter(isValidSupplyCollection));
  const weeklyHistory = aggregateWeeklySupply(collections);
  const monthlyHistory = aggregateMonthlySupply(collections);
  const monthCount = monthlyHistory.length;

  const currentWeeklyAverage = weeklyHistory.length
    ? roundLiters(averageRecent(weeklyHistory.map(entry => entry.totalLiters), 12) ?? 0)
    : null;

  const sharedFields = {
    history: {
      weekly: weeklyHistory,
      monthly: monthlyHistory,
    },
    actualData: weeklyHistory.slice(-12).map(entry => ({
      week: entry.period,
      value: entry.totalLiters,
    })),
    centerPredictions: buildCenterPredictions(collections),
  };

  if (monthCount < MIN_MONTHS_FOR_FORECAST) {
    const weeklyForecast = forecastWeeklySupply(weeklyHistory);
    const nextWeek = weeklyForecast[0] ?? null;

    return {
      ...sharedFields,
      forecast: {
        nextWeek: nextWeek
          ? {
              period: nextWeek.period,
              predictedLiters: nextWeek.predictedLiters,
              confidence: nextWeek.confidence,
            }
          : null,
        weekly: weeklyForecast,
        monthly: [],
      },
      summary: {
        currentWeeklyAverage,
        forecastHorizon: 'Not available',
        confidence: 'Not Available',
        status: 'Not Enough Data',
      },
      warning: null,
      message:
        'Not enough supply history for reliable prediction. At least 3 months of data are required.',
      forecastData: weeklyForecast.map(entry => ({
        week: entry.period,
        value: entry.predictedLiters,
        confidence: entry.confidence,
      })),
      alerts: [],
    };
  }

  const monthlyForecast = forecastMonthlySupply(monthlyHistory);
  const weeklyForecast = forecastWeeklySupply(weeklyHistory);
  const nextWeek = weeklyForecast[0] ?? null;
  const historicalAverage =
    averageRecent(monthlyHistory.map(entry => entry.totalLiters), 12) ??
    averageRecent(weeklyHistory.map(entry => entry.totalLiters), 12);

  const warning = nextWeek
    ? calculateSupplyWarning(nextWeek.predictedLiters, historicalAverage)
    : null;

  const summaryStatus =
    warning?.status === 'Critical' || warning?.status === 'Warning'
      ? warning.status
      : 'Normal';

  const alerts =
    warning && (warning.level === 'Critical' || warning.level === 'Warning')
      ? [{ level: warning.level, type: warning.type, message: warning.message }]
      : [];

  return {
    ...sharedFields,
    forecast: {
      nextWeek: nextWeek
        ? {
            period: nextWeek.period,
            predictedLiters: nextWeek.predictedLiters,
            confidence: nextWeek.confidence,
          }
        : null,
      weekly: weeklyForecast,
      monthly: monthlyForecast.forecasts,
    },
    summary: {
      currentWeeklyAverage,
      forecastHorizon: monthlyForecast.forecastHorizon,
      confidence: monthlyForecast.confidence,
      status: summaryStatus,
    },
    warning,
    message: null,
    forecastData: weeklyForecast.map(entry => ({
      week: entry.period,
      value: entry.predictedLiters,
      confidence: entry.confidence,
    })),
    alerts,
  };
}
