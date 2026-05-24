import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFarmerPassRate,
  calculateFarmerMonthlyTrends,
  derivePerformanceStatus,
  generateRecommendations,
  PASS_RATE_THRESHOLD,
} from './performanceAnalytics.js';

describe('performanceAnalytics (api)', () => {
  it('calculates pass rate from Nestlé-inspected collections only', () => {
    const collections = [
      { dispatch_status: 'Approved', date: '2025-03-01', quantity: 10 },
      { dispatch_status: 'Rejected', date: '2025-03-02', quantity: 10 },
      { dispatch_status: 'Pending', date: '2025-03-03', quantity: 10 },
      { dispatch_status: 'Paid', date: '2025-03-04', quantity: 10 },
    ];
    const result = calculateFarmerPassRate(collections);
    assert.equal(result.inspectedCount, 3);
    assert.equal(result.passedCount, 2);
    assert.equal(result.passRate, 66.7);
  });

  it('treats 70% and above as good performance status', () => {
    const collections = [
      { dispatch_status: 'Approved', date: '2025-03-01', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-03-02', quantity: 10 },
      { dispatch_status: 'Rejected', date: '2025-03-03', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-01', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-02', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-03', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-04', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-05', quantity: 10 },
      { dispatch_status: 'Approved', date: '2025-04-06', quantity: 10 },
      { dispatch_status: 'Rejected', date: '2025-04-07', quantity: 10 },
    ];
    const { passRate, inspectedCount } = calculateFarmerPassRate(collections);
    const trends = calculateFarmerMonthlyTrends(collections);
    const status = derivePerformanceStatus(passRate, trends, inspectedCount, 'Regular');
    assert.ok(passRate >= PASS_RATE_THRESHOLD);
    assert.equal(status, 'Good');
  });

  it('returns not enough data when no inspections exist', () => {
    const collections = [{ dispatch_status: 'Pending', date: '2025-03-01', quantity: 5 }];
    const { passRate, inspectedCount } = calculateFarmerPassRate(collections);
    const trends = calculateFarmerMonthlyTrends(collections);
    const status = derivePerformanceStatus(passRate, trends, inspectedCount, 'New Farmer');
    assert.equal(passRate, null);
    assert.equal(status, 'Not Enough Data');
    assert.deepEqual(generateRecommendations({ passRate, frequency: 'New Farmer', trends, inspectedCount }), [
      'More collection history is needed before generating accurate recommendations.',
    ]);
  });

  it('formats monthly pass rates to one decimal', () => {
    const collections = [
      { dispatch_status: 'Approved', date: '2026-03-01', quantity: 10 },
      { dispatch_status: 'Approved', date: '2026-03-02', quantity: 10 },
      { dispatch_status: 'Rejected', date: '2026-03-03', quantity: 10 },
    ];
    const trends = calculateFarmerMonthlyTrends(collections);
    assert.equal(trends[0].passRate, 66.7);
  });
});
