export function normalizeDate(dateInput) {
  const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Payout date for the biweekly period containing this collection date. */
export function getCyclePayoutDate(dateInput) {
  const d = normalizeDate(dateInput);
  if (d.getDate() <= 15) {
    return normalizeDate(new Date(d.getFullYear(), d.getMonth(), 16));
  }
  return normalizeDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

/** Inclusive start, exclusive end, for a cycle identified by its payout date. */
export function getCyclePeriod(payoutDateInput) {
  const payout = normalizeDate(payoutDateInput);

  if (payout.getDate() === 16) {
    return {
      start: normalizeDate(new Date(payout.getFullYear(), payout.getMonth(), 1)),
      end: normalizeDate(new Date(payout.getFullYear(), payout.getMonth(), 16)),
      payoutDate: payout,
    };
  }

  return {
    start: normalizeDate(new Date(payout.getFullYear(), payout.getMonth() - 1, 16)),
    end: payout,
    payoutDate: payout,
  };
}

export function isInCyclePeriod(collectionDate, period) {
  const d = normalizeDate(collectionDate);
  return d >= period.start && d < period.end;
}

/**
 * Resolve the earliest unpaid biweekly cycle and the collections that belong to it.
 * Only one cycle is returned at a time so disbursement never spans multiple periods.
 */
export function resolveActivePaymentCycle(unpaidCollections, now = new Date()) {
  if (!unpaidCollections?.length) return null;

  const sorted = [...unpaidCollections].sort(
    (a, b) => normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime()
  );

  let period = getCyclePeriod(getCyclePayoutDate(sorted[0].date));
  let cycleCollections = sorted.filter(c => isInCyclePeriod(c.date, period));

  const today = normalizeDate(now);

  while (cycleCollections.length === 0 && today >= period.payoutDate) {
    period = getCyclePeriod(getCyclePayoutDate(period.end));
    cycleCollections = sorted.filter(c => isInCyclePeriod(c.date, period));
  }

  const daysUntilCycle = Math.max(
    0,
    Math.ceil((period.payoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    period,
    cycleCollections,
    daysUntilCycle,
    cycleReached: period.payoutDate <= today,
    cycleKey: `${period.start.toISOString().slice(0, 10)}_${period.end.toISOString().slice(0, 10)}`,
  };
}

/** Inclusive cycle dates for farmer-facing payment messages. */
export function getCycleDisplayRange(period) {
  const cycleStart = period.start.toISOString().slice(0, 10);
  const endInclusive = new Date(period.end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const cycleEnd = endInclusive.toISOString().slice(0, 10);
  return { cycleStart, cycleEnd };
}
