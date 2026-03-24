const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[BACKEND] Login attempt received for email: ${email}`);
    if (!email || !password) {
       console.log('[BACKEND] Missing email or password');
       return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('[BACKEND] Connecting to Supabase to fetch user...');
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    
    console.log('[BACKEND] Supabase response received. Error:', !!error);
    if (error) {
       console.error('[BACKEND] Supabase query error:', error);
       throw error;
    }
    
    if (!user) {
       console.log('[BACKEND] User not found in database');
       return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[BACKEND] User found, comparing password...');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('[BACKEND] Password match:', isMatch);
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

      // Fetch bank details for farmer
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

    // If user is chilling_center, fetch and REQUIRE center id
    let chillingCenterId = null;
    if (user.role === 'chilling_center') {
      const { data: cc, error: ccErr } = await supabase.from('chilling_centers').select('id').eq('user_id', user.id).maybeSingle();
      if (ccErr) throw ccErr;
      if (!cc) return res.status(401).json({ error: 'Chilling Center profile no longer exists' });
      chillingCenterId = cc.id;
    }

    // If user is nestle, fetch and REQUIRE officer id
    let nestleOfficerId = null;
    if (user.role === 'nestle') {
      const { data: off, error: offErr } = await supabase.from('nestle_officers').select('id').eq('user_id', user.id).maybeSingle();
      if (offErr) throw offErr;
      if (!off) return res.status(401).json({ error: 'Nestle Officer profile no longer exists' });
      nestleOfficerId = off.id;
    }

    const token = signToken(payload);

    res.json({
      token,
      user: { ...payload, farmerId, farmerCode, chillingCenterId, nestleOfficerId },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- POST /api/auth/register-farmer ----------
router.post('/register-farmer', async (req, res) => {
  try {
    const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = req.body;
    if (!email || !password || !name || !chillingCenterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check duplicate email
    const { data: existingEmail, error: eErr } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (eErr) throw eErr;
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const { data: existingNic, error: nicErr } = await supabase.from('farmers').select('id').eq('nic', nic).maybeSingle();
      if (nicErr) throw nicErr;
      if (existingNic) return res.status(409).json({ error: 'NIC already registered' });
    }

    // Check duplicate Phone
    if (phone && phone.trim() !== '') {
      const { data: existingPhone, error: phoneErr } = await supabase.from('farmers').select('id').eq('phone', phone).maybeSingle();
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
    const { count: farmerCount, error: countErr } = await supabase.from('farmers').select('*', { count: 'exact', head: true });
    if (countErr) throw countErr;
    const farmerCode = `FRM-${String(farmerCount + 1).padStart(3, '0')}`;

    // Insert farmer
    const { data: farmerResult, error: fErr } = await supabase
      .from('farmers')
      .insert({ farmer_id: farmerCode, user_id: userId, name, address: address || '', phone: phone || '', nic: nic || '', chilling_center_id: chillingCenterId })
      .select('id')
      .single();
    
    if (fErr) throw fErr;
    const farmerIdGenerated = farmerResult.id;

    if (bankName || accountNumber || branch) {
      await supabase.from('bank_accounts').insert({ farmer_id: farmerIdGenerated, bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' });
    }

    const roleForToken = 'farmer';
    const payload = { id: userId, email, role: roleForToken, name };
    const token = signToken(payload);

    res.status(201).json({
      token,
      user: { ...payload, farmerId: farmerIdGenerated, farmerCode, address, phone, nic, bankName: bankName || '', accountNumber: accountNumber || '', branch: branch || '' },
    });
  } catch (err) {
    console.error('Register farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- POST /api/auth/register-farmer-by-center ----------
router.post('/register-farmer-by-center', authenticate, async (req, res) => {
  try {
    const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = req.body;
    if (!email || !password || !name || !chillingCenterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check duplicate email
    const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const { data: existingNic } = await supabase.from('farmers').select('id').eq('nic', nic).maybeSingle();
      if (existingNic) return res.status(409).json({ error: 'NIC already registered' });
    }

    // Check duplicate Phone
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
      .insert({ farmer_id: farmerCode, user_id: userId, name, address: address || '', phone: phone || '', nic: nic || '', chilling_center_id: chillingCenterId })
      .select('id')
      .single();
    
    if (fErr) throw fErr;
    const farmerRowId = farmerResult.id;

    if (bankName || accountNumber || branch) {
      await supabase.from('bank_accounts').insert({ farmer_id: farmerRowId, bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' });
    }

    res.status(201).json({
      id: farmerRowId,
      farmerId: farmerCode,
      userId,
      name,
      address,
      phone,
      nic,
    });
  } catch (err) {
    console.error('Register farmer by center error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- POST /api/auth/register-user ----------
router.post('/register-user', async (req, res) => {
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
        await supabase.from('chilling_center_accounts').insert({ chilling_center_id: chillingCenterId, bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' });
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
        await supabase.from('nestle_officer_accounts').insert({ nestle_officer_id: nestleOfficerId, bank_name: bankName || '', account_number: accountNumber || '', branch: branch || '' });
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
});

// ---------- GET /api/auth/me ----------
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users').select('id, email, name, role').eq('id', req.user.id).single();
    if (error) throw error;

    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
    user.role = roleMap[user.role] || user.role;

    if (user.role === 'farmer') {
      const { data: fRows } = await supabase.from('farmers').select('id, farmer_id, address, phone, nic').eq('user_id', user.id).maybeSingle();
      if (fRows) {
        user.farmerId = fRows.id;
        user.farmerCode = fRows.farmer_id;
        user.address = fRows.address;
        user.phone = fRows.phone;
        user.nic = fRows.nic;

        const { data: bRows } = await supabase.from('bank_accounts').select('bank_name, account_number, branch').eq('farmer_id', user.farmerId).maybeSingle();
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

    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- GET /api/auth/nestle-officers ----------
router.get('/nestle-officers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, nestle_officers!inner(designation, created_at)')
      .order('id', { foreignTable: 'nestle_officers', ascending: false });
    
    if (error) throw error;
    // Flatten result for frontend
    const flattened = data.map(u => ({
      id: u.id, email: u.email, name: u.name,
      designation: u.nestle_officers[0]?.designation,
      created_at: u.nestle_officers[0]?.created_at
    }));

    res.json(flattened);
  } catch (err) {
    console.error('Get nestle officers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
