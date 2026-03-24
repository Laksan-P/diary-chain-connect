const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments — list all or filter by farmerId
router.get('/', authenticate, async (req, res) => {
  try {
    let query = supabase
      .from('payments')
      .select(`
        id, farmer_id, collection_id, quantity, base_pay, fat_bonus, snf_bonus, amount, status, paid_at, created_at,
        farmers (name, farmer_id),
        milk_collections (date, quality_result, dispatch_status)
      `);

    if (req.query.farmerId) {
      query = query.eq('farmer_id', req.query.farmerId);
    }

    const { data: payments, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;

    const flattened = payments.map(p => ({
      id: p.id,
      farmerId: p.farmer_id,
      farmerName: p.farmers?.name,
      farmerCode: p.farmers?.farmer_id,
      collectionId: p.collection_id,
      quantity: p.quantity,
      basePay: p.base_pay,
      fatBonus: p.fat_bonus,
      snfBonus: p.snf_bonus,
      amount: p.amount,
      status: p.status,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      collectionDate: p.milk_collections?.date,
      qualityResult: p.milk_collections?.quality_result,
      dispatchStatus: p.milk_collections?.dispatch_status
    }));

    res.json(flattened);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/generate — generate payment for an approved collection
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { collectionId } = req.body;
    if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

    // Check collection
    const { data: col, error: colErr } = await supabase
       .from('milk_collections')
       .select('*, farmers(name, farmer_id)')
       .eq('id', collectionId)
       .maybeSingle();

    if (colErr || !col) return res.status(404).json({ error: 'Collection not found' });
    if (col.dispatch_status !== 'Approved') return res.status(400).json({ error: 'Only approved collections can be paid' });

    // Check if paid
    const { data: exPay } = await supabase.from('payments').select('id').eq('collection_id', collectionId).maybeSingle();
    if (exPay) return res.status(409).json({ error: 'Payment already exists' });

    // Active pricing
    const { data: rule } = await supabase.from('pricing_rules').select('*').eq('is_active', true).order('effective_from', { ascending: false }).limit(1).maybeSingle();
    if (!rule) return res.status(400).json({ error: 'No active pricing rule' });

    // Quality test
    const { data: qt } = await supabase.from('quality_tests').select('fat, snf').eq('collection_id', collectionId).maybeSingle();
    const quality = qt || { fat: 0, snf: 0 };

    const quantity = parseFloat(col.quantity);
    const basePay = quantity * parseFloat(rule.base_price_per_liter);
    const fatBonus = quantity * parseFloat(rule.fat_bonus) * (parseFloat(quality.fat) / 100);
    const snfBonus = quantity * parseFloat(rule.snf_bonus) * (parseFloat(quality.snf) / 100);
    const totalAmount = basePay + fatBonus + snfBonus;

    const { data: pay, error: pErr } = await supabase
       .from('payments')
       .insert({ farmer_id: col.farmer_id, collection_id: collectionId, quantity, base_pay: basePay.toFixed(2), fat_bonus: fatBonus.toFixed(2), snf_bonus: snfBonus.toFixed(2), amount: totalAmount.toFixed(2) })
       .select('id')
       .single();
    
    if (pErr) throw pErr;

    res.status(201).json({
      id: pay.id,
      farmerId: col.farmer_id,
      farmerName: col.farmers?.name,
      farmerCode: col.farmers?.farmer_id,
      collectionId,
      quantity,
      basePay: parseFloat(basePay.toFixed(2)),
      fatBonus: parseFloat(fatBonus.toFixed(2)),
      snfBonus: parseFloat(snfBonus.toFixed(2)),
      amount: parseFloat(totalAmount.toFixed(2)),
      status: 'Pending',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Generate payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/payments/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (status !== 'Paid') return res.status(400).json({ error: 'Status must be Paid' });

    await supabase.from('payments').update({ status: 'Paid', paid_at: new Date().toISOString() }).eq('id', req.params.id);

    // Notification
    const { data: p } = await supabase
       .from('payments')
       .select('amount, farmers!inner(user_id)')
       .eq('id', req.params.id)
       .maybeSingle();

    if (p && p.farmers?.user_id) {
       const user_id = p.farmers.user_id;
       const amount = p.amount;
       await supabase.from('notifications').insert({ user_id, title: 'Payment Completed', message: `Payment of Rs. ${parseFloat(amount).toLocaleString()} has been credited.`, type: 'payment' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
