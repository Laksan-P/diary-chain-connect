export function normalizeDate(dateInput: string | Date): Date {
  const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getCyclePayoutDate(dateInput: string | Date): Date {
  const d = normalizeDate(dateInput);
  if (d.getDate() <= 15) {
    return normalizeDate(new Date(d.getFullYear(), d.getMonth(), 16));
  }
  return normalizeDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export function getCyclePeriod(payoutDateInput: string | Date) {
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

export function isInCyclePeriod(collectionDate: string | Date, period: { start: Date; end: Date }): boolean {
  const d = normalizeDate(collectionDate);
  return d >= period.start && d < period.end;
}

export function resolveActivePaymentCycle(
  unpaidCollections: Array<{ date: string }>,
  now: Date = new Date()
) {
  if (!unpaidCollections.length) return null;

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
