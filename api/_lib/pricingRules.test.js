import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCollectionPayment,
  calculateCollectionsPayment,
  resolvePricingRuleForDate,
} from './pricingRules.js';

const rules = [
  {
    id: 1,
    effective_from: '2026-01-01',
    base_price_per_liter: 80,
    fat_bonus: 5,
    snf_bonus: 3,
    is_active: false,
  },
  {
    id: 2,
    effective_from: '2026-03-01',
    base_price_per_liter: 90,
    fat_bonus: 6,
    snf_bonus: 4,
    is_active: true,
  },
];

describe('pricingRules', () => {
  it('uses the rule effective on the collection date, not the current active rule', () => {
    const febRule = resolvePricingRuleForDate(rules, '2026-02-15');
    const marRule = resolvePricingRuleForDate(rules, '2026-03-10');

    assert.equal(febRule.id, 1);
    assert.equal(marRule.id, 2);
  });

  it('calculates payment per collection with its own rule', () => {
    const collections = [
      { id: 1, date: '2026-02-10', quantity: 10, fat: 4.0, snf: 8.8 },
      { id: 2, date: '2026-03-10', quantity: 10, fat: 4.0, snf: 8.8 },
    ];

    const payment = calculateCollectionsPayment(collections, rules);

    const febAmount = calculateCollectionPayment(collections[0], rules[0]);
    const marAmount = calculateCollectionPayment(collections[1], rules[1]);

    assert.equal(payment.totalPayment, febAmount + marAmount);
    assert.notEqual(febAmount, marAmount);
  });

  it('returns null when collection predates all pricing rules', () => {
    assert.equal(resolvePricingRuleForDate(rules, '2025-12-01'), null);
  });
});
