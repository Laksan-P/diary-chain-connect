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

  // GET /api/faq?role=...
  if (req.method === 'GET') {
    const { role } = req.query;
    try {
      let query = supabase.from('faq').select('*');
      if (role) {
        query = query.eq('role', role);
      }
      
      const { data, error } = await query.order('id', { ascending: true });
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (err) {
      console.error('Fetch FAQ error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST /api/faq (create/update) - nestle dashboard
  if (req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user || !['nestle', 'nestle_officer'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

    try {
      const body = getBody(req);
      const { id, question, answer, role } = body;
      
      if (!question || !answer || !role) {
        return res.status(400).json({ error: 'Question, answer, and role are required' });
      }

      let query;
      if (id) {
        query = supabase.from('faq').update({ question, answer, role }).eq('id', id).select().single();
      } else {
        query = supabase.from('faq').insert({ question, answer, role }).select().single();
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(201).json(data);
    } catch (err) {
      console.error('Save FAQ error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // DELETE /api/faq?id=... - nestle dashboard
  if (req.method === 'DELETE') {
    const user = authenticate(req, res);
    if (!user || !['nestle', 'nestle_officer'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      const { error } = await supabase.from('faq').delete().eq('id', id);
      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete FAQ error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
