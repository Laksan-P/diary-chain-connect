const NESTLE_PASS_TITLES = [
  'nestle_quality_pass_title',
  'nestle_quality_test_passed_title',
];

const NESTLE_FAIL_TITLES = [
  'nestle_quality_rejected_title',
  'nestle_quality_test_failed_title',
];

const ALL_NESTLE_TITLES = [...NESTLE_PASS_TITLES, ...NESTLE_FAIL_TITLES];

const DISPATCH_RESULT_TITLES = ['dispatch_approved_title', 'dispatch_rejected_title'];

function isNestleQualityTitle(title) {
  return ALL_NESTLE_TITLES.includes(title);
}

function isDispatchResultTitle(title) {
  return DISPATCH_RESULT_TITLES.includes(title);
}

async function loadCollectionContext(db, collectionId) {
  const { data: col } = await db
    .from('milk_collections')
    .select('farmer_id, date, farmers (user_id)')
    .eq('id', collectionId)
    .maybeSingle();

  if (!col?.farmers?.user_id) return null;

  const { data: itemLink } = await db
    .from('dispatch_items')
    .select('dispatch_id')
    .eq('collection_id', collectionId)
    .maybeSingle();

  return {
    userId: col.farmers.user_id,
    date: col.date,
    dispatchId: itemLink?.dispatch_id ?? null,
  };
}

/**
 * Send idempotent Nestlé quality verification notification to the farmer.
 * One notification per farmer + collection (+ dispatch when available).
 * Updates the existing notification if pass/reject result changes.
 */
export async function sendNestleQualityVerificationNotification(
  db,
  { collectionId, resultValue, reasonValue = null }
) {
  const ctx = await loadCollectionContext(db, collectionId);
  if (!ctx) return { sent: false, reason: 'farmer_not_found' };

  const { userId, date, dispatchId } = ctx;
  const isPass = resultValue === 'Pass';
  const titleKey = isPass ? 'nestle_quality_pass_title' : 'nestle_quality_rejected_title';
  const msgKey = isPass ? 'nestle_quality_pass_msg' : 'nestle_quality_rejected_msg';

  let params = `date:${date},collectionId:${collectionId}`;
  if (dispatchId) params += `,dispatchId:${dispatchId}`;
  if (!isPass && reasonValue) params += `,reason:${reasonValue}`;

  const message = `${msgKey}|${params}`;

  const { data: existingRows, error: lookupErr } = await db
    .from('notifications')
    .select('id, title')
    .eq('user_id', userId)
    .eq('type', 'quality_result')
    .like('message', `%collectionId:${collectionId}%`);

  if (lookupErr) throw lookupErr;

  const existing = (existingRows || []).find(n => isNestleQualityTitle(n.title));

  if (existing) {
    if (existing.title === titleKey) {
      return { sent: false, reason: 'already_exists', id: existing.id };
    }

    const { error: updateErr } = await db
      .from('notifications')
      .update({ title: titleKey, message, is_read: false })
      .eq('id', existing.id);

    if (updateErr) throw updateErr;
    return { sent: true, updated: true, id: existing.id };
  }

  const { data: inserted, error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      title: titleKey,
      message,
      type: 'quality_result',
    })
    .select('id')
    .single();

  if (error) throw error;
  return { sent: true, id: inserted.id };
}

/**
 * Per-collection dispatch approved/rejected notification for the farmer.
 * Separate from Nestlé quality notification; idempotent per farmer + collection.
 */
export async function sendCollectionDispatchResultNotification(
  db,
  { collectionId, resultValue, reasonValue = null }
) {
  const ctx = await loadCollectionContext(db, collectionId);
  if (!ctx) return { sent: false, reason: 'farmer_not_found' };

  const { userId, date, dispatchId } = ctx;
  const isPass = resultValue === 'Pass';
  const titleKey = isPass ? 'dispatch_approved_title' : 'dispatch_rejected_title';
  const msgKey = isPass ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';

  let params = `date:${date},collectionId:${collectionId}`;
  if (dispatchId) params += `,dispatchId:${dispatchId}`;
  if (!isPass) {
    params += `,reason:${reasonValue || 'Quality standards not met'}`;
  }

  const message = `${msgKey}|${params}`;

  const { data: existingRows, error: lookupErr } = await db
    .from('notifications')
    .select('id, title')
    .eq('user_id', userId)
    .eq('type', 'dispatch')
    .like('message', `%collectionId:${collectionId}%`);

  if (lookupErr) throw lookupErr;

  const existing = (existingRows || []).find(n => isDispatchResultTitle(n.title));

  if (existing) {
    if (existing.title === titleKey) {
      return { sent: false, reason: 'already_exists', id: existing.id };
    }

    const { error: updateErr } = await db
      .from('notifications')
      .update({ title: titleKey, message, is_read: false })
      .eq('id', existing.id);

    if (updateErr) throw updateErr;
    return { sent: true, updated: true, id: existing.id };
  }

  const { data: inserted, error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      title: titleKey,
      message,
      type: 'dispatch',
    })
    .select('id')
    .single();

  if (error) throw error;
  return { sent: true, id: inserted.id };
}

/** Nestlé quality inspection: notify farmer of quality result + collection dispatch outcome. */
export async function sendNestleCollectionInspectionNotifications(
  db,
  { collectionId, resultValue, reasonValue = null }
) {
  const quality = await sendNestleQualityVerificationNotification(db, {
    collectionId,
    resultValue,
    reasonValue,
  });

  const dispatch = await sendCollectionDispatchResultNotification(db, {
    collectionId,
    resultValue,
    reasonValue,
  });

  return { quality, dispatch };
}
