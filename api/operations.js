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

      const updates = { 
        quality_result: resultValue, 
        failure_reason: reasonValue 
      };
      
      // Auto-approve only if tested by Nestle.
      // Chilling center testing should keep status as Pending so it can be dispatched.
      if (resultValue === 'Pass' && user.role === 'nestle') {
        updates.dispatch_status = 'Approved';
      }

      await supabase
        .from('milk_collections')
        .update(updates)
        .eq('id', collectionId);

      const { data: col, error: cErr } = await supabase
        .from('milk_collections')
        .select('farmer_id, date, chilling_center_id, chilling_centers(user_id), farmers (user_id, name)')
        .eq('id', collectionId)
        .maybeSingle();

      if (col && !cErr) {
        const userId = col.farmers?.user_id;
        const farmerName = col.farmers?.name;
        const ccUserId = col.chilling_centers?.user_id;
        const date = col.date;
        let titleKey = resultValue === 'Pass' ? 'quality_test_passed_title' : 'quality_test_failed_title';
        let msgKey = resultValue === 'Pass' ? 'quality_test_passed_msg' : 'quality_test_failed_msg';
        
        // Special mention for Nestle's final check
        if (user.role === 'nestle_officer' || user.role === 'nestle') {
          titleKey = resultValue === 'Pass' ? 'nestle_quality_test_passed_title' : 'nestle_quality_test_failed_title';
          msgKey = resultValue === 'Pass' ? 'nestle_quality_test_passed_msg' : 'nestle_quality_test_failed_msg';
        }

        const params = resultValue === 'Pass'
          ? `date:${date}`
          : `date:${date},reason:${reasonValue || 'N/A'}`;
        
        if (userId) {
          // 1. Send detailed Quality Result notification to Farmer
          await supabase.from('notifications').insert({ user_id: userId, title: titleKey, message: `${msgKey}|${params}`, type: 'quality_result' });
          
          // 2. If tested by Nestle, also send the Dispatch status update notification to Farmer
          if (user.role === 'nestle_officer' || user.role === 'nestle') {
            const dispatchTitle = resultValue === 'Pass' ? 'dispatch_approved_title' : 'dispatch_rejected_title';
            const dispatchMsg = resultValue === 'Pass' ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';
            await supabase.from('notifications').insert({ 
              user_id: userId, 
              title: dispatchTitle, 
              message: `${dispatchMsg}|${params}`, 
              type: 'quality_result' 
            });

            // 3. Notify Chilling Center about Nestlé's verification result (Include Farmer Name)
            if (ccUserId) {
              const ccTitle = resultValue === 'Pass' ? 'cc_collection_passed_nestle_title' : 'cc_collection_rejected_nestle_title';
              const ccMsg = resultValue === 'Pass' ? 'cc_collection_passed_nestle_msg' : 'cc_collection_rejected_nestle_msg';
              await supabase.from('notifications').insert({
                user_id: ccUserId,
                title: ccTitle,
                message: `${ccMsg}|id:${collectionId},farmer:${farmerName},result:${resultValue}${reasonValue ? `,reason:${reasonValue}` : ''}`,
                type: 'quality_result'
              });
            }
          }
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

      // 2. Fetch farmers and users for these collections (Manual Join for robustness)
      const { data: colsData } = await supabase
        .from('milk_collections')
        .select('id, date, farmer_id, farmers (user_id)')
        .in('id', collectionIds);

      // 3. Insert notifications one-by-one (matches working quality-test pattern)
      if (colsData) {
        for (const col of colsData) {
          const userId = col.farmers?.user_id || (Array.isArray(col.farmers) ? col.farmers[0]?.user_id : null);
          if (userId) {
            await supabase.from('notifications').insert({
              user_id: userId,
              title: 'milk_dispatched_title',
              message: `milk_dispatched_msg|date:${col.date}`,
              type: 'quality_result', // Use quality_result for guaranteed DB acceptance
              is_read: false
            });
          }
        }
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

      // 4. Notify all Nestle Officers of Incoming Dispatch
      const { data: nestleUsers } = await supabase.from('users').select('id').eq('role', 'nestle');
      if (nestleUsers && nestleUsers.length > 0) {
        for (const n of nestleUsers) {
          await supabase.from('notifications').insert({
            user_id: n.id,
            title: 'new_dispatch_alert_title',
            message: `new_dispatch_alert_msg|vehicle:${dispatch.vehicle_number},transporter:${dispatch.transporter_name},cc:${dispatch.chilling_centers?.name || 'Unknown'}`,
            type: 'dispatch'
          });
        }
      }

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

      const { data: dispatch, error: dFetchErr } = await supabase
        .from('dispatches')
        .select('chilling_center_id, transporter_name, vehicle_number, chilling_centers(user_id)')
        .eq('id', id)
        .single();
      
      if (dFetchErr) throw dFetchErr;

      await supabase.from('dispatches').update({ status, rejection_reason: reason || null }).eq('id', id);

      // notify CC User (Include Tanker/Vehicle info)
      const ccUserId = dispatch.chilling_centers?.user_id;
      if (ccUserId) {
        const vehicle = dispatch.vehicle_number;
        const transporter = dispatch.transporter_name;
        await supabase.from('notifications').insert({
          user_id: ccUserId,
          title: status === 'Approved' ? 'dispatch_accepted_by_nestle_title' : 'dispatch_rejected_by_nestle_title',
          message: status === 'Approved' 
            ? `dispatch_accepted_by_nestle_msg|id:${id},vehicle:${vehicle},transporter:${transporter}` 
            : `dispatch_rejected_by_nestle_msg|id:${id},vehicle:${vehicle},transporter:${transporter},reason:${reason || 'N/A'}`,
          type: 'dispatch'
        });
      }

      // Fetch dispatch items for this dispatch
      const { data: items } = await supabase
        .from('dispatch_items')
        .select('id, collection_id')
        .eq('dispatch_id', id);

      if (items && items.length > 0) {
        const collectionIds = items.map(item => item.collection_id);
        
        // 1. Bulk Update status
        await supabase.from('milk_collections').update({ dispatch_status: status }).in('id', collectionIds);

        // 2. Fetch collections to get farmer_ids
        const { data: mcData } = await supabase
          .from('milk_collections')
          .select('id, date, farmer_id, farmers (user_id)')
          .in('id', collectionIds);

        if (mcData && mcData.length > 0) {
          for (const col of mcData) {
            const userId = col.farmers?.user_id || (Array.isArray(col.farmers) ? col.farmers[0]?.user_id : null);
            if (userId) {
              const titleKey = status === 'Approved' ? 'dispatch_approved_title' : 'dispatch_rejected_title';
              const msgKey = status === 'Approved' ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';
              const params = status === 'Approved' 
                ? `date:${col.date}` 
                : `date:${col.date},reason:${reason || 'N/A'}`;

              await supabase.from('notifications').insert({
                user_id: userId,
                title: titleKey,
                message: `${msgKey}|${params}`,
                type: 'quality_result',
                is_read: false
              });
            }
          }
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

      const { data: newRule, error: insertErr } = await supabase
        .from('pricing_rules')
        .insert({
          base_price_per_liter: basePricePerLiter, fat_bonus: fatBonus,
          snf_bonus: snfBonus, effective_from: effectiveFrom, is_active: false,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      return res.status(201).json({
        id: newRule.id,
        basePricePerLiter: parseFloat(basePricePerLiter),
        fatBonus: parseFloat(fatBonus),
        snfBonus: parseFloat(snfBonus),
        effectiveFrom, isActive: false,
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

  // ────────── DELETE /api/operations?action=delete-pricing-rule&id=X ──────────
  if (action === 'delete-pricing-rule' && req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
