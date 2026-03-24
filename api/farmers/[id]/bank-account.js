import supabase from '../../../_lib/supabase.js';
import { authenticate } from '../../../_lib/auth.js';
import { cors } from '../../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = authenticate(req, res);
  if (!user) return;

  const { id } = req.query;

  try {
    const { data: ba, error } = await supabase
      .from('bank_accounts')
      .select('id, farmer_id, bank_name, account_number, branch')
      .eq('farmer_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!ba) return res.status(200).json(null);

    res.status(200).json({
      id: ba.id,
      farmerId: ba.farmer_id,
      bankName: ba.bank_name,
      accountNumber: ba.account_number,
      branch: ba.branch,
    });
  } catch (err) {
    console.error('Get bank info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
