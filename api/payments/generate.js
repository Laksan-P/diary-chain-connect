import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = authenticate(req, res);
  if (!user) return;

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
    if (col.dispatch_status !== 'Approved')
      return res.status(400).json({ error: 'Only approved collections can be paid' });

    // Check if already paid
    const { data: exPay } = await supabase
      .from('payments')
      .select('id')
      .eq('collection_id', collectionId)
      .maybeSingle();
    if (exPay) return res.status(409).json({ error: 'Payment already exists' });

    // Active pricing
    const { data: rule } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rule) return res.status(400).json({ error: 'No active pricing rule' });

    // Quality test
    const { data: qt } = await supabase
      .from('quality_tests')
      .select('fat, snf')
      .eq('collection_id', collectionId)
      .maybeSingle();
    const quality = qt || { fat: 0, snf: 0 };

    const quantity = parseFloat(col.quantity);
    const basePay = quantity * parseFloat(rule.base_price_per_liter);
    const fatBonus = quantity * parseFloat(rule.fat_bonus) * (parseFloat(quality.fat) / 100);
    const snfBonus = quantity * parseFloat(rule.snf_bonus) * (parseFloat(quality.snf) / 100);
    const totalAmount = basePay + fatBonus + snfBonus;

    const { data: pay, error: pErr } = await supabase
      .from('payments')
      .insert({
        farmer_id: col.farmer_id,
        collection_id: collectionId,
        quantity,
        base_pay: basePay.toFixed(2),
        fat_bonus: fatBonus.toFixed(2),
        snf_bonus: snfBonus.toFixed(2),
        amount: totalAmount.toFixed(2),
      })
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
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Generate payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
