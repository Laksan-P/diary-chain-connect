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

    const ccId = Number(queryId || user.chillingCenterId);
    if (!ccId) return res.status(400).json({ error: 'ID is required' });

    try {
      // 1. Fetch CC details
      const { data: cc, error: ccErr } = await supabase
        .from('chilling_centers')
        .select('*')
        .eq('id', ccId)
        .single();

      if (ccErr) throw ccErr;

      // 2. Sync Performance Status (Consistent with Nestle's logic)
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('status')
        .eq('chilling_center_id', ccId);

      let currentStatus = 'Good';
      let currentRec = null;
      let passRate = 100;

      if (dispatches && dispatches.length > 0) {
        const total = dispatches.length;
        const rejected = dispatches.filter(d => d.status === 'Rejected').length;
        const rejectionRate = (rejected / total) * 100;
        passRate = Number((100 - rejectionRate).toFixed(1));

        // STRICT RULE: Threshold is 75% pass rate
        if (passRate < 75) {
          currentStatus = 'Needs Improvement';
          currentRec = `Low quality pass rate (${passRate}%). Please review collection and cooling procedures.`;
        }
      }

      const showAlert = currentStatus === 'Needs Improvement';

      // 3. Update DB if status changed or recommendation changed
      if (currentStatus !== cc.performance_status || currentRec !== cc.performance_recommendation) {
        await supabase.from('chilling_centers')
          .update({ performance_status: currentStatus, performance_recommendation: currentRec })
          .eq('id', ccId);
          
        // If it became Needs Improvement, send an immediate notification
        if (currentStatus === 'Needs Improvement' && cc.performance_status !== 'Needs Improvement') {
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: 'performance_warning_title',
            message: `performance_warning_msg|rate:${passRate}%`,
            type: 'system'
          });
        }
      }

      console.log(`[CC Performance Debug] ID: ${ccId}, PassRate: ${passRate}, Status: ${currentStatus}, ShowAlert: ${showAlert}`);

      return res.status(200).json({ 
        ...cc, 
        quality_pass_rate: passRate,
        performance_status: currentStatus, 
        performance_recommendation: currentRec,
        show_alert: showAlert
      });
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
