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

  // POST /api/feedback-logs
  if (req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user) return;

    try {
      const body = getBody(req);
      const { role, question_id, additional_info } = body;
      
      const { data, error } = await supabase
        .from('feedback_logs')
        .insert({
          user_id: user.id,
          role: role || user.role,
          question_id: question_id || null, // null if 'Other'
          additional_info: additional_info || null
        })
        .select()
        .single();

      if (error) throw error;
      
      return res.status(201).json(data);
    } catch (err) {
      console.error('Log feedback error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // GET /api/feedback-logs
  if (req.method === 'GET') {
    const user = authenticate(req, res);
    if (!user || !['nestle', 'nestle_officer'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

    try {
      const { data, error } = await supabase
        .from('feedback_logs')
        .select(`
          id, user_id, role, question_id, timestamp, additional_info,
          faq ( question, answer )
        `)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error('Get feedback logs error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
