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
        // Step 1: Find oldest approved but unpaid collection
        const { data: unpaidCols } = await supabase
          .from('milk_collections')
          .select('date')
          .eq('user_id', user.id) // This assumes farmer's user_id is in collections, which might be center_id or farmer_id? 
          // Wait, let's fix the query to use the farmer's ID associated with this user.
          .eq('dispatch_status', 'Approved')
          .order('date', { ascending: true })
          .limit(1);

        // Actually, we need to join with farmers to get the right collections
        const { data: farmerInfo } = await supabase.from('farmers').select('id').eq('user_id', user.id).single();
        
        if (farmerInfo) {
          const { data: oldest } = await supabase
            .from('milk_collections')
            .select('date')
            .eq('farmer_id', farmerInfo.id)
            .eq('dispatch_status', 'Approved')
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (oldest) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const oldestDate = new Date(oldest.date);
            oldestDate.setHours(0, 0, 0, 0);

            // Nestle rule: Fixed Bi-weekly Cycle (1st-15th, 16th-End)
            // Processing happens on the 16th or the 1st of the next month
            let targetDate;
            if (oldestDate.getDate() <= 15) {
              targetDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 16);
            } else {
              targetDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth() + 1, 1);
            }

            const diffTime = targetDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const virtualId = parseInt(targetDate.toISOString().replace(/[-:T.]/g, '').substring(0, 8)) + 90000000;

            // Check if user has already 'virtually' read this cycle's reminder
            const { data: readNote } = await supabase
              .from('notifications')
              .select('is_read')
              .eq('user_id', user.id)
              .eq('id', virtualId)
              .maybeSingle();

            flattened.unshift({
              id: virtualId,
              userId: user.id,
              title: 'payment_cycle_reminder_title',
              message: `payment_cycle_reminder_msg|days:${diffDays === 0 ? 'Today' : diffDays}`,
              type: 'payment_reminder',
              isRead: readNote ? readNote.is_read : false,
              createdAt: new Date().toISOString()
            });
          }
        }
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
