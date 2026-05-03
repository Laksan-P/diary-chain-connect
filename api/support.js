import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  // ────────── GET /api/support (List Tickets) ──────────
  if (req.method === 'GET') {
    try {
      const { status } = req.query;
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          users (name, email),
          chilling_centers (name)
        `)
        .order('created_at', { ascending: false });

      // If not Nestlé, only show user's own tickets
      if (!['nestle', 'nestle_officer'].includes(user.role)) {
        query = query.eq('user_id', user.id);
      } else if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json(data);
    } catch (err) {
      console.error('Fetch tickets error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/support (Create Ticket) ──────────
  if (req.method === 'POST') {
    try {
      const body = getBody(req);
      const { message, language, cc_id } = body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          role: user.role === 'nestle_officer' ? 'nestle' : user.role, // Nestlé officers don't create tickets normally
          message: message.trim(),
          language: language || 'en',
          cc_id: cc_id || (user.role === 'chilling_center' ? user.chillingCenterId : null),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (err) {
      console.error('Create ticket error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/support (Reply to Ticket - Admin Only) ──────────
  if (req.method === 'PATCH') {
    if (!['nestle', 'nestle_officer'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { id } = req.query;
      const { reply } = getBody(req);

      if (!id) return res.status(400).json({ error: 'Ticket ID is required' });
      if (!reply || !reply.trim()) return res.status(400).json({ error: 'Reply is required' });

      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          reply: reply.trim(),
          status: 'replied',
          replied_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (err) {
      console.error('Reply ticket error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid method' });
}
