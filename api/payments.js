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

  // 1. Identification & 2. Cycle Check & 3. Grouping & 4. Pricing & 5. Summary Generation
  if (action === 'cycle-summary' && req.method === 'GET') {
    try {
      // Step 1: Identify only approved milk collections
      const { data: collections, error: colErr } = await supabase
        .from('milk_collections')
        .select(`id, farmer_id, quantity, quality_result, dispatch_status, date, milk_type, created_at, fat, snf`)
        .eq('dispatch_status', 'Approved');

      if (colErr) throw colErr;

      // Filter out those already paid
      const { data: existingPayments } = await supabase.from('payments').select('collection_id');
      const paidIds = new Set(existingPayments?.map(p => p.collection_id) || []);
      const unpaid = (collections || []).filter(c => !paidIds.has(c.id));

      if (unpaid.length === 0) {
        return res.status(200).json({ cycleReached: false, summary: [], message: 'No unpaid approved collections found at this time.' });
      }

      // Step 2: Determine cycle based on the earliest unpaid collection
      const now = new Date();
      const earliestUnpaid = unpaid.reduce((prev, curr) => {
        const d = new Date(curr.date);
        return d < prev ? d : prev;
      }, new Date());

      const earliestDay = earliestUnpaid.getDate();
      const earliestMonth = earliestUnpaid.getMonth();
      const earliestYear = earliestUnpaid.getFullYear();

      let targetDate;
      if (earliestDay <= 15) {
        targetDate = new Date(earliestYear, earliestMonth, 16);
      } else {
        targetDate = new Date(earliestYear, earliestMonth + 1, 1);
      }

      const timeDiff = targetDate.getTime() - now.getTime();
      let daysUntilCycle = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      if (daysUntilCycle < 0) daysUntilCycle = 0; 

      const skipCycle = req.query.skipCycle === 'true';
      const isCycleReached = daysUntilCycle <= 0 || skipCycle;

      const activePeriodSummaryEnd = targetDate;
      const filteredUnpaid = unpaid.filter(u => new Date(u.date) < activePeriodSummaryEnd);

      // Fetch farmer details for the unpaid collections
      const farmerIds = [...new Set(filteredUnpaid.map(c => c.farmer_id))];
      const { data: farmers } = await supabase
        .from('farmers')
        .select('id, name, farmer_id')
        .in('id', farmerIds);

      const farmerMap = (farmers || []).reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});

      // Step 3: Group collections by farmer
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
            totalQty: 0 
          };
        }
        acc[fid].collections.push({
          id: c.id,
          date: c.date,
          quantity: parseFloat(c.quantity || 0),
          milkType: c.milk_type || 'Cow',
          fat: parseFloat(c.fat || 0),
          snf: parseFloat(c.snf || 0)
        });
        acc[fid].collectionIds.push(c.id);
        acc[fid].totalQty += parseFloat(c.quantity || 0);
        return acc;
      }, {});

      // Step 4: Apply pricing rules
      console.log('Fetching active pricing rule...');
      const { data: rule, error: ruleErr } = await supabase
        .from('pricing_rules').select('*').eq('is_active', true)
        .order('effective_from', { ascending: false }).limit(1).maybeSingle();
      
      if (ruleErr) {
        console.error('Error fetching pricing rule:', ruleErr);
        throw ruleErr;
      }
      
      const basePrice = rule ? parseFloat(rule.base_price_per_liter) : 0;
      console.log(`Using base price: Rs. ${basePrice}`);

      // Step 5: Generate payment summary
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
          status: 'Pending'
        };
      });

      return res.status(200).json({ 
        cycleReached: isCycleReached, 
        daysUntilCycle,
        payoutDate: targetDate.toISOString(),
        summary 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
  }

  // 7. Approve & 8. Process & 9. Update Status & 10. Record & 11. Notify
  if (action === 'process-batch' && req.method === 'POST') {
    try {
      const { summaryItems } = getBody(req); // List of grouped farmer data
      if (!summaryItems || !Array.isArray(summaryItems)) return res.status(400).json({ error: 'summaryItems required' });

      for (const item of summaryItems) {
        const { farmerId, collections, collectionIds, totalPayment, totalQty } = item;
        const targetCollections = collectionIds || (Array.isArray(collections) && typeof collections[0] === 'number' ? collections : []);

        const { data: payRecord, error: pErr } = await supabase
          .from('payments')
          .insert({
            farmer_id: farmerId,
            collection_id: targetCollections[0] || (collections[0]?.id),
            quantity: totalQty,
            amount: totalPayment,
            base_pay: totalPayment,
            status: 'Pending'
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
          .in('id', targetCollections);

        // Step 11: Trigger notification to farmer
        const { data: farmerData } = await supabase.from('farmers').select('user_id').eq('id', farmerId).single();
        if (farmerData?.user_id) {
          await supabase.from('notifications').insert({
            user_id: farmerData.user_id,
            title: 'payment_received_title',
            message: `payment_received_msg|amount:${totalPayment},qty:${totalQty}`,
            type: 'payment'
          });
        }

      }

      return res.status(200).json({ success: true, message: 'Batch processed successfully' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to process batch' });
    }
  }

  // Keep list for history
  if (action === 'list' && req.method === 'GET') {
    try {
      let query = supabase
        .from('payments')
        .select(`
          id, farmer_id, collection_id, quantity, base_pay, amount, status, paid_at, created_at,
          farmers (name, farmer_id)
        `);

      if (req.query.farmerId) {
        query = query.eq('farmer_id', req.query.farmerId);
      } else if (req.query.centerId) {
        const { data: ccFarmers } = await supabase.from('farmers').select('id').eq('chilling_center_id', req.query.centerId);
        const ids = ccFarmers?.map(f => f.id) || [];
        query = query.in('farmer_id', ids);
      }

      const { data: payments } = await query.order('collection_id', { ascending: false });
      
      const flattened = payments.map(p => ({
        id: p.id,
        collectionId: p.collection_id,
        farmerName: p.farmers?.name,
        farmerCode: p.farmers?.farmer_id,
        amount: p.amount,
        quantity: p.quantity,
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at
      }));

      return res.status(200).json(flattened);
    } catch (err) { return res.status(500).json({ error: 'Server error' }); }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
