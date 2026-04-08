import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  const { action, id } = req.query;

  // ────────── GET /api/notifications?action=list ──────────
  if (action === 'list' && req.method === 'GET') {
    try {
      // Strictly use the ID from the authenticated token for security
      const userId = user.id;
      const { data: notes, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const flattened = notes.map((n) => ({
        id: n.id, userId: n.user_id, title: n.title,
        message: n.message, type: n.type,
        isRead: n.is_read, createdAt: n.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get notifications error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/notifications?action=mark-read&id=X ──────────
  if (action === 'mark-read' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Mark notification read error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
