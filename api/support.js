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
      const { status, id, markRead } = req.query;
      // Mark as read if requested
      if (markRead === 'true') {
        const updateData = {};
        if (['nestle', 'nestle_officer', 'chilling_center'].includes(user.role)) {
          updateData.is_read_by_admin = true;
        } else {
          updateData.is_read_by_user = true;
        }
        
        let updateQuery = supabase.from('support_tickets').update(updateData);
        if (id) {
          updateQuery = updateQuery.eq('id', id);
        } else if (user.role === 'farmer') {
          updateQuery = updateQuery.eq('user_id', user.id);
        } else if (user.role === 'chilling_center') {
          updateQuery = updateQuery.or(`user_id.eq.${user.id},cc_id.eq.${user.chillingCenterId}`);
        }
        await updateQuery;
      }

      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          users!support_tickets_user_id_fkey (name, email),
          chilling_centers (name)
        `)
        .order('last_activity_at', { ascending: false });

      if (id) {
        query = query.eq('id', id).single();
      } else {
        // Role-based filtering
        if (user.role === 'farmer') {
          query = query.eq('user_id', user.id);
        } else if (user.role === 'chilling_center') {
          // CC sees their own tickets + tickets from their farmers
          query = query.or(`user_id.eq.${user.id},cc_id.eq.${user.chillingCenterId}`);
        } else if (['nestle', 'nestle_officer'].includes(user.role)) {
          // Nestle sees everything
          if (status) query = query.eq('status', status);
        }
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

      const finalCcId = cc_id || (user.role === 'chilling_center' ? user.chillingCenterId : (user.farmerInfo?.center_id || null));

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          role: user.role === 'nestle_officer' ? 'nestle' : user.role,
          message: message.trim(),
          language: language || 'en',
          cc_id: finalCcId,
          status: 'pending',
          is_read_by_user: true,
          is_read_by_admin: false,
          last_activity_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // NOTIFICATIONS: Notify Admins
      // 1. Notify Nestle Users
      const { data: nestleUsers } = await supabase.from('users').select('id').eq('role', 'nestle');
      if (nestleUsers) {
        const notes = nestleUsers.map(u => ({
          user_id: u.id,
          title: 'New Support Issue',
          message: `A new custom issue has been submitted by ${user.name}.`,
          type: 'general'
        }));
        await supabase.from('notifications').insert(notes);
      }

      // 2. Notify CC Owner if it's from a farmer
      if (user.role === 'farmer' && finalCcId) {
        const { data: ccUser } = await supabase.from('users').select('id').eq('chilling_center_id', finalCcId).single();
        if (ccUser) {
          await supabase.from('notifications').insert({
            user_id: ccUser.id,
            title: 'Farmer Support Issue',
            message: `${user.name} submitted a custom issue.`,
            type: 'general'
          });
        }
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Create ticket error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/support (Reply/Edit Ticket) ──────────
  if (req.method === 'PATCH') {
    try {
      const { id } = req.query;
      const { reply, reply_si, reply_ta } = getBody(req);

      if (!id) return res.status(400).json({ error: 'Ticket ID is required' });

      // Check permission
      const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', id).single();
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const isNestle = ['nestle', 'nestle_officer'].includes(user.role);
      const isCcOwner = user.role === 'chilling_center' && ticket.cc_id === user.chillingCenterId;

      if (!isNestle && !isCcOwner) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          reply: reply?.trim(),
          reply_si: reply_si?.trim(),
          reply_ta: reply_ta?.trim(),
          status: 'replied',
          replied_at: ticket.replied_at || new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          is_read_by_user: false,
          is_read_by_admin: true
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // NOTIFICATION: Notify the Farmer/User
      await supabase.from('notifications').insert({
        user_id: ticket.user_id,
        title: 'Support Reply Received',
        message: 'custom_issue_feedback|role:admin', // Special key for app logic
        type: 'general'
      });

      return res.status(200).json(data);
    } catch (err) {
      console.error('Reply ticket error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid method' });
}
