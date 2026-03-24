import supabase from './_lib/supabase.js';
import { cors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const { data, error } = await supabase
      .from('chilling_centers')
      .select('count', { count: 'exact', head: true });

    if (error) throw error;

    res.status(200).json({
      status: 'ok',
      db: 'connected (Supabase SDK)',
      result: data,
    });
  } catch (err) {
    console.error('Supabase test error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
