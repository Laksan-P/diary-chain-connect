import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = authenticate(req, res);
  if (!user) return;

  try {
    // Get all centers
    const { data: centers, error: cErr } = await supabase
      .from('chilling_centers')
      .select('id, name');
    if (cErr) throw cErr;

    const result = [];

    for (const cc of centers) {
      // Get collections
      const { data: mc, error: mcErr } = await supabase
        .from('milk_collections')
        .select('quantity, quality_result')
        .eq('chilling_center_id', cc.id);

      if (mcErr) throw mcErr;

      const totalQuantity = mc.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
      const collectionCount = mc.length;
      const avgQuantity = collectionCount > 0 ? totalQuantity / collectionCount : 0;

      // Quality rate
      const testedCount = mc.filter((item) => item.quality_result !== null).length;
      const passedCount = mc.filter((item) => item.quality_result === 'Pass').length;
      const qualityRate =
        testedCount > 0 ? parseFloat(((passedCount / testedCount) * 100).toFixed(1)) : 0;

      // Revenue from payments
      const { data: payments, error: pErr } = await supabase
        .from('payments')
        .select('amount, milk_collections!inner(chilling_center_id)')
        .eq('milk_collections.chilling_center_id', cc.id);

      if (pErr) throw pErr;
      const totalRevenue = payments.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

      result.push({
        centerId: cc.id,
        centerName: cc.name,
        totalQuantity,
        avgQuantity: Math.round(avgQuantity),
        collectionCount,
        qualityRate,
        totalRevenue,
        rank: 0,
      });
    }

    result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    result.forEach((item, index) => (item.rank = index + 1));

    res.status(200).json(result);
  } catch (err) {
    console.error('Performance stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
