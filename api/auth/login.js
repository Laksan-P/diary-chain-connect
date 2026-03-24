import supabase from '../../_lib/supabase.js';
import { authenticate, signToken } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Map role for token consistency
    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
    const payload = {
      id: user.id,
      email: user.email,
      role: roleMap[user.role] || user.role,
      name: user.name,
    };

    // If user is farmer, fetch and attach details
    let farmerId = null;
    let farmerCode = null;
    if (user.role === 'farmer') {
      const { data: fRows, error: fErr } = await supabase
        .from('farmers')
        .select('id, farmer_id, address, phone, nic')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fErr) throw fErr;
      if (!fRows) return res.status(401).json({ error: 'Farmer profile no longer exists' });

      farmerId = fRows.id;
      farmerCode = fRows.farmer_id;
      payload.address = fRows.address;
      payload.phone = fRows.phone;
      payload.nic = fRows.nic;

      // Fetch bank details
      const { data: bRows, error: bErr } = await supabase
        .from('bank_accounts')
        .select('bank_name, account_number, branch')
        .eq('farmer_id', farmerId)
        .maybeSingle();

      if (bErr) throw bErr;
      if (bRows) {
        payload.bankName = bRows.bank_name;
        payload.accountNumber = bRows.account_number;
        payload.branch = bRows.branch;
      }
    }

    // If user is chilling_center
    let chillingCenterId = null;
    if (user.role === 'chilling_center') {
      const { data: cc, error: ccErr } = await supabase
        .from('chilling_centers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (ccErr) throw ccErr;
      if (!cc) return res.status(401).json({ error: 'Chilling Center profile no longer exists' });
      chillingCenterId = cc.id;
    }

    // If user is nestle
    let nestleOfficerId = null;
    if (user.role === 'nestle') {
      const { data: off, error: offErr } = await supabase
        .from('nestle_officers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (offErr) throw offErr;
      if (!off) return res.status(401).json({ error: 'Nestle Officer profile no longer exists' });
      nestleOfficerId = off.id;
    }

    const token = signToken(payload);

    res.status(200).json({
      token,
      user: { ...payload, farmerId, farmerCode, chillingCenterId, nestleOfficerId },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
