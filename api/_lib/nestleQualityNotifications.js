/**
 * Send idempotent Nestlé quality verification notification to the farmer.
 * One notification per farmer + collection (+ dispatch when available).
 */
export async function sendNestleQualityVerificationNotification(
  db,
  { collectionId, resultValue, reasonValue = null }
) {
  const { data: col } = await db
    .from('milk_collections')
    .select('farmer_id, date, farmers (user_id)')
    .eq('id', collectionId)
    .maybeSingle();

  if (!col?.farmers?.user_id) return { sent: false, reason: 'farmer_not_found' };

  const userId = col.farmers.user_id;
  const date = col.date;

  const { data: itemLink } = await db
    .from('dispatch_items')
    .select('dispatch_id')
    .eq('collection_id', collectionId)
    .maybeSingle();

  const dispatchId = itemLink?.dispatch_id;
  const titleKey =
    resultValue === 'Pass'
      ? 'nestle_quality_test_passed_title'
      : 'nestle_quality_test_failed_title';
  const msgKey =
    resultValue === 'Pass'
      ? 'nestle_quality_test_passed_msg'
      : 'nestle_quality_test_failed_msg';

  let params = `date:${date},collectionId:${collectionId}`;
  if (dispatchId) params += `,dispatchId:${dispatchId}`;
  if (resultValue !== 'Pass') params += `,reason:${reasonValue || 'N/A'}`;

  const message = `${msgKey}|${params}`;

  const { data: existing } = await db
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'quality_result')
    .eq('title', titleKey)
    .like('message', `%collectionId:${collectionId}%`)
    .maybeSingle();

  if (existing) return { sent: false, reason: 'already_exists', id: existing.id };

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
