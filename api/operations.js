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

  const { action, id } = req.query;

  // ══════════════════════════════════════════════════
  //  QUALITY TESTS
  // ══════════════════════════════════════════════════

  // ────────── POST /api/operations?action=quality-test ──────────
  if (action === 'quality-test' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { collectionId, snf, fat, water } = body;
      if (!collectionId || snf == null || fat == null || water == null) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let resultValue = 'Pass';
      let reasonValue = null;
      if (fat < 3.5) { resultValue = 'Fail'; reasonValue = 'Low FAT'; }
      else if (snf < 8.5) { resultValue = 'Fail'; reasonValue = 'Low SNF'; }
      else if (water > 0.5) { resultValue = 'Fail'; reasonValue = 'Excess Water'; }

      const { data: qtRows, error: qtErr } = await supabase
        .from('quality_tests')
        .insert({ collection_id: collectionId, fat, snf, water, result: resultValue, reason: reasonValue })
        .select('id')
        .single();
      if (qtErr) throw qtErr;
      const newId = qtRows.id;

      await supabase
        .from('milk_collections')
        .update({ quality_result: resultValue, failure_reason: reasonValue })
        .eq('id', collectionId);

      const { data: col, error: cErr } = await supabase
        .from('milk_collections')
        .select('farmer_id, date, farmers (user_id)')
        .eq('id', collectionId)
        .maybeSingle();

      if (col && !cErr) {
        const userId = col.farmers?.user_id;
        const date = col.date;
        const title = resultValue === 'Pass' ? 'Quality Test Passed' : 'Quality Test Failed';
        const message = resultValue === 'Pass'
          ? `Your milk collection on ${date} passed quality testing.`
          : `Your milk collection on ${date} failed quality testing. Reason: ${reasonValue}`;
        if (userId) {
          await supabase.from('notifications').insert({ user_id: userId, title, message, type: 'quality_result' });
        }
      }

      return res.status(201).json({
        id: newId, collectionId, snf, fat, water,
        result: resultValue, reason: reasonValue,
        testedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Quality test error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  DISPATCHES
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=dispatches ──────────
  if (action === 'dispatches' && req.method === 'GET') {
    try {
      let query = supabase
        .from('dispatches')
        .select(`
          id, chilling_center_id, transporter_name, vehicle_number, driver_contact,
          dispatch_date, status, rejection_reason, created_at,
          chilling_centers (name)
        `);

      if (req.query.centerId) {
        query = query.eq('chilling_center_id', req.query.centerId);
      }

      const { data: dispatches, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      for (const d of dispatches) {
        const { data: items, error: iErr } = await supabase
          .from('dispatch_items')
          .select(`
            id, dispatch_id, collection_id,
            milk_collections!inner (
              quantity, quality_result,
              farmers (name)
            )
          `)
          .eq('dispatch_id', d.id);
        if (iErr) throw iErr;

        d.chillingCenterId = d.chilling_center_id;
        d.chillingCenterName = d.chilling_centers?.name;
        d.dispatchDate = d.dispatch_date;
        d.transporterName = d.transporter_name;
        d.vehicleNumber = d.vehicle_number;
        d.driverContact = d.driver_contact;
        d.rejectionReason = d.rejection_reason;
        d.createdAt = d.created_at;

        d.items = items.map((item) => ({
          id: item.id, dispatchId: item.dispatch_id, collectionId: item.collection_id,
          quantity: item.milk_collections?.quantity,
          qualityResult: item.milk_collections?.quality_result,
          farmerName: item.milk_collections?.farmers?.name,
        }));
        d.totalQuantity = d.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
      }

      return res.status(200).json(dispatches);
    } catch (err) {
      console.error('Get dispatches error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/operations?action=create-dispatch ──────────
  if (action === 'create-dispatch' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate, items } = body;
      if (!chillingCenterId || !transporterName || !vehicleNumber || !driverContact || !dispatchDate || !items?.length) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: dResult, error: dErr } = await supabase
        .from('dispatches')
        .insert({
          chilling_center_id: chillingCenterId, transporter_name: transporterName,
          vehicle_number: vehicleNumber, driver_contact: driverContact,
          dispatch_date: dispatchDate,
        })
        .select('id')
        .single();
      if (dErr) throw dErr;
      const dispatchId = dResult.id;

      // 1. Insert dispatch items and update statuses
      // Improved: Handle both camelCase and snake_case from different frontend versions
      const collectionIds = items.map(i => i.collectionId || i.collection_id).filter(id => id != null);
      
      await Promise.all([
        ...items.map(item => 
          supabase.from('dispatch_items').insert({ 
            dispatch_id: dispatchId, 
            collection_id: item.collectionId || item.collection_id 
          })
        ),
        supabase.from('milk_collections')
          .update({ dispatch_status: 'Dispatched' })
          .in('id', collectionIds)
      ]);

      // 2. Fetch all farmers for these collections in one go
      // Improved: Match working pattern by including foreign key column
      const { data: colsData, error: colsErr } = await supabase
        .from('milk_collections')
        .select('farmer_id, date, farmers (user_id)')
        .in('id', collectionIds);

      // 3. Insert all notifications in one go for "instant" feel
      if (!colsErr && colsData) {
        const notifications = colsData
          .filter(c => c && c.farmers && c.farmers.user_id)
          .map(c => ({
            user_id: c.farmers.user_id,
            title: 'milk_dispatched_title',
            message: `milk_dispatched_msg|date:${c.date}`,
            type: 'dispatch_status'
          }));

        if (notifications.length > 0) {
          const { error: notifyErr } = await supabase.from('notifications').insert(notifications);
          if (notifyErr) console.error('Notify Error:', notifyErr);
        }
      } else if (colsErr) {
        console.error('Fetch Error:', colsErr);
      }

      const { data: dispatch, error: fetchErr } = await supabase
        .from('dispatches')
        // ... ...
        .select(`
          id, chilling_center_id, transporter_name, vehicle_number, driver_contact,
          dispatch_date, status, created_at,
          chilling_centers (name)
        `)
        .eq('id', dispatchId)
        .single();
      if (fetchErr) throw fetchErr;

      return res.status(201).json({
        id: dispatch.id, chillingCenterId: dispatch.chilling_center_id,
        chillingCenterName: dispatch.chilling_centers?.name,
        transporterName: dispatch.transporter_name,
        vehicleNumber: dispatch.vehicle_number,
        driverContact: dispatch.driver_contact,
        dispatchDate: dispatch.dispatch_date,
        status: dispatch.status, createdAt: dispatch.created_at,
        items: items.map((item, i) => ({ id: i + 1, dispatchId, collectionId: item.collectionId })),
        totalQuantity: 0,
      });
    } catch (err) {
      console.error('Create dispatch error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/operations?action=dispatch-status&id=X ──────────
  if (action === 'dispatch-status' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const body = getBody(req);
      const { status, reason } = body;
      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Approved or Rejected' });
      }

      await supabase.from('dispatches').update({ status, rejection_reason: reason || null }).eq('id', id);

      // Notify all farmers in this dispatch
      const { data: items, error: iErr } = await supabase
        .from('dispatch_items')
        .select(`
          collection_id,
          milk_collections (
            farmer_id,
            date,
            farmers (user_id)
          )
        `)
        .eq('dispatch_id', id);

      if (!iErr && items && items.length > 0) {
        // 1. Bulk Update status of all milk collections in this dispatch
        const collectionIds = items.map(item => item.collection_id);
        await supabase.from('milk_collections').update({ dispatch_status: status }).in('id', collectionIds);

        // 2. Prepare notifications for all farmers
        const notifications = items
          .filter(item => {
            const mc = item.milk_collections;
            // Handle if it's returns as an array (sometimes happens with Supabase joins)
            const collection = Array.isArray(mc) ? mc[0] : mc;
            return collection?.farmers?.user_id;
          })
          .map(item => {
            const mc = item.milk_collections;
            const collection = Array.isArray(mc) ? mc[0] : mc;
            const titleKey = status === 'Approved' ? 'dispatch_approved_title' : 'dispatch_rejected_title';
            const msgKey = status === 'Approved' ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';
            const params = status === 'Approved' 
              ? `date:${collection.date}` 
              : `date:${collection.date},reason:${reason || 'N/A'}`;
              
            return {
              user_id: collection.farmers.user_id,
              title: titleKey,
              message: `${msgKey}|${params}`,
              type: 'dispatch_status'
            };
          });

        if (notifications.length > 0) {
          const { error: notifyErr } = await supabase.from('notifications').insert(notifications);
          if (notifyErr) console.error('Approval Notify Error:', notifyErr);
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update dispatch status error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  PRICING RULES
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=pricing-rules ──────────
  if (action === 'pricing-rules' && req.method === 'GET') {
    try {
      const { data: rules, error } = await supabase
        .from('pricing_rules')
        .select('id, base_price_per_liter, fat_bonus, snf_bonus, effective_from, is_active, created_at')
        .order('effective_from', { ascending: false });
      if (error) throw error;

      const flattened = rules.map((r) => ({
        id: r.id, basePricePerLiter: r.base_price_per_liter,
        fatBonus: r.fat_bonus, snfBonus: r.snf_bonus,
        effectiveFrom: r.effective_from, isActive: r.is_active, createdAt: r.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get pricing rules error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/operations?action=create-pricing-rule ──────────
  if (action === 'create-pricing-rule' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { basePricePerLiter, fatBonus, snfBonus, effectiveFrom } = body;
      if (!basePricePerLiter || !fatBonus || !snfBonus || !effectiveFrom) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      await supabase.from('pricing_rules').update({ is_active: false }).eq('is_active', true);

      const { data: newRule, error: insertErr } = await supabase
        .from('pricing_rules')
        .insert({
          base_price_per_liter: basePricePerLiter, fat_bonus: fatBonus,
          snf_bonus: snfBonus, effective_from: effectiveFrom, is_active: true,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      return res.status(201).json({
        id: newRule.id,
        basePricePerLiter: parseFloat(basePricePerLiter),
        fatBonus: parseFloat(fatBonus),
        snfBonus: parseFloat(snfBonus),
        effectiveFrom, isActive: true,
      });
    } catch (err) {
      console.error('Create pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/operations?action=update-pricing-rule&id=X ──────────
  if (action === 'update-pricing-rule' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
      const { isActive } = getBody(req);
      
      // If we are activating this rule, deactivate ALL others first
      if (isActive) {
        await supabase.from('pricing_rules').update({ is_active: false }).neq('id', id);
      }

      const { error } = await supabase
        .from('pricing_rules')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
