import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  const { action } = req.query;

  // Debug logging
  console.log("METHOD:", req.method);
  console.log("ACTION:", action);
  console.log("BODY:", getBody(req));

  // ────────── GET /api/collections?action=list ──────────
  if (action === 'list' && req.method === 'GET') {
    try {
      let query = supabase
        .from('milk_collections')
        .select(`
          id, farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type,
          quality_result, failure_reason, dispatch_status, created_at,
          farmers (name, farmer_id),
          chilling_centers (name)
        `);

      if (req.query.centerId) {
        query = query.eq('chilling_center_id', req.query.centerId);
      } else if (req.query.farmerId) {
        query = query.eq('farmer_id', req.query.farmerId);
      }

      const { data, error } = await query
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (error) throw error;

      const flattened = data.map((item) => ({
        id: item.id, farmerId: item.farmer_id,
        farmerName: item.farmers?.name, farmerCode: item.farmers?.farmer_id,
        chillingCenterId: item.chilling_center_id,
        chillingCenterName: item.chilling_centers?.name,
        date: item.date, time: item.time,
        temperature: item.temperature, quantity: item.quantity,
        milkType: item.milk_type, qualityResult: item.quality_result,
        failureReason: item.failure_reason, dispatchStatus: item.dispatch_status,
        createdAt: item.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get collections error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/collections?action=create ──────────
  if (action === 'create' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { farmerId, chillingCenterId, date, time, temperature, quantity, milkType } = body;
      if (!farmerId || !chillingCenterId || !date || !time || temperature == null || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: insertRows, error: insertErr } = await supabase
        .from('milk_collections')
        .insert({
          farmer_id: farmerId, chilling_center_id: chillingCenterId,
          date, time, temperature, quantity, milk_type: milkType || 'Cow',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      const newId = insertRows.id;

      const { data: mc, error: fetchErr } = await supabase
        .from('milk_collections')
        .select(`
          id, farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type,
          quality_result, failure_reason, dispatch_status, created_at,
          farmers (name, farmer_id),
          chilling_centers (name)
        `)
        .eq('id', newId)
        .single();

      if (fetchErr) throw fetchErr;

      return res.status(201).json({
        id: mc.id, farmerId: mc.farmer_id,
        farmerName: mc.farmers?.name, farmerCode: mc.farmers?.farmer_id,
        chillingCenterId: mc.chilling_center_id,
        chillingCenterName: mc.chilling_centers?.name,
        date: mc.date, time: mc.time,
        temperature: mc.temperature, quantity: mc.quantity,
        milkType: mc.milk_type, qualityResult: mc.quality_result,
        failureReason: mc.failure_reason, dispatchStatus: mc.dispatch_status,
        createdAt: mc.created_at,
      });
    } catch (err) {
      console.error('Create collection error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
