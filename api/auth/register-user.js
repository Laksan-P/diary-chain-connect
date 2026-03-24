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
    const { name, email, password, role, bankName, accountNumber, branch, location, designation } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    if (!['nestle', 'chilling_center'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { data: userResult, error: uErr } = await supabase
      .from('users')
      .insert({ email, password_hash: hash, name, role })
      .select('id')
      .single();
    if (uErr) throw uErr;
    const userId = userResult.id;

    let chillingCenterId = null;
    let nestleOfficerId = null;

    if (role === 'chilling_center') {
      const { data: cc, error: ccErr } = await supabase
        .from('chilling_centers')
        .insert({ name, location: location || 'Default Location', user_id: userId })
        .select('id')
        .single();
      if (ccErr) throw ccErr;
      chillingCenterId = cc.id;

      if (bankName || accountNumber || branch) {
        await supabase.from('chilling_center_accounts').insert({
          chilling_center_id: chillingCenterId,
          bank_name: bankName || '',
          account_number: accountNumber || '',
          branch: branch || '',
        });
      }
    }

    if (role === 'nestle') {
      const { data: off, error: offErr } = await supabase
        .from('nestle_officers')
        .insert({ name, designation: designation || 'Officer', user_id: userId })
        .select('id')
        .single();
      if (offErr) throw offErr;
      nestleOfficerId = off.id;

      if (bankName || accountNumber || branch) {
        await supabase.from('nestle_officer_accounts').insert({
          nestle_officer_id: nestleOfficerId,
          bank_name: bankName || '',
          account_number: accountNumber || '',
          branch: branch || '',
        });
      }
    }

    // Map role for token consistency
    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center' };
    const payload = { id: userId, email, role: roleMap[role] || role, name };
    const token = signToken(payload);

    res.status(201).json({
      token,
      user: { ...payload, chillingCenterId, nestleOfficerId },
    });
  } catch (err) {
    console.error('Register user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
