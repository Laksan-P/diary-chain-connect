const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, signToken } = require('../middleware/auth');

const router = express.Router();

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[BACKEND] Login attempt received for email: ${email}`);
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE BINARY email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Map role for frontend compatibility
    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
    const frontendRole = roleMap[user.role] || user.role;

    let payload = { id: user.id, email: user.email, role: frontendRole, name: user.name };
    const token = signToken(payload);

    // If user is a farmer, fetch and REQUIRE farmer details
    let farmerId = null;
    let farmerCode = null;
    if (user.role === 'farmer') {
      const [farmerRows] = await pool.query('SELECT id, farmer_id, address, phone, nic FROM farmers WHERE user_id = ?', [user.id]);
      if (farmerRows.length === 0) return res.status(401).json({ error: 'Farmer profile no longer exists' });
      
      farmerId = farmerRows[0].id;
      farmerCode = farmerRows[0].farmer_id;
      payload.address = farmerRows[0].address;
      payload.phone = farmerRows[0].phone;
      payload.nic = farmerRows[0].nic;

      // Fetch bank details for farmer
      const [bankRows] = await pool.query('SELECT bank_name AS bankName, account_number AS accountNumber, branch FROM bank_accounts WHERE farmer_id = ?', [farmerId]);
      if (bankRows.length > 0) {
        payload.bankName = bankRows[0].bankName;
        payload.accountNumber = bankRows[0].accountNumber;
        payload.branch = bankRows[0].branch;
      }
    }

    // If user is chilling_center, fetch and REQUIRE center id
    let chillingCenterId = null;
    if (user.role === 'chilling_center') {
      const [ccRows] = await pool.query('SELECT id FROM chilling_centers WHERE user_id = ?', [user.id]);
      if (ccRows.length === 0) return res.status(401).json({ error: 'Chilling Center profile no longer exists' });
      chillingCenterId = ccRows[0].id;
    }

    // If user is nestle, fetch and REQUIRE officer id
    let nestleOfficerId = null;
    if (user.role === 'nestle') {
      const [offRows] = await pool.query('SELECT id FROM nestle_officers WHERE user_id = ?', [user.id]);
      if (offRows.length === 0) return res.status(401).json({ error: 'Nestle Officer profile no longer exists' });
      nestleOfficerId = offRows[0].id;
    }

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
  const conn = await pool.getConnection();
  try {
    const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = req.body;
    if (!email || !password || !name || !chillingCenterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await conn.beginTransaction();

    // Check duplicate email
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const [existingNic] = await conn.query('SELECT id FROM farmers WHERE nic = ?', [nic]);
      if (existingNic.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'NIC already registered' });
      }
    }

    // Check duplicate Phone
    if (phone && phone.trim() !== '') {
      const [existingPhone] = await conn.query('SELECT id FROM farmers WHERE phone = ?', [phone]);
      if (existingPhone.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, 'farmer']
    );
    const userId = userResult.insertId;

    // Generate farmer ID
    const [countRows] = await conn.query('SELECT COUNT(*) as cnt FROM farmers');
    const farmerCode = `FRM-${String(countRows[0].cnt + 1).padStart(3, '0')}`;

    const [farmerResult] = await conn.query(
      'INSERT INTO farmers (farmer_id, user_id, name, address, phone, nic, chilling_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [farmerCode, userId, name, address || '', phone || '', nic || '', chillingCenterId]
    );

    if (bankName || accountNumber || branch) {
      await conn.query(
        'INSERT INTO bank_accounts (farmer_id, bank_name, account_number, branch) VALUES (?, ?, ?, ?)',
        [farmerResult.insertId, bankName || '', accountNumber || '', branch || '']
      );
    }

    await conn.commit();

    const roleForToken = 'farmer';
    const payload = { id: userId, email, role: roleForToken, name };
    const token = signToken(payload);

    res.status(201).json({
      token,
      user: { ...payload, farmerId: farmerResult.insertId, farmerCode, address, phone, nic, bankName: bankName || '', accountNumber: accountNumber || '', branch: branch || '' },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Register farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ---------- POST /api/auth/register-farmer-by-center ----------
router.post('/register-farmer-by-center', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, address, phone, nic, chillingCenterId, bankName, accountNumber, branch, email, password } = req.body;
    if (!email || !password || !name || !chillingCenterId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const [existingNic] = await conn.query('SELECT id FROM farmers WHERE nic = ?', [nic]);
      if (existingNic.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'NIC already registered' });
      }
    }

    // Check duplicate Phone
    if (phone && phone.trim() !== '') {
      const [existingPhone] = await conn.query('SELECT id FROM farmers WHERE phone = ?', [phone]);
      if (existingPhone.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, 'farmer']
    );
    const userId = userResult.insertId;

    const [countRows] = await conn.query('SELECT COUNT(*) as cnt FROM farmers');
    const farmerCode = `FRM-${String(countRows[0].cnt + 1).padStart(3, '0')}`;

    const [farmerResult] = await conn.query(
      'INSERT INTO farmers (farmer_id, user_id, name, address, phone, nic, chilling_center_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [farmerCode, userId, name, address || '', phone || '', nic || '', chillingCenterId]
    );

    if (bankName || accountNumber || branch) {
      await conn.query(
        'INSERT INTO bank_accounts (farmer_id, bank_name, account_number, branch) VALUES (?, ?, ?, ?)',
        [farmerResult.insertId, bankName || '', accountNumber || '', branch || '']
      );
    }

    await conn.commit();

    res.status(201).json({
      id: farmerResult.insertId,
      farmerId: farmerCode,
      userId,
      name,
      address: address || '',
      phone: phone || '',
      nic: nic || '',
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      branch: branch || '',
      chillingCenterId,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    console.error('Register farmer by center error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ---------- GET /api/auth/me ----------
// ---------- POST /api/auth/register-user ----------
router.post('/register-user', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, email, password, role, bankName, accountNumber, branch, location, designation } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['nestle', 'chilling_center'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, role]
    );
    const userId = userResult.insertId;

    let chillingCenterId = null;
    let nestleOfficerId = null;
    if (role === 'chilling_center') {
      const [ccResult] = await conn.query(
        'INSERT INTO chilling_centers (name, location, user_id) VALUES (?, ?, ?)',
        [name, location || 'Default Location', userId]
      );
      chillingCenterId = ccResult.insertId;
      
      if (bankName || accountNumber || branch) {
          await conn.query(
            'INSERT INTO chilling_center_accounts (chilling_center_id, bank_name, account_number, branch) VALUES (?, ?, ?, ?)',
            [chillingCenterId, bankName || '', accountNumber || '', branch || '']
          );
      }
    }

    if (role === 'nestle') {
      const [offResult] = await conn.query(
        'INSERT INTO nestle_officers (name, designation, user_id) VALUES (?, ?, ?)',
        [name, designation || 'Officer', userId]
      );
      nestleOfficerId = offResult.insertId;

      if (bankName || accountNumber || branch) {
          await conn.query(
            'INSERT INTO nestle_officer_accounts (nestle_officer_id, bank_name, account_number, branch) VALUES (?, ?, ?, ?)',
            [nestleOfficerId, bankName || '', accountNumber || '', branch || '']
          );
      }
    }

    await conn.commit();

    // Map role for token consistency
    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center' };
    const payload = { id: userId, email, role: roleMap[role] || role, name };
    const token = signToken(payload);

    res.status(201).json({
      token,
      user: { ...payload, chillingCenterId, nestleOfficerId },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Register user error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
    user.role = roleMap[user.role] || user.role;

    if (user.role === 'farmer') {
      const [fRows] = await pool.query('SELECT id, farmer_id, address, phone, nic FROM farmers WHERE user_id = ?', [user.id]);
      if (fRows.length === 0) return res.status(401).json({ error: 'Farmer profile no longer exists' });
      user.farmerId = fRows[0].id;
      user.farmerCode = fRows[0].farmer_id;
      user.address = fRows[0].address;
      user.phone = fRows[0].phone;
      user.nic = fRows[0].nic;

      const [bRows] = await pool.query('SELECT bank_name AS bankName, account_number AS accountNumber, branch FROM bank_accounts WHERE farmer_id = ?', [user.farmerId]);
      if (bRows.length > 0) {
        user.bankName = bRows[0].bankName;
        user.accountNumber = bRows[0].accountNumber;
        user.branch = bRows[0].branch;
      }
    }
    if (user.role === 'chilling_center') {
      const [ccRows] = await pool.query('SELECT id FROM chilling_centers WHERE user_id = ?', [user.id]);
      if (ccRows.length === 0) return res.status(401).json({ error: 'Center profile no longer exists' });
      user.chillingCenterId = ccRows[0].id;
    }

    if (user.role === 'nestle_officer' || user.role === 'nestle') {
        const [offRows] = await pool.query('SELECT id FROM nestle_officers WHERE user_id = ?', [user.id]);
        if (offRows.length === 0) return res.status(401).json({ error: 'Officer profile no longer exists' });
        user.nestleOfficerId = offRows[0].id;
    }

    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- GET /api/auth/nestle-officers ----------
router.get('/nestle-officers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.name, n.designation, n.created_at
      FROM users u
      JOIN nestle_officers n ON u.id = n.user_id
      WHERE u.role = 'nestle'
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get nestle officers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
