import supabase from './_lib/supabase.js';
import { authenticate, signToken } from './_lib/auth.js';
import { cors } from './_lib/cors.js';
import bcrypt from 'bcryptjs';

/**
 * Safely parse request body.
 * Vercel usually auto-parses JSON, but if Content-Type is missing
 * or body arrives as a string, this handles it gracefully.
 */
function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const { action } = req.query;
  const body = getBody(req);

  // Debug logging — visible in Vercel function logs
  console.log("METHOD:", req.method);
  console.log("ACTION:", action);
  console.log("BODY:", body);

  // ────────── POST /api/auth?action=login ──────────
  if (action === 'login' && req.method === 'POST') {
    try {
      const { email, password } = body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      console.log('DB USER:', data, error);

      if (error) {
        console.error('[AUTH:login] Supabase query error:', error);
        throw error;
      }
      if (!data) {
        return res.status(401).json({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, data.password_hash);
      if (!isMatch) {
        console.log('[AUTH:login] Password mismatch');
        return res.status(401).json({ error: 'Wrong password' });
      }

      const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
      const payload = {
        id: data.id,
        email: data.email,
        role: roleMap[data.role] || data.role,
        name: data.name,
      };

      let farmerId = null;
      let farmerCode = null;
      if (data.role === 'farmer') {
        const { data: fRows, error: fErr } = await supabase
          .from('farmers')
          .select('id, farmer_id, address, phone, nic')
          .eq('user_id', data.id)
          .maybeSingle();

        if (fErr) throw fErr;
        if (!fRows) return res.status(401).json({ error: 'Farmer profile no longer exists' });

        farmerId = fRows.id;
        farmerCode = fRows.farmer_id;
        payload.address = fRows.address;
        payload.phone = fRows.phone;
        payload.nic = fRows.nic;

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

      let chillingCenterId = null;
      if (data.role === 'chilling_center') {
        const { data: cc, error: ccErr } = await supabase
          .from('chilling_centers')
          .select('id')
          .eq('user_id', data.id)
          .maybeSingle();
        if (ccErr) throw ccErr;
        if (!cc) return res.status(401).json({ error: 'Chilling Center profile no longer exists' });
        chillingCenterId = cc.id;
      }

      let nestleOfficerId = null;
      if (data.role === 'nestle') {
        const { data: off, error: offErr } = await supabase
          .from('nestle_officers')
          .select('id')
          .eq('user_id', data.id)
          .maybeSingle();
        if (offErr) throw offErr;
        if (!off) return res.status(401).json({ error: 'Nestle Officer profile no longer exists' });
        nestleOfficerId = off.id;
      }

      const token = signToken(payload);

      console.log('[AUTH:login] Login successful for:', email);

      return res.status(200).json({
        token,
        user: { ...payload, farmerId, farmerCode, chillingCenterId, nestleOfficerId },
      });
    } catch (err) {
      console.error('LOGIN ERROR:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ────────── POST /api/auth?action=register-farmer ──────────
  if (action === 'register-farmer' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = body;
      if (!email || !password || !name || !chillingCenterId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: existingEmail, error: eErr } = await supabase
        .from('users').select('id').eq('email', email).maybeSingle();
      if (eErr) throw eErr;
      if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

      if (nic && nic.trim() !== '') {
        const { data: existingNic, error: nicErr } = await supabase
          .from('farmers').select('id').eq('nic', nic).maybeSingle();
        if (nicErr) throw nicErr;
        if (existingNic) return res.status(409).json({ error: 'NIC already registered' });
      }

      if (phone && phone.trim() !== '') {
        const { data: existingPhone, error: phoneErr } = await supabase
          .from('farmers').select('id').eq('phone', phone).maybeSingle();
        if (phoneErr) throw phoneErr;
        if (existingPhone) return res.status(409).json({ error: 'Phone number already registered' });
      }

      const hash = await bcrypt.hash(password, 10);

      const { data: userResult, error: uErr } = await supabase
        .from('users')
        .insert({ email, password_hash: hash, name, role: 'farmer' })
        .select('id')
        .single();
      if (uErr) throw uErr;
      const userId = userResult.id;

      const { count: farmerCount, error: countErr } = await supabase
        .from('farmers').select('*', { count: 'exact', head: true });
      if (countErr) throw countErr;
      const farmerCode = `FRM-${String(farmerCount + 1).padStart(3, '0')}`;

      const { data: farmerResult, error: fErr } = await supabase
        .from('farmers')
        .insert({
          farmer_id: farmerCode, user_id: userId, name,
          address: address || '', phone: phone || '', nic: nic || '',
          chilling_center_id: chillingCenterId,
        })
        .select('id')
        .single();
      if (fErr) throw fErr;
      const farmerIdGenerated = farmerResult.id;

      if (bankName || accountNumber || branch) {
        await supabase.from('bank_accounts').insert({
          farmer_id: farmerIdGenerated, bank_name: bankName || '',
          account_number: accountNumber || '', branch: branch || '',
        });
      }

      const payload = { id: userId, email, role: 'farmer', name };
      const token = signToken(payload);

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'registration_successful_title',
        message: `registration_welcome_msg|name:${name},code:${farmerCode}`,
        type: 'general'
      });

      return res.status(201).json({
        token,
        user: {
          ...payload, farmerId: farmerIdGenerated, farmerCode,
          address, phone, nic,
          bankName: bankName || '', accountNumber: accountNumber || '', branch: branch || '',
        },
      });

    } catch (err) {
      console.error('[AUTH:register-farmer] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/auth?action=register-farmer-by-center ──────────
  if (action === 'register-farmer-by-center' && req.method === 'POST') {
    const user = authenticate(req, res);
    if (!user) return;

    try {
      const body = getBody(req);
      const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = body;
      if (!email || !password || !name || !chillingCenterId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

      if (nic && nic.trim() !== '') {
        const { data: existingNic } = await supabase.from('farmers').select('id').eq('nic', nic).maybeSingle();
        if (existingNic) return res.status(409).json({ error: 'NIC already registered' });
      }

      if (phone && phone.trim() !== '') {
        const { data: existingPhone } = await supabase.from('farmers').select('id').eq('phone', phone).maybeSingle();
        if (existingPhone) return res.status(409).json({ error: 'Phone number already registered' });
      }

      const hash = await bcrypt.hash(password, 10);
      const { data: userResult, error: uErr } = await supabase
        .from('users')
        .insert({ email, password_hash: hash, name, role: 'farmer' })
        .select('id')
        .single();
      if (uErr) throw uErr;
      const userId = userResult.id;

      const { count: farmerCount } = await supabase.from('farmers').select('*', { count: 'exact', head: true });
      const farmerCode = `FRM-${String(farmerCount + 1).padStart(3, '0')}`;

      const { data: farmerResult, error: fErr } = await supabase
        .from('farmers')
        .insert({
          farmer_id: farmerCode, user_id: userId, name,
          address: address || '', phone: phone || '', nic: nic || '',
          chilling_center_id: chillingCenterId,
        })
        .select('id')
        .single();
      if (fErr) throw fErr;
      const farmerRowId = farmerResult.id;

      if (bankName || accountNumber || branch) {
        await supabase.from('bank_accounts').insert({
          farmer_id: farmerRowId, bank_name: bankName || '',
          account_number: accountNumber || '', branch: branch || '',
        });
      }

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'registration_successful_title',
        message: `registration_welcome_msg|name:${name},code:${farmerCode}`,
        type: 'general'
      });

      return res.status(201).json({
        id: farmerRowId, farmerId: farmerCode, userId, name, address, phone, nic,
      });
    } catch (err) {
      console.error('[AUTH:register-farmer-by-center] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/auth?action=register-user ──────────
  if (action === 'register-user' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { name, email, password, role, bankName, accountNumber, branch, location, designation } = body;
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

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
            chilling_center_id: chillingCenterId, bank_name: bankName || '',
            account_number: accountNumber || '', branch: branch || '',
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
            nestle_officer_id: nestleOfficerId, bank_name: bankName || '',
            account_number: accountNumber || '', branch: branch || '',
          });
        }
      }

      const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center' };
      const payload = { id: userId, email, role: roleMap[role] || role, name };
      const token = signToken(payload);

      return res.status(201).json({
        token,
        user: { ...payload, chillingCenterId, nestleOfficerId },
      });
    } catch (err) {
      console.error('[AUTH:register-user] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/auth?action=me ──────────
  if (action === 'me' && req.method === 'GET') {
    const reqUser = authenticate(req, res);
    if (!reqUser) return;

    try {
      const { data: user, error } = await supabase
        .from('users').select('id, email, name, role').eq('id', reqUser.id).single();
      if (error) throw error;

      const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
      user.role = roleMap[user.role] || user.role;

      if (user.role === 'farmer') {
        const { data: fRows } = await supabase
          .from('farmers').select('id, farmer_id, address, phone, nic').eq('user_id', user.id).maybeSingle();
        if (fRows) {
          user.farmerId = fRows.id;
          user.farmerCode = fRows.farmer_id;
          user.address = fRows.address;
          user.phone = fRows.phone;
          user.nic = fRows.nic;

          const { data: bRows } = await supabase
            .from('bank_accounts').select('bank_name, account_number, branch').eq('farmer_id', user.farmerId).maybeSingle();
          if (bRows) {
            user.bankName = bRows.bank_name;
            user.accountNumber = bRows.account_number;
            user.branch = bRows.branch;
          }
        }
      }
      if (user.role === 'chilling_center') {
        const { data: cc } = await supabase.from('chilling_centers').select('id').eq('user_id', user.id).maybeSingle();
        if (cc) user.chillingCenterId = cc.id;
      }
      if (user.role === 'nestle_officer' || user.role === 'nestle') {
        const { data: off } = await supabase.from('nestle_officers').select('id').eq('user_id', user.id).maybeSingle();
        if (off) user.nestleOfficerId = off.id;
      }

      return res.status(200).json(user);
    } catch (err) {
      console.error('[AUTH:me] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── GET /api/auth?action=nestle-officers ──────────
  if (action === 'nestle-officers' && req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, nestle_officers!inner(designation, created_at)');

      if (error) throw error;

      const flattened = data.map((u) => ({
        id: u.id, email: u.email, name: u.name,
        designation: u.nestle_officers[0]?.designation,
        created_at: u.nestle_officers[0]?.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('[AUTH:nestle-officers] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // Fallback — no matching action
  console.log('[AUTH] No matching action. method:', req.method, 'action:', action);
  return res.status(400).json({
    error: 'Invalid action or method',
    method: req.method,
    action: action || null,
  });
}
