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
    const { status } = req.body;
    if (status !== 'Paid') return res.status(400).json({ error: 'Status must be Paid' });

    await supabase
      .from('payments')
      .update({ status: 'Paid', paid_at: new Date().toISOString() })
      .eq('id', id);

    // Notification
    const { data: p } = await supabase
      .from('payments')
      .select('amount, farmers!inner(user_id)')
      .eq('id', id)
      .maybeSingle();

    if (p && p.farmers?.user_id) {
      const userId = p.farmers.user_id;
      const amount = p.amount;
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Payment Completed',
        message: `Payment of Rs. ${parseFloat(amount).toLocaleString()} has been credited.`,
        type: 'payment',
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
