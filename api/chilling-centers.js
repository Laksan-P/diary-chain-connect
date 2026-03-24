import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  // ────────── GET /api/chilling-centers?action=list ──────────
  if (action === 'list') {
    try {
      const { data, error } = await supabase
        .from('chilling_centers')
        .select('id, name, location');

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error('Get chilling centers error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/chilling-centers?action=performance ──────────
  if (action === 'performance') {
    const user = authenticate(req, res);
    if (!user) return;

    try {
      const { data: centers, error: cErr } = await supabase
        .from('chilling_centers').select('id, name');
      if (cErr) throw cErr;

      const result = [];

      for (const cc of centers) {
        const { data: mc, error: mcErr } = await supabase
          .from('milk_collections')
          .select('quantity, quality_result')
          .eq('chilling_center_id', cc.id);
        if (mcErr) throw mcErr;

        const totalQuantity = mc.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        const collectionCount = mc.length;
        const avgQuantity = collectionCount > 0 ? totalQuantity / collectionCount : 0;

        const testedCount = mc.filter((item) => item.quality_result !== null).length;
        const passedCount = mc.filter((item) => item.quality_result === 'Pass').length;
        const qualityRate = testedCount > 0
          ? parseFloat(((passedCount / testedCount) * 100).toFixed(1)) : 0;

        const { data: payments, error: pErr } = await supabase
          .from('payments')
          .select('amount, milk_collections!inner(chilling_center_id)')
          .eq('milk_collections.chilling_center_id', cc.id);
        if (pErr) throw pErr;
        const totalRevenue = payments.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

        result.push({
          centerId: cc.id, centerName: cc.name,
          totalQuantity, avgQuantity: Math.round(avgQuantity),
          collectionCount, qualityRate, totalRevenue, rank: 0,
        });
      }

      result.sort((a, b) => b.totalQuantity - a.totalQuantity);
      result.forEach((item, index) => (item.rank = index + 1));

      return res.status(200).json(result);
    } catch (err) {
      console.error('Performance stats error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
