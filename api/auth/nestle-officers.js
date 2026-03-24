import supabase from '../../_lib/supabase.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, nestle_officers!inner(designation, created_at)');

    if (error) throw error;

    const flattened = data.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      designation: u.nestle_officers[0]?.designation,
      created_at: u.nestle_officers[0]?.created_at,
    }));

    res.status(200).json(flattened);
  } catch (err) {
    console.error('Get nestle officers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
