import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      let query = supabase
        .from('payments')
        .select(`
          id, farmer_id, collection_id, quantity, base_pay, fat_bonus, snf_bonus, amount, status, paid_at, created_at,
          farmers (name, farmer_id),
          milk_collections (date, quality_result, dispatch_status)
        `);

      if (req.query.farmerId) {
        query = query.eq('farmer_id', req.query.farmerId);
      }

      const { data: payments, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const flattened = payments.map((p) => ({
        id: p.id,
        farmerId: p.farmer_id,
        farmerName: p.farmers?.name,
        farmerCode: p.farmers?.farmer_id,
        collectionId: p.collection_id,
        quantity: p.quantity,
        basePay: p.base_pay,
        fatBonus: p.fat_bonus,
        snfBonus: p.snf_bonus,
        amount: p.amount,
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at,
        collectionDate: p.milk_collections?.date,
        qualityResult: p.milk_collections?.quality_result,
        dispatchStatus: p.milk_collections?.dispatch_status,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get payments error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
