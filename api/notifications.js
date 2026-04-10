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
      const userId = user.id;
      const { data: notes, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let flattened = notes.map((n) => ({
        id: n.id, userId: n.user_id, title: n.title,
        message: n.message, type: n.type,
        isRead: n.is_read, createdAt: n.created_at,
      }));

      // In-memory injection of Bi-weekly Payment Reminder for Farmers
      if (user.role === 'farmer') {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day for stable day counting
        
        const day = now.getDate();
        let targetDate;
        
        if (day <= 14) {
          targetDate = new Date(now.getFullYear(), now.getMonth(), 14);
        } else if (day <= 28) {
          targetDate = new Date(now.getFullYear(), now.getMonth(), 28);
        } else {
          targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 14);
        }

        const diffTime = targetDate.getTime() - now.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        
        // Generate a stable virtual ID based on the current cycle end date
        const virtualId = parseInt(targetDate.toISOString().replace(/[-:T.]/g, '').substring(0, 8));

        flattened.unshift({
          id: virtualId,
          userId: user.id,
          title: 'payment_cycle_reminder_title',
          message: `payment_cycle_reminder_msg|days:${diffDays === 0 ? 'Today' : diffDays}`,
          type: 'general',
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

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
