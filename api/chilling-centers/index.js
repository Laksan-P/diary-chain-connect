import supabase from '../../_lib/supabase.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('chilling_centers')
      .select('id, name, location');

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('Get chilling centers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
