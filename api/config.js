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

  // GET /api/config?key=...
  if (req.method === 'GET') {
    try {
      const { key } = req.query;
      let query = supabase.from('system_config').select('config_key, config_value');
      
      if (key) {
        query = query.eq('config_key', key).single();
      }

      const { data, error } = await query;
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found (single)
      
      return res.status(200).json(data || {});
    } catch (err) {
      console.error('Fetch config error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST /api/config (update)
  if (req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user || !['nestle', 'nestle_officer'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

    try {
      const body = getBody(req);
      const { key, value } = body;

      if (!key) return res.status(400).json({ error: 'Config key is required' });

      // Upsert
      const { data, error } = await supabase
        .from('system_config')
        .upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (err) {
      console.error('Update config error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
