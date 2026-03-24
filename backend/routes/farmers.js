const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/farmers — list all farmers sorted by total supplied quantity
router.get('/', authenticate, async (req, res) => {
  try {
    const { data: farmers, error } = await supabase
      .from('farmers')
      .select(`
        id, farmer_id, user_id, name, address, phone, nic, chilling_center_id, 
        chilling_centers (name),
        milk_collections (quantity),
        created_at
      `);
    
    if (error) throw error;

    // Flatten and compute totals manually as SDK doesn't support complex group-by natively well without RPC
    const result = farmers.map(f => {
      const totalQuantity = (f.milk_collections || []).reduce((sum, mc) => sum + parseFloat(mc.quantity || 0), 0);
      return {
        id: f.id,
        farmerId: f.farmer_id,
        userId: f.user_id,
        name: f.name,
        address: f.address,
        phone: f.phone,
        nic: f.nic,
        chillingCenterId: f.chilling_center_id,
        chillingCenterName: f.chilling_centers?.name,
        totalQuantity,
        createdAt: f.created_at
      };
    });

    result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    res.json(result);
  } catch (err) {
    console.error('Get farmers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/farmers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: f, error } = await supabase
      .from('farmers')
      .select(`
        id, farmer_id, user_id, name, address, phone, nic, chilling_center_id,
        chilling_centers (name),
        milk_collections (quantity),
        created_at
      `)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!f) return res.status(404).json({ error: 'Farmer not found' });

    const totalQuantity = (f.milk_collections || []).reduce((sum, mc) => sum + parseFloat(mc.quantity || 0), 0);
    const result = {
      id: f.id,
      farmerId: f.farmer_id,
      userId: f.user_id,
      name: f.name,
      address: f.address,
      phone: f.phone,
      nic: f.nic,
      chillingCenterId: f.chilling_center_id,
      chillingCenterName: f.chilling_centers?.name,
      totalQuantity,
      createdAt: f.created_at
    };

    res.json(result);
  } catch (err) {
    console.error('Get farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/farmers/:id/bank-account
router.get('/:id/bank-account', authenticate, async (req, res) => {
  try {
    const { data: ba, error } = await supabase
      .from('bank_accounts')
      .select('id, farmer_id, bank_name, account_number, branch')
      .eq('farmer_id', req.params.id)
      .maybeSingle();
    
    if (error) throw error;
    if (!ba) return res.json(null);

    res.json({
      id: ba.id,
      farmerId: ba.farmer_id,
      bankName: ba.bank_name,
      accountNumber: ba.account_number,
      branch: ba.branch
    });
  } catch (err) {
    console.error('Get bank info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/farmers/:id — Update farmer profile
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { name, address, phone, nic, bankName, accountNumber, branch } = req.body;
    const farmerId = req.params.id;

    // Check if farmer exists
    const { data: f, error: fErr } = await supabase.from('farmers').select('user_id').eq('id', farmerId).single();
    if (fErr || !f) return res.status(404).json({ error: 'Farmer not found' });

    // Permissions check
    if (req.user.role === 'farmer' && req.user.id !== f.user_id) {
       return res.status(403).json({ error: 'Permission denied' });
    }

    // Update farmer
    await supabase.from('farmers').update({ name, address, phone, nic }).eq('id', farmerId);
    
    // Update user
    await supabase.from('users').update({ name }).eq('id', f.user_id);

    // Update/Insert Bank Account
    if (bankName !== undefined || accountNumber !== undefined) {
      const { data: exba } = await supabase.from('bank_accounts').select('id').eq('farmer_id', farmerId).maybeSingle();
      if (exba) {
         await supabase.from('bank_accounts').update({ bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' }).eq('farmer_id', farmerId);
      } else {
         await supabase.from('bank_accounts').insert({ farmer_id: farmerId, bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' });
      }
    }

    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('Update farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
