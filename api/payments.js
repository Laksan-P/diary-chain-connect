import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';
import { getCyclePayoutDate, getCyclePeriod, getCycleDisplayRange } from './_lib/paymentCycle.js';
import {
  buildCycleSummaryMeta,
  getUnpaidApprovedCollections,
  processFarmerSettlement,
} from './_lib/paymentSettlement.js';

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

  if (action === 'cycle-summary' && req.method === 'GET') {
    try {
      const skipCycle = req.query.skipCycle === 'true';
      const unpaid = await getUnpaidApprovedCollections(supabase);

      if (!unpaid.length) {
        return res.status(200).json({
          cycleReached: skipCycle,
          daysUntilCycle: 0,
          summary: [],
          message: skipCycle
            ? 'No eligible approved collections found for settlement.'
            : 'No pending payment summaries for this cycle.',
        });
      }

      const cycleMeta = buildCycleSummaryMeta(unpaid, new Date(), skipCycle);
      const isCycleReached = cycleMeta.cycleReached;

      const farmerIds = [...new Set(unpaid.map(c => c.farmer_id).filter(Boolean))];
      if (!farmerIds.length) {
        return res.status(200).json({
          cycleReached: isCycleReached,
          daysUntilCycle: cycleMeta.daysUntilCycle,
          summary: [],
          message: 'No pending payment summaries for this cycle.',
        });
      }

      const { data: farmers, error: farmersErr } = await supabase
        .from('farmers')
        .select('id, name, farmer_id')
        .in('id', farmerIds);

      if (farmersErr) {
        console.error('[payments:cycle-summary] farmers lookup failed:', farmersErr.message);
        throw farmersErr;
      }

      const farmerMap = (farmers || []).reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});

      const farmerGroups = unpaid.reduce((acc, c) => {
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
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ruleErr) {
        console.error('[payments:cycle-summary] pricing rule lookup failed:', ruleErr.message);
        throw ruleErr;
      }

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

        const earliestDate = f.collections
          .map(c => c.date)
          .filter(Boolean)
          .sort()[0] || new Date().toISOString().slice(0, 10);
        const period = getCyclePeriod(getCyclePayoutDate(earliestDate));
        const cycleKey = `${period.start.toISOString().slice(0, 10)}_${period.end.toISOString().slice(0, 10)}`;
        const { cycleStart, cycleEnd } = getCycleDisplayRange(period);

        return {
          ...f,
          unitPrice: basePrice,
          totalPayment: farmerTotal.toFixed(2),
          status: 'Pending',
          cycleKey,
          cycleStart,
          cycleEnd,
        };
      });

      const earliestUnpaid = unpaid.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0];
      const activePeriod = getCyclePeriod(getCyclePayoutDate(earliestUnpaid.date));

      return res.status(200).json({
        cycleReached: isCycleReached,
        daysUntilCycle: cycleMeta.daysUntilCycle,
        payoutDate: cycleMeta.payoutDate || activePeriod.payoutDate.toISOString(),
        cycleStart: activePeriod.start.toISOString(),
        cycleEnd: activePeriod.end.toISOString(),
        summary,
      });
    } catch (err) {
      console.error('[payments:cycle-summary] Failed to generate summary:', err?.message || err);
      if (err?.stack) console.error(err.stack);
      return res.status(500).json({
        error: 'Failed to generate summary',
        details: err?.message || 'Unknown error',
      });
    }
  }

  if (action === 'process-batch' && req.method === 'POST') {
    try {
      const { summaryItems } = getBody(req);
      if (!summaryItems || !Array.isArray(summaryItems)) {
        return res.status(400).json({ error: 'summaryItems required' });
      }

      const results = [];
      for (const item of summaryItems) {
        results.push(await processFarmerSettlement(supabase, item));
      }

      const processedCount = results.filter(r => r.status === 'processed').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;

      return res.status(200).json({
        success: true,
        processedCount,
        skippedCount,
        results,
        message:
          processedCount > 0
            ? 'Batch processed successfully'
            : skippedCount > 0
              ? 'All summaries were already disbursed'
              : 'No eligible collections remained for this batch',
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
        const { data: ccFarmers } = await supabase
          .from('farmers')
          .select('id')
          .eq('chilling_center_id', req.query.centerId);
        const ids = ccFarmers?.map(f => f.id) || [];
        query = query.in('farmer_id', ids);
      }

      const { data: payments, error } = await query.order('paid_at', { ascending: false });
      if (error) throw error;

      const flattened = (payments || [])
        .filter(p => parseFloat(p.amount || 0) > 0)
        .map(p => ({
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
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
