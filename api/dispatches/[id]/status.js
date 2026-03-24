import supabase from '../../../_lib/supabase.js';
import { authenticate } from '../../../_lib/auth.js';
import { cors } from '../../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = authenticate(req, res);
  if (!user) return;

  const { id } = req.query;

  try {
    const { status, reason } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    await supabase
      .from('dispatches')
      .update({ status, rejection_reason: reason || null })
      .eq('id', id);

    // Update items in collection
    const { data: items, error: iErr } = await supabase
      .from('dispatch_items')
      .select('collection_id')
      .eq('dispatch_id', id);

    if (!iErr && items) {
      for (const item of items) {
        await supabase
          .from('milk_collections')
          .update({ dispatch_status: status })
          .eq('id', item.collection_id);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update dispatch status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
