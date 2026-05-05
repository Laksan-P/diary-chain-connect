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

  const { action, id: queryId } = req.query;
  
  // ────────── GET /api/chilling-centers?action=get&id=X ──────────
  if (action === 'get' && req.method === 'GET') {
    const user = authenticate(req, res);
    if (!user) return;
    
    const ccId = queryId || user.chillingCenterId;
    if (!ccId) return res.status(400).json({ error: 'ID is required' });

    try {
      const { data, error } = await supabase
        .from('chilling_centers')
        .select('*')
        .eq('id', ccId)
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error('Get chilling center error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/chilling-centers?action=create ──────────
  if (action === 'create' && req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user || user.role !== 'nestle_officer') return res.status(403).json({ error: 'Forbidden' });

    try {
      const body = getBody(req);
      const { name, location, phone_number } = body;
      if (!name || !location) return res.status(400).json({ error: 'Name and location are required' });

      const { data, error } = await supabase
        .from('chilling_centers')
        .insert({ name, location, phone_number })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.error('Create chilling center error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/chilling-centers?action=list ──────────
  if (action === 'list' && req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('chilling_centers')
        .select('id, name, location, phone_number, email');

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error('Get chilling centers error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/chilling-centers?action=performance ──────────
  if (action === 'performance' && req.method === 'GET') {
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

  // ────────── POST /api/chilling-centers?action=update ──────────
  if (action === 'update' && req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user) return;
    if (!['nestle', 'nestle_officer'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

    try {
      const body = getBody(req);
      const { id, name, location, phone_number } = body;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      const updateData = {};
      if (typeof name !== 'undefined') updateData.name = name;
      if (typeof location !== 'undefined') updateData.location = location;
      if (typeof phone_number !== 'undefined') updateData.phone_number = phone_number;

      const { data, error } = await supabase
        .from('chilling_centers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error('Update chilling center error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
