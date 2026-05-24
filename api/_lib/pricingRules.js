/** Resolve pricing rules by collection date (effective_from), not just current is_active flag. */

export function normalizeRuleDate(value) {
  if (!value) return '';
  return String(value).substring(0, 10);
}

/**
 * Pick the rule in effect on collectionDate:
 * latest rule where effective_from <= collectionDate.
 */
export function resolvePricingRuleForDate(rules = [], collectionDate) {
  const target = normalizeRuleDate(collectionDate);
  if (!target || !rules.length) return null;

  const applicable = rules.filter(rule => {
    const effective = normalizeRuleDate(rule.effective_from ?? rule.effectiveFrom);
    return effective && effective <= target;
  });

  if (!applicable.length) return null;

  applicable.sort((a, b) => {
    const aDate = normalizeRuleDate(a.effective_from ?? a.effectiveFrom);
    const bDate = normalizeRuleDate(b.effective_from ?? b.effectiveFrom);
    return bDate.localeCompare(aDate);
  });

  return applicable[0];
}

export function calculateCollectionPayment(collection, rule) {
  if (!rule || !collection) return 0;

  const basePrice = parseFloat(rule.base_price_per_liter ?? rule.basePricePerLiter ?? 0);
  const fatRate = parseFloat(rule.fat_bonus ?? rule.fatBonus ?? 0);
  const snfRate = parseFloat(rule.snf_bonus ?? rule.snfBonus ?? 0);
  const fat = parseFloat(collection.fat ?? 0);
  const snf = parseFloat(collection.snf ?? 0);
  const quantity = parseFloat(collection.quantity ?? 0);

  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  const fBonus = Math.max(0, (fat - 3.5) * fatRate);
  const sBonus = Math.max(0, (snf - 8.5) * snfRate);
  const finalRate = basePrice + fBonus + sBonus;

  return quantity * finalRate;
}

export function calculateCollectionsPayment(collections = [], rules = []) {
  let totalPayment = 0;
  let totalQty = 0;
  const breakdown = [];

  for (const collection of collections) {
    const rule = resolvePricingRuleForDate(rules, collection.date);
    const amount = calculateCollectionPayment(collection, rule);
    const quantity = parseFloat(collection.quantity ?? 0);

    totalPayment += amount;
    totalQty += quantity;
    breakdown.push({
      collectionId: collection.id,
      date: collection.date,
      ruleId: rule?.id ?? null,
      amount,
    });
  }

  const unitPrice = totalQty > 0 ? totalPayment / totalQty : 0;

  return {
    totalPayment,
    totalQty,
    unitPrice,
    breakdown,
  };
}
