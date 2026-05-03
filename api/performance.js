import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  const { type, id } = req.query;

  if (req.method === 'GET') {
    try {
      // ────────────────────────────────────────────────
      //  FARMER PERFORMANCE
      // ────────────────────────────────────────────────
      if (type === 'farmer') {
        const farmerId = id || user.farmerId;
        if (!farmerId) return res.status(400).json({ error: 'Farmer ID required' });

        // 1. Fetch Farmer Status & Recommendations
        const { data: farmer } = await supabase
          .from('farmers')
          .select('name, performance_status, performance_recommendation')
          .eq('id', farmerId)
          .single();

        // 2. Calculate Pass Rate (all time or recent)
        const { data: tests } = await supabase
          .from('quality_tests')
          .select('result, tested_at')
          .eq('collection_id', (
            await supabase.from('milk_collections').select('id').eq('farmer_id', farmerId)
          ).data?.map(c => c.id) || []);

        const total = tests?.length || 0;
        const passed = tests?.filter(t => t.result === 'Pass').length || 0;
        const passRate = total > 0 ? (passed / total) * 100 : 100;

        // 3. Trends (Monthly volume/quality)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const { data: collections } = await supabase
          .from('milk_collections')
          .select('date, quantity, quality_result')
          .eq('farmer_id', farmerId)
          .gte('date', threeMonthsAgo.toISOString().split('T')[0])
          .order('date', { ascending: true });

        // Aggregate by month for trends
        const trends = {};
        collections?.forEach(c => {
          const month = c.date.substring(0, 7); // YYYY-MM
          if (!trends[month]) trends[month] = { month, volume: 0, passCount: 0, total: 0 };
          trends[month].volume += parseFloat(c.quantity) || 0;
          trends[month].total++;
          if (c.quality_result === 'Pass') trends[month].passCount++;
        });

        const trendArray = Object.values(trends).map(t => ({
          ...t,
          passRate: t.total > 0 ? (t.passCount / t.total) * 100 : 100
        }));

        return res.status(200).json({
          status: farmer?.performance_status || 'Good',
          recommendation: farmer?.performance_recommendation,
          passRate,
          frequency: total > 0 ? 'Regular' : 'New', // Simplification
          trends: trendArray
        });
      }

      // ────────────────────────────────────────────────
      //  CENTER PERFORMANCE
      // ────────────────────────────────────────────────
      if (type === 'center') {
        const centerId = id || user.chillingCenterId;
        if (!centerId) return res.status(400).json({ error: 'Center ID required' });

        // 1. Fetch Center Status
        const { data: center } = await supabase
          .from('chilling_centers')
          .select('name, performance_status, performance_recommendation')
          .eq('id', centerId)
          .single();

        // 2. Metrics (Rejection rate)
        const { data: dispatches } = await supabase
          .from('dispatches')
          .select('status, dispatch_date, quantity:dispatch_items(milk_collections(quantity))')
          .eq('chilling_center_id', centerId);

        const totalD = dispatches?.length || 0;
        const rejectedD = dispatches?.filter(d => d.status === 'Rejected').length || 0;
        const rejectionRate = totalD > 0 ? (rejectedD / totalD) * 100 : 0;

        // 3. Trends
        const trends = {};
        dispatches?.forEach(d => {
          const month = d.dispatch_date.substring(0, 7);
          if (!trends[month]) trends[month] = { month, volume: 0, rejected: 0, total: 0 };
          trends[month].total++;
          if (d.status === 'Rejected') trends[month].rejected++;
          
          // Sum up items quantity
          const vol = d.quantity?.reduce((sum, item) => sum + (parseFloat(item.milk_collections?.quantity) || 0), 0) || 0;
          trends[month].volume += vol;
        });

        const trendArray = Object.values(trends);

        return res.status(200).json({
          status: center?.performance_status || 'Good',
          recommendation: center?.performance_recommendation,
          passRate: 100 - rejectionRate,
          rejectionRate,
          trends: trendArray
        });
      }

      // ────────────────────────────────────────────────
      //  NESTLE VIEW (ALL)
      // ────────────────────────────────────────────────
      if (['nestle', 'nestle_officer'].includes(user.role)) {
        // Fetch aggregated stats for Nestle
        const { data: farmers } = await supabase.from('farmers').select('id, name, performance_status');
        const { data: centers } = await supabase.from('chilling_centers').select('id', 'name', 'performance_status');

        return res.status(200).json({ farmers, centers });
      }

      return res.status(400).json({ error: 'Invalid type' });
    } catch (err) {
      console.error('Performance API error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
