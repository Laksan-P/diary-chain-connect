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

  // ────────── GET /api/farmers?action=list ──────────
  if (action === 'list' && req.method === 'GET') {
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

      const result = farmers.map((f) => {
        const totalQuantity = (f.milk_collections || []).reduce(
          (sum, mc) => sum + parseFloat(mc.quantity || 0), 0
        );
        return {
          id: f.id, farmerId: f.farmer_id, userId: f.user_id,
          name: f.name, address: f.address, phone: f.phone, nic: f.nic,
          chillingCenterId: f.chilling_center_id,
          chillingCenterName: f.chilling_centers?.name,
          totalQuantity, createdAt: f.created_at,
        };
      });

      result.sort((a, b) => b.totalQuantity - a.totalQuantity);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Get farmers error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/farmers?action=get&id=X ──────────
  if (action === 'get' && req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const { data: f, error } = await supabase
        .from('farmers')
        .select(`
          id, farmer_id, user_id, name, address, phone, nic, chilling_center_id,
          chilling_centers (name),
          milk_collections (quantity),
          created_at
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!f) return res.status(404).json({ error: 'Farmer not found' });

      const { data: ba } = await supabase
        .from('bank_accounts')
        .select('bank_name, account_number, branch')
        .eq('farmer_id', f.id)
        .maybeSingle();

      const bank = ba || {};

      const totalQuantity = (f.milk_collections || []).reduce(
        (sum, mc) => sum + parseFloat(mc.quantity || 0), 0
      );

      return res.status(200).json({
        id: f.id, farmerId: f.farmer_id, userId: f.user_id,
        name: f.name, address: f.address, phone: f.phone, nic: f.nic,
        chillingCenterId: f.chilling_center_id,
        chillingCenterName: f.chilling_centers?.name,
        bank_name: bank.bank_name || '',
        bankName: bank.bank_name || '',
        account_number: bank.account_number || '',
        accountNumber: bank.account_number || '',
        branch: bank.branch || '',
        totalQuantity, createdAt: f.created_at,
      });
    } catch (err) {
      console.error('Get farmer error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/farmers?action=update&id=X ──────────
  if (action === 'update' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const body = getBody(req);
      const { name, address, phone, nic, bank_name, account_number, branch } = body;

      const { data: f, error: fErr } = await supabase
        .from('farmers').select('user_id').eq('id', id).single();
      if (fErr || !f) return res.status(404).json({ error: 'Farmer not found' });

      if (user.role === 'farmer' && user.id !== f.user_id) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Check for duplicate NIC (exclude current farmer)
      if (nic && nic.trim() !== '') {
        const { data: existingNic } = await supabase
          .from('farmers').select('id').eq('nic', nic).neq('id', id).maybeSingle();
        if (existingNic) {
          return res.status(409).json({ error: 'NIC already registered by another farmer' });
        }
      }

      // Check for duplicate phone (exclude current farmer)
      if (phone && phone.trim() !== '') {
        const { data: existingPhone } = await supabase
          .from('farmers').select('id').eq('phone', phone).neq('id', id).maybeSingle();
        if (existingPhone) {
          return res.status(409).json({ error: 'Phone number already registered by another farmer' });
        }
      }

      await supabase.from('farmers').update({ name, address, phone, nic }).eq('id', id);
      await supabase.from('users').update({ name }).eq('id', f.user_id);

      // Handle bank accounts table update/insert
      const { data: exba } = await supabase
        .from('bank_accounts').select('id').eq('farmer_id', id).maybeSingle();
      
      if (exba) {
        await supabase.from('bank_accounts').update({
          bank_name: bank_name || '', 
          account_number: account_number || '', 
          branch: branch || '',
        }).eq('farmer_id', id);
      } else {
        await supabase.from('bank_accounts').insert({
          farmer_id: parseInt(id), 
          bank_name: bank_name || '', 
          account_number: account_number || '', 
          branch: branch || '',
        });
      }

      return res.status(200).json({ success: true, message: 'Profile updated' });
    } catch (err) {
      console.error('Update farmer error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/farmers?action=bank-account&id=X ──────────
  if (action === 'bank-account' && req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const { data: ba, error } = await supabase
        .from('bank_accounts')
        .select('id, farmer_id, bank_name, account_number, branch')
        .eq('farmer_id', id)
        .maybeSingle();

      if (error) throw error;
      if (!ba) return res.status(200).json(null);

      return res.status(200).json({
        id: ba.id, farmerId: ba.farmer_id,
        bankName: ba.bank_name, accountNumber: ba.account_number, branch: ba.branch,
      });
    } catch (err) {
      console.error('Get bank info error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
