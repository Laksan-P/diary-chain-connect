import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';
import { resolveActivePaymentCycle } from './_lib/paymentCycle.js';

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

  // 1. Identification & 2. Cycle Check & 3. Grouping & 4. Pricing & 5. Summary Generation
  if (action === 'cycle-summary' && req.method === 'GET') {
    try {
      const { data: collections, error: colErr } = await supabase
        .from('milk_collections')
        .select(`id, farmer_id, quantity, quality_result, dispatch_status, date, milk_type, created_at, fat, snf`)
        .eq('dispatch_status', 'Approved');

      if (colErr) throw colErr;

      const unpaid = collections || [];
      if (unpaid.length === 0) {
        return res.status(200).json({
          cycleReached: false,
          summary: [],
          message: 'No pending payment summaries for this cycle.',
        });
      }

      const skipCycle = req.query.skipCycle === 'true';
      const activeCycle = resolveActivePaymentCycle(unpaid);
      if (!activeCycle || activeCycle.cycleCollections.length === 0) {
        return res.status(200).json({
          cycleReached: false,
          summary: [],
          message: 'No pending payment summaries for this cycle.',
        });
      }

      const { period, cycleCollections, daysUntilCycle, cycleReached, cycleKey } = activeCycle;
      const isCycleReached = cycleReached || skipCycle;
      const filteredUnpaid = cycleCollections;

      const farmerIds = [...new Set(filteredUnpaid.map(c => c.farmer_id))];
      const { data: farmers } = await supabase
        .from('farmers')
        .select('id, name, farmer_id')
        .in('id', farmerIds);

      const farmerMap = (farmers || []).reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});

      const farmerGroups = filteredUnpaid.reduce((acc, c) => {
        const fid = c.farmer_id;
        const fData = farmerMap[fid] || {};
        if (!acc[fid]) {
          acc[fid] = {
            farmerId: fid,
            farmerName: fData.name || 'Unknown',
            farmerCode: fData.farmer_id || 'N/A',
            collections: [],
            collectionIds: [],
            totalQty: 0,
          };
        }
        acc[fid].collections.push({
          id: c.id,
          date: c.date,
          quantity: parseFloat(c.quantity || 0),
          milkType: c.milk_type || 'Cow',
          fat: parseFloat(c.fat || 0),
          snf: parseFloat(c.snf || 0),
        });
        acc[fid].collectionIds.push(c.id);
        acc[fid].totalQty += parseFloat(c.quantity || 0);
        return acc;
      }, {});

      const { data: rule, error: ruleErr } = await supabase
        .from('pricing_rules').select('*').eq('is_active', true)
        .order('effective_from', { ascending: false }).limit(1).maybeSingle();

      if (ruleErr) throw ruleErr;

      const basePrice = rule ? parseFloat(rule.base_price_per_liter) : 0;

      const summary = Object.values(farmerGroups).map(f => {
        let farmerTotal = 0;
        f.collections.forEach(col => {
          const fatRate = rule ? parseFloat(rule.fat_bonus || 0) : 0;
          const snfRate = rule ? parseFloat(rule.snf_bonus || 0) : 0;

          const fBonus = Math.max(0, (col.fat - 3.5) * fatRate);
          const sBonus = Math.max(0, (col.snf - 8.5) * snfRate);
          const finalRate = basePrice + fBonus + sBonus;

          farmerTotal += col.quantity * finalRate;
        });

        return {
          ...f,
          unitPrice: basePrice,
          totalPayment: farmerTotal.toFixed(2),
          status: 'Pending',
          cycleKey,
        };
      });

      return res.status(200).json({
        cycleReached: isCycleReached,
        daysUntilCycle,
        payoutDate: period.payoutDate.toISOString(),
        cycleStart: period.start.toISOString(),
        cycleEnd: period.end.toISOString(),
        cycleKey,
        summary,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
  }

  // 7. Approve & 8. Process & 9. Update Status & 10. Record & 11. Notify
  if (action === 'process-batch' && req.method === 'POST') {
    try {
      const { summaryItems } = getBody(req);
      if (!summaryItems || !Array.isArray(summaryItems)) {
        return res.status(400).json({ error: 'summaryItems required' });
      }

      let processedCount = 0;

      for (const item of summaryItems) {
        const { farmerId, collections, collectionIds, totalPayment, totalQty } = item;
        const requestedIds = collectionIds || (
          Array.isArray(collections) && typeof collections[0] === 'number'
            ? collections
            : (collections || []).map(c => c.id)
        );

        if (!requestedIds?.length) continue;

        const { data: collectionRows, error: colLookupErr } = await supabase
          .from('milk_collections')
          .select('id, dispatch_status, date')
          .in('id', requestedIds);

        if (colLookupErr) throw colLookupErr;

        const eligibleIds = (collectionRows || [])
          .filter(c => c.dispatch_status === 'Approved')
          .map(c => c.id);

        if (eligibleIds.length === 0) continue;

        const { data: payRecord, error: pErr } = await supabase
          .from('payments')
          .insert({
            farmer_id: farmerId,
            collection_id: eligibleIds[0],
            quantity: totalQty,
            amount: totalPayment,
            base_pay: totalPayment,
            status: 'Pending',
          })
          .select('id')
          .single();

        if (pErr) throw pErr;

        await supabase
          .from('payments')
          .update({ status: 'Paid', paid_at: new Date().toISOString() })
          .eq('id', payRecord.id);

        await supabase
          .from('milk_collections')
          .update({ dispatch_status: 'Paid' })
          .in('id', eligibleIds);

        const { data: farmerData } = await supabase.from('farmers').select('user_id').eq('id', farmerId).single();
        if (farmerData?.user_id) {
          await supabase.from('notifications').insert({
            user_id: farmerData.user_id,
            title: 'payment_received_title',
            message: `payment_received_msg|amount:${totalPayment},qty:${totalQty}`,
            type: 'payment',
          });
        }

        processedCount += 1;
      }

      return res.status(200).json({
        success: true,
        processedCount,
        message: processedCount > 0
          ? 'Batch processed successfully'
          : 'No eligible collections remained for this cycle batch.',
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to process batch' });
    }
  }

  if (action === 'list' && req.method === 'GET') {
    try {
      let query = supabase
        .from('payments')
        .select(`
          id, farmer_id, collection_id, quantity, base_pay, amount, status, paid_at, created_at,
          farmers (name, farmer_id)
        `)
        .eq('status', 'Paid');

      if (req.query.farmerId) {
        query = query.eq('farmer_id', req.query.farmerId);
      } else if (req.query.centerId) {
        const { data: ccFarmers } = await supabase.from('farmers').select('id').eq('chilling_center_id', req.query.centerId);
        const ids = ccFarmers?.map(f => f.id) || [];
        query = query.in('farmer_id', ids);
      }

      const { data: payments } = await query.order('paid_at', { ascending: false });

      const flattened = (payments || []).map(p => ({
        id: p.id,
        collectionId: p.collection_id,
        farmerName: p.farmers?.name,
        farmerCode: p.farmers?.farmer_id,
        amount: p.amount,
        quantity: p.quantity,
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) { return res.status(500).json({ error: 'Server error' }); }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
