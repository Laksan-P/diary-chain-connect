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
        .select(`id, farmer_id, quantity, quality_result, dispatch_status, date, created_at`)
        .eq('dispatch_status', 'Approved');

      if (colErr) throw colErr;

      // Filter out those already paid
      const { data: existingPayments } = await supabase.from('payments').select('collection_id');
      const paidIds = new Set(existingPayments?.map(p => p.collection_id) || []);
      const unpaid = (collections || []).filter(c => !paidIds.has(c.id));

      if (unpaid.length === 0) {
        return res.status(200).json({ cycleReached: false, summary: [], message: 'No unpaid approved collections found at this time.' });
      }

      // Step 2: Determine cycle based on the earliest unpaid collection (to prevent jumping cycles)
      const now = new Date();
      
      // Find the earliest unpaid collection date
      const earliestUnpaid = unpaid.reduce((prev, curr) => {
        const d = new Date(curr.date);
        return d < prev ? d : prev;
      }, new Date());

      const earliestDay = earliestUnpaid.getDate();
      const earliestMonth = earliestUnpaid.getMonth();
      const earliestYear = earliestUnpaid.getFullYear();

      let targetDate;
      if (earliestDay <= 15) {
        // Earliest unpaid data is in Period 1 (1st-15th). Target settlement is 16th.
        targetDate = new Date(earliestYear, earliestMonth, 16);
      } else {
        // Earliest unpaid data is in Period 2 (16th-End). Target settlement is 1st of next month.
        targetDate = new Date(earliestYear, earliestMonth + 1, 1);
      }

      // Check if the current time has passed the target settlement date
      const timeDiff = targetDate.getTime() - now.getTime();
      let daysUntilCycle = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      // Standardize: If it's today (the target date), daysUntilCycle should be 0 (Ready)
      if (daysUntilCycle < 0) daysUntilCycle = 0; 

      const skipCycle = req.query.skipCycle === 'true';
      const isCycleReached = daysUntilCycle <= 0 || skipCycle;

      // Ensure we only include summary items that BELONG to the current active period
      // (Farmers shouldn't be paid for P2 collections if we are still processing P1)
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
      console.log('Grouping by farmer...');
      const farmerGroups = filteredUnpaid.reduce((acc, c) => {
        const fid = c.farmer_id;
        const fData = farmerMap[fid] || {};
        if (!acc[fid]) {
          acc[fid] = { 
            farmerId: fid, 
            farmerName: fData.name || 'Unknown', 
            farmerCode: fData.farmer_id || 'N/A',
            collections: [], 
            totalQty: 0 
          };
        }
        acc[fid].collections.push(c.id);
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
      const summary = Object.values(farmerGroups).map(f => ({
        ...f,
        unitPrice: basePrice,
        totalPayment: (f.totalQty * basePrice).toFixed(2),
        status: 'Pending'
      }));

      return res.status(200).json({ 
        cycleReached: isCycleReached, 
        daysUntilCycle,
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
        const { farmerId, collections, totalPayment, totalQty } = item;

        // Step 10: Record payment details (Create individual payments for tracking)
        // Note: For simplicity, creating one combined record or 1:1. 
        // Flow says "Group collections by farmer" -> "Record payment details".
        // We'll create one payment entry for the batch of collections.
        const { data: payRecord, error: pErr } = await supabase
          .from('payments')
          .insert({
            farmer_id: farmerId,
            collection_id: collections[0], // Linking to primary collection
            quantity: totalQty,
            amount: totalPayment,
            base_pay: totalPayment,
            status: 'Pending' // Will mark as Paid instantly in step 8
          })
          .select('id')
          .single();
        
        if (pErr) throw pErr;

        // Step 8: Process & Step 9: Update status to Paid
        await supabase
          .from('payments')
          .update({ status: 'Paid', paid_at: new Date().toISOString() })
          .eq('id', payRecord.id);

        // Update all associated collections status (Simulated with dispatch_status or ideally a payment_status)
        await supabase
          .from('milk_collections')
          .update({ dispatch_status: 'Paid' })
          .in('id', collections);

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
