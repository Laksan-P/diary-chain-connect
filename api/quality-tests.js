import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { collectionId } = req.query;
      if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

      // Return testing data for this collection
      const { data: qts, error } = await supabase
         .from('quality_tests')
         .select('*')
         .eq('collection_id', collectionId)
         .order('tested_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(qts);
    } catch (err) {
      console.error('Get quality tests error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
