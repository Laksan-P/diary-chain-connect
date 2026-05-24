import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';
import { buildSupplyPredictionResponse } from './_lib/supplyPrediction.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

    const { data: collections, error } = await supabase
      .from('milk_collections')
      .select(
        'id, date, quantity, quality_result, dispatch_status, chilling_center_id, chilling_centers(name)'
      )
      .gte('date', twentyFourMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const response = buildSupplyPredictionResponse(collections || []);

    if (response.alerts.length > 0) {
      const { data: nestleAdmins } = await supabase.from('users').select('id').eq('role', 'nestle');
      if (nestleAdmins?.length) {
        const todayStr = new Date().toISOString().split('T')[0];
        const adminId = nestleAdmins[0].id;

        const { data: recentAlerts } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', adminId)
          .eq('type', 'prediction_alert')
          .gte('created_at', todayStr)
          .limit(1);

        if (!recentAlerts?.length) {
          await supabase.from('notifications').insert(
            response.alerts.map(alert => ({
              user_id: adminId,
              title: `${alert.level} Supply Forecast`,
              message: alert.message,
              type: 'prediction_alert',
              is_read: false,
            }))
          );
        }
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('Predictions API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
