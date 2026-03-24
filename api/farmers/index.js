import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { data: farmers, error } = await supabase
        .from('farmers')
        .select(`
          id, farmer_id, user_id, name, address, phone, nic, chilling_center_id,
          chilling_centers (name),
          milk_collections (quantity),
          created_at
        `);

      if (error) throw error;

      const result = farmers.map((f) => {
        const totalQuantity = (f.milk_collections || []).reduce(
          (sum, mc) => sum + parseFloat(mc.quantity || 0),
          0
        );
        return {
          id: f.id,
          farmerId: f.farmer_id,
          userId: f.user_id,
          name: f.name,
          address: f.address,
          phone: f.phone,
          nic: f.nic,
          chillingCenterId: f.chilling_center_id,
          chillingCenterName: f.chilling_centers?.name,
          totalQuantity,
          createdAt: f.created_at,
        };
      });

      result.sort((a, b) => b.totalQuantity - a.totalQuantity);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Get farmers error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
