import supabase from '../../_lib/supabase.js';
import { signToken } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = req.body;
    if (!email || !password || !name || !chillingCenterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check duplicate email
    const { data: existingEmail, error: eErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (eErr) throw eErr;
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const { data: existingNic, error: nicErr } = await supabase
        .from('farmers')
        .select('id')
        .eq('nic', nic)
        .maybeSingle();
      if (nicErr) throw nicErr;
      if (existingNic) return res.status(409).json({ error: 'NIC already registered' });
    }

    // Check duplicate Phone
    if (phone && phone.trim() !== '') {
      const { data: existingPhone, error: phoneErr } = await supabase
        .from('farmers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (phoneErr) throw phoneErr;
      if (existingPhone) return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Insert user
    const { data: userResult, error: uErr } = await supabase
      .from('users')
      .insert({ email, password_hash: hash, name, role: 'farmer' })
      .select('id')
      .single();
    if (uErr) throw uErr;
    const userId = userResult.id;

    // Generate farmer ID
    const { count: farmerCount, error: countErr } = await supabase
      .from('farmers')
      .select('*', { count: 'exact', head: true });
    if (countErr) throw countErr;
    const farmerCode = `FRM-${String(farmerCount + 1).padStart(3, '0')}`;

    // Insert farmer
    const { data: farmerResult, error: fErr } = await supabase
      .from('farmers')
      .insert({
        farmer_id: farmerCode,
        user_id: userId,
        name,
        address: address || '',
        phone: phone || '',
        nic: nic || '',
        chilling_center_id: chillingCenterId,
      })
      .select('id')
      .single();
    if (fErr) throw fErr;
    const farmerIdGenerated = farmerResult.id;

    if (bankName || accountNumber || branch) {
      await supabase.from('bank_accounts').insert({
        farmer_id: farmerIdGenerated,
        bank_name: bankName || '',
        account_number: accountNumber || '',
        branch: branch || '',
      });
    }

    const payload = { id: userId, email, role: 'farmer', name };
    const token = signToken(payload);

    res.status(201).json({
      token,
      user: {
        ...payload,
        farmerId: farmerIdGenerated,
        farmerCode,
        address,
        phone,
        nic,
        bankName: bankName || '',
        accountNumber: accountNumber || '',
        branch: branch || '',
      },
    });
  } catch (err) {
    console.error('Register farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
