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
          users (name, email),
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
          // We use a join with farmers to ensure even tickets with null cc_id are found if the user is a farmer in this CC
          const { data: farmerIds } = await supabase.from('farmers').select('user_id').eq('chilling_center_id', user.chillingCenterId);
          const userIds = [user.id, ...(farmerIds?.map(f => f.user_id) || [])];
          query = query.in('user_id', userIds);
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

      const finalCcId = cc_id || user.chillingCenterId || null;

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

        const { data: ccData } = await supabase
          .from('chilling_centers')
          .select('user_id')
          .eq('id', finalCcId)
          .maybeSingle();

        if (ccData?.user_id) {
          await supabase.from('notifications').insert({
            user_id: ccData.user_id,
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
      let isCcOwner = false;

      if (user.role === 'chilling_center') {
        // 1. Is it their own ticket to Nestle?
        if (ticket.user_id === user.id) {
          isCcOwner = true;
        } 
        // 2. Is it a ticket from their farmer?
        else if (ticket.cc_id === user.chillingCenterId && user.chillingCenterId) {
          isCcOwner = true;
        } else {
          // Check if the ticket creator is a farmer in this CC
          try {
            const { data: farmer } = await supabase
              .from('farmers')
              .select('chilling_center_id')
              .eq('user_id', ticket.user_id)
              .maybeSingle();
            
            if (farmer) {
              // Get the CC ID for the current user
              let myCcId = user.chillingCenterId;
              if (!myCcId) {
                const { data: myCc } = await supabase.from('chilling_centers').select('id').eq('user_id', user.id).maybeSingle();
                myCcId = myCc?.id;
              }

              if (myCcId && farmer.chilling_center_id === myCcId) {
                isCcOwner = true;
              }
            }
          } catch (e) {
            console.error("Permission check failed:", e);
          }
        }
      }

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
          replied_by: isNestle ? 'nestle' : 'chilling_center',
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
