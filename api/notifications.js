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
      // IMPORTANT: Do NOT use .neq('type', 'payment_reminder') — that value is not in the DB enum
      // The DB enum only allows: 'quality_result', 'payment', 'dispatch', 'general'
      const { data: notes, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let flattened = notes
        .filter((n) => n.message !== 'Acknowledged') // Hide internal read-tracking records
        .map((n) => ({
          id: n.id, userId: n.user_id, title: n.title,
          message: n.message, type: n.type,
          isRead: n.is_read, createdAt: n.created_at,
        }));

      // In-memory injection of Bi-weekly Payment Reminder for Farmers
      if (user.role === 'farmer') {
        try {
          const { data: farmerInfo } = await supabase
            .from('farmers').select('id').eq('user_id', user.id).maybeSingle();

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

              // Calculate the next upcoming settlement date (not the past one)
              // Bi-weekly: 1st-15th settles on the 16th, 16th-end settles on the 1st of next month
              // If that date is already past, advance to the NEXT cycle
              let targetDate;
              if (oldestDate.getDate() <= 15) {
                targetDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 16);
              } else {
                targetDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth() + 1, 1);
              }

              // If the target is already past, find the next upcoming settlement from TODAY
              if (targetDate <= now) {
                const today = new Date(now);
                if (today.getDate() < 16) {
                  targetDate = new Date(today.getFullYear(), today.getMonth(), 16);
                } else {
                  targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                }
              }

              const diffTime = targetDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              // Daily-unique virtual ID: YYYYMMDD + 90,000,000
              const todayStr = now.toISOString().split('T')[0].replace(/-/g, '');
              const virtualId = parseInt(todayStr) + 90000000;

              const { data: readNote } = await supabase
                .from('notifications')
                .select('is_read')
                .eq('user_id', user.id)
                .eq('id', virtualId)
                .maybeSingle();

              // Only say "today" when diffDays is exactly 0 (actual payment day)
              // Otherwise always show remaining days
              const msgKey = diffDays === 0 ? 'payment_ready_msg' : 'payment_cycle_reminder_msg';

              flattened.unshift({
                id: virtualId,
                userId: user.id,
                title: 'payment_cycle_reminder_title',
                message: `${msgKey}|days:${diffDays}`,
                type: 'payment_reminder',
                isRead: readNote ? readNote.is_read : false,
                createdAt: new Date().toISOString()
              });
            }
          }
        } catch (reminderErr) {
          console.error('Payment reminder injection failed:', reminderErr);
          // Don't crash the endpoint — just skip the reminder
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
      const numericId = parseInt(id);

      if (numericId >= 90000000) {
        // Virtual payment reminder — persist read state using 'payment' (valid DB enum value)
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('id', numericId)
          .maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert({
            id: numericId,
            user_id: user.id,
            title: 'payment_cycle_reminder_title',
            message: 'Acknowledged',
            type: 'payment',  // Valid DB enum value
            is_read: true
          });
        } else {
          await supabase.from('notifications')
            .update({ is_read: true })
            .eq('id', numericId)
            .eq('user_id', user.id);
        }
        return res.status(200).json({ success: true });
      }

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
