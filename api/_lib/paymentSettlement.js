import { getCyclePayoutDate, normalizeDate, getCyclePeriod, getCycleDisplayRange } from './paymentCycle.js';

export async function sendPaymentDisbursedNotification(
  db,
  { userId, paymentId, amount, quantity, cycleStart, cycleEnd }
) {
  if (!userId || !paymentId) return { sent: false, reason: 'missing_fields' };

  const idempotencyMarker = `paymentId:${paymentId}`;
  const { data: existing, error: lookupErr } = await db
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'payment')
    .eq('title', 'payment_received_title')
    .like('message', `%${idempotencyMarker}%`)
    .maybeSingle();

  if (lookupErr) throw lookupErr;
  if (existing) return { sent: false, reason: 'already_exists', id: existing.id };

  const msgKey =
    cycleStart && cycleEnd ? 'payment_disbursed_cycle_msg' : 'payment_disbursed_msg';

  let params = `amount:${amount},qty:${quantity || 0},paymentId:${paymentId}`;
  if (cycleStart && cycleEnd) {
    params += `,cycleStart:${cycleStart},cycleEnd:${cycleEnd}`;
  }

  const { data: inserted, error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      title: 'payment_received_title',
      message: `${msgKey}|${params}`,
      type: 'payment',
    })
    .select('id')
    .single();

  if (error) throw error;
  return { sent: true, id: inserted.id };
}

export async function getPaidCollectionIds(db) {
  const paidIds = new Set();

  const { data: paidCollections, error: colErr } = await db
    .from('milk_collections')
    .select('id')
    .eq('dispatch_status', 'Paid');

  if (colErr) throw colErr;
  (paidCollections || []).forEach(row => paidIds.add(row.id));

  const { data: paidPayments, error: payErr } = await db
    .from('payments')
    .select('collection_id')
    .eq('status', 'Paid');

  if (payErr) throw payErr;
  (paidPayments || []).forEach(row => {
    if (row.collection_id != null) paidIds.add(row.collection_id);
  });

  return paidIds;
}

/** Approved milk collections that have not yet been settled/disbursement. */
export async function getUnpaidApprovedCollections(db) {
  const paidIds = await getPaidCollectionIds(db);

  const { data: collections, error } = await db
    .from('milk_collections')
    .select(
      'id, farmer_id, quantity, quality_result, dispatch_status, date, milk_type, created_at, fat, snf'
    )
    .eq('dispatch_status', 'Approved');

  if (error) throw error;

  return (collections || []).filter(c => !paidIds.has(c.id));
}

export function getCollectionIdsFromSummaryItem(item) {
  const { collections, collectionIds } = item;
  if (Array.isArray(collectionIds) && collectionIds.length > 0) {
    return collectionIds.map(id => Number(id)).filter(Boolean);
  }
  if (Array.isArray(collections) && collections.length > 0) {
    if (typeof collections[0] === 'number') {
      return collections.map(id => Number(id)).filter(Boolean);
    }
    return collections.map(c => Number(c.id)).filter(Boolean);
  }
  return [];
}

export async function markCollectionsSettled(db, collectionIds) {
  if (!collectionIds.length) return { updated: 0 };

  const { data: updatedRows, error } = await db
    .from('milk_collections')
    .update({ dispatch_status: 'Paid' })
    .in('id', collectionIds)
    .eq('dispatch_status', 'Approved')
    .select('id');

  if (error) {
    return { updated: 0, error };
  }
  return { updated: updatedRows?.length || 0 };
}

export async function findExistingBatchPayment(db, farmerId, collectionIds) {
  if (!collectionIds.length) return null;

  const { data, error } = await db
    .from('payments')
    .select('id, collection_id, status, paid_at')
    .eq('farmer_id', farmerId)
    .eq('status', 'Paid')
    .in('collection_id', collectionIds)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function buildCycleSummaryMeta(unpaidCollections, now = new Date(), skipCycle = false) {
  const today = normalizeDate(now);

  const payoutDates = unpaidCollections.map(c => getCyclePayoutDate(c.date));
  const earliestPayout = payoutDates.reduce(
    (min, d) => (d < min ? d : min),
    payoutDates[0]
  );

  const cycleReached =
    skipCycle || unpaidCollections.some(c => getCyclePayoutDate(c.date) <= today);

  const nextPayout = unpaidCollections
    .map(c => getCyclePayoutDate(c.date))
    .filter(d => d >= today)
    .sort((a, b) => a - b)[0];

  const referencePayout = nextPayout || earliestPayout;
  const daysUntilCycle = referencePayout
    ? Math.max(0, Math.ceil((referencePayout.getTime() - today.getTime()) / 86400000))
    : 0;

  return {
    cycleReached,
    daysUntilCycle,
    payoutDate: referencePayout?.toISOString() || null,
  };
}

export async function processFarmerSettlement(db, item) {
  const farmerId = Number(item.farmerId);
  const requestedIds = getCollectionIdsFromSummaryItem(item);
  const totalPayment = item.totalPayment;
  const totalQty = item.totalQty;

  if (!farmerId || !requestedIds.length) {
    return { status: 'skipped', reason: 'invalid_item' };
  }

  const { data: collectionRows, error: colLookupErr } = await db
    .from('milk_collections')
    .select('id, dispatch_status')
    .in('id', requestedIds);

  if (colLookupErr) throw colLookupErr;

  const paidIds = await getPaidCollectionIds(db);
  const eligibleIds = (collectionRows || [])
    .filter(c => c.dispatch_status === 'Approved' && !paidIds.has(c.id))
    .map(c => c.id);

  if (!eligibleIds.length) {
    const existing = await findExistingBatchPayment(db, farmerId, requestedIds);
    return {
      status: 'skipped',
      reason: existing ? 'already_disbursed' : 'no_eligible_collections',
      paymentId: existing?.id ?? null,
    };
  }

  const existingPayment = await findExistingBatchPayment(db, farmerId, eligibleIds);
  if (existingPayment) {
    await markCollectionsSettled(db, eligibleIds);
    return {
      status: 'skipped',
      reason: 'already_disbursed',
      paymentId: existingPayment.id,
    };
  }

  const paidAt = new Date().toISOString();
  const { data: payRecord, error: pErr } = await db
    .from('payments')
    .insert({
      farmer_id: farmerId,
      collection_id: eligibleIds[0],
      quantity: totalQty,
      amount: totalPayment,
      base_pay: totalPayment,
      status: 'Paid',
      paid_at: paidAt,
    })
    .select('id')
    .single();

  if (pErr) throw pErr;

  const settleResult = await markCollectionsSettled(db, eligibleIds);

  if (settleResult.updated < eligibleIds.length) {
    for (const colId of eligibleIds) {
      if (colId === eligibleIds[0]) continue;

      const { data: markerPayment } = await db
        .from('payments')
        .select('id')
        .eq('collection_id', colId)
        .eq('status', 'Paid')
        .maybeSingle();

      if (!markerPayment) {
        await db.from('payments').insert({
          farmer_id: farmerId,
          collection_id: colId,
          quantity: 0,
          amount: 0,
          base_pay: 0,
          status: 'Paid',
          paid_at: paidAt,
        });
      }
    }
  }

  if (settleResult.updated === 0 && settleResult.error) {
    console.warn(
      `[payments] Payment #${payRecord.id} recorded; collection status fallback via payment markers:`,
      eligibleIds
    );
  }

  const { data: farmerData } = await db
    .from('farmers')
    .select('user_id')
    .eq('id', farmerId)
    .maybeSingle();

  if (farmerData?.user_id) {
    let cycleStart = item.cycleStart;
    let cycleEnd = item.cycleEnd;

    if ((!cycleStart || !cycleEnd) && item.collections?.length) {
      const earliestDate = item.collections.map(c => c.date).sort()[0];
      const range = getCycleDisplayRange(getCyclePeriod(getCyclePayoutDate(earliestDate)));
      cycleStart = range.cycleStart;
      cycleEnd = range.cycleEnd;
    }

    await sendPaymentDisbursedNotification(db, {
      userId: farmerData.user_id,
      paymentId: payRecord.id,
      amount: totalPayment,
      quantity: totalQty,
      cycleStart,
      cycleEnd,
    });
  }

  return {
    status: 'processed',
    paymentId: payRecord.id,
    collectionIds: eligibleIds,
    settledCount: settleResult.updated,
  };
}
