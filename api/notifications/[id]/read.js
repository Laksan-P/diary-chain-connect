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
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
