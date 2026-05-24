import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateMonthlySupply,
  aggregateWeeklySupply,
  buildSupplyPredictionResponse,
  calculateForecastConfidence,
  calculateSupplyWarning,
  calculateWeightedMovingAverage,
  forecastNextWeek,
  isValidSupplyCollection,
} from './supplyPrediction.js';

describe('supplyPrediction', () => {
  it('excludes failed and rejected collections from valid supply', () => {
    assert.equal(isValidSupplyCollection({ date: '2026-03-01', quantity: 100, quality_result: 'Fail' }), false);
    assert.equal(isValidSupplyCollection({ date: '2026-03-01', quantity: 100, dispatch_status: 'Rejected' }), false);
    assert.equal(isValidSupplyCollection({ date: '2026-03-01', quantity: 100, quality_result: 'Pass' }), true);
  });

  it('aggregates monthly totals from valid collections', () => {
    const monthly = aggregateMonthlySupply([
      { id: 1, date: '2026-01-05', quantity: 1000 },
      { id: 2, date: '2026-01-12', quantity: 2000 },
      { id: 3, date: '2026-02-03', quantity: 1500 },
    ]);
    assert.deepEqual(monthly, [
      { period: '2026-01', totalLiters: 3000 },
      { period: '2026-02', totalLiters: 1500 },
    ]);
  });

  it('uses WMA without padding missing weeks with zero', () => {
    const weekly = aggregateWeeklySupply([
      { id: 1, date: '2026-03-03', quantity: 10000 },
      { id: 2, date: '2026-03-10', quantity: 12000 },
      { id: 3, date: '2026-03-17', quantity: 14000 },
    ]);
    const nextWeek = forecastNextWeek(weekly);
    assert.ok(nextWeek);
    assert.ok(nextWeek.predictedLiters > 0);
  });

  it('returns not enough data response without fake zero forecast', () => {
    const response = buildSupplyPredictionResponse([
      { id: 1, date: '2026-03-01', quantity: 5000 },
    ]);
    assert.equal(response.summary.confidence, 'Not Available');
    assert.equal(response.forecast.nextWeek, null);
    assert.equal(response.forecast.monthly.length, 0);
    assert.equal(response.warning, null);
    assert.equal(response.alerts.length, 0);
    assert.match(response.message, /At least 3 months/);
  });

  it('forecasts monthly supply with confidence tiers', () => {
    const collections = [];
    for (let month = 1; month <= 6; month += 1) {
      collections.push({
        id: month,
        date: `2025-${String(month).padStart(2, '0')}-15`,
        quantity: 50000 + month * 1000,
      });
    }
    const response = buildSupplyPredictionResponse(collections);
    assert.equal(response.summary.confidence, 'Medium');
    assert.equal(response.forecast.monthly.length, 6);
    assert.ok(response.forecast.monthly[0].predictedLiters > 0);
  });

  it('does not warn when forecast is missing', () => {
    assert.equal(calculateSupplyWarning(null, 15000), null);
    assert.equal(calculateSupplyWarning(undefined, 15000), null);
  });

  it('warns only when real forecast is below threshold', () => {
    const warning = calculateSupplyWarning(5000, 15000);
    assert.equal(warning.status, 'Critical');
    assert.match(warning.message, /below recent average/);
  });

  it('calculates confidence from month count', () => {
    assert.equal(calculateForecastConfidence(12), 'High');
    assert.equal(calculateForecastConfidence(8), 'Medium');
    assert.equal(calculateForecastConfidence(4), 'Low');
    assert.equal(calculateForecastConfidence(2), 'Not Available');
  });

  it('weights recent values more heavily in WMA', () => {
    const wma = calculateWeightedMovingAverage([10000, 12000, 15000]);
    assert.ok(wma > 12000);
  });
});
