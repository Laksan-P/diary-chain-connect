const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/farmers — list all farmers sorted by total supplied quantity
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.id, f.farmer_id AS farmerId, f.user_id AS userId, f.name, f.address,
        f.phone, f.nic, f.chilling_center_id AS chillingCenterId,
        cc.name AS chillingCenterName,
        COALESCE(SUM(mc.quantity), 0) AS totalQuantity,
        f.created_at AS createdAt
      FROM farmers f
      LEFT JOIN chilling_centers cc ON f.chilling_center_id = cc.id
      LEFT JOIN milk_collections mc ON mc.farmer_id = f.id
      GROUP BY f.id
      ORDER BY totalQuantity DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get farmers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/farmers/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.id, f.farmer_id AS farmerId, f.user_id AS userId, f.name, f.address,
        f.phone, f.nic, f.chilling_center_id AS chillingCenterId,
        cc.name AS chillingCenterName,
        COALESCE(SUM(mc.quantity), 0) AS totalQuantity,
        f.created_at AS createdAt
      FROM farmers f
      LEFT JOIN chilling_centers cc ON f.chilling_center_id = cc.id
      LEFT JOIN milk_collections mc ON mc.farmer_id = f.id
      WHERE f.id = ?
      GROUP BY f.id
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Farmer not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Get farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/farmers/:id/bank-account
router.get('/:id/bank-account', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, farmer_id AS farmerId, bank_name AS bankName, account_number AS accountNumber, branch FROM bank_accounts WHERE farmer_id = ?',
      [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Get bank account error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/farmers/:id — Update farmer profile
router.patch('/:id', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, address, phone, nic, bankName, accountNumber, branch } = req.body;
    const farmerId = req.params.id;

    await conn.beginTransaction();

    // Check if farmer exists and user is owner or admin
    const [farmers] = await conn.query('SELECT user_id FROM farmers WHERE id = ?', [farmerId]);
    if (farmers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const userId = farmers[0].user_id;

    // Only farmer themselves or nestle/staff can edit
    if (req.user.role === 'farmer' && req.user.id !== userId) {
      await conn.rollback();
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Check duplicate NIC
    if (nic && nic.trim() !== '') {
      const [existingNic] = await conn.query('SELECT id FROM farmers WHERE nic = ? AND id != ?', [nic, farmerId]);
      if (existingNic.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'NIC already registered' });
      }
    }

    // Check duplicate Phone
    if (phone && phone.trim() !== '') {
      const [existingPhone] = await conn.query('SELECT id FROM farmers WHERE phone = ? AND id != ?', [phone, farmerId]);
      if (existingPhone.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    await conn.query(
      'UPDATE farmers SET name = ?, address = ?, phone = ?, nic = ? WHERE id = ?',
      [name, address, phone, nic, farmerId]
    );

    await conn.query(
      'UPDATE users SET name = ? WHERE id = ?',
      [name, userId]
    );

    if (bankName || accountNumber || branch) {
      const [existingBank] = await conn.query('SELECT id FROM bank_accounts WHERE farmer_id = ?', [farmerId]);
      if (existingBank.length > 0) {
        await conn.query(
          'UPDATE bank_accounts SET bank_name = ?, account_number = ?, branch = ? WHERE farmer_id = ?',
          [bankName || '', accountNumber || '', branch || '', farmerId]
        );
      } else {
        await conn.query(
          'INSERT INTO bank_accounts (farmer_id, bank_name, account_number, branch) VALUES (?, ?, ?, ?)',
          [farmerId, bankName || '', accountNumber || '', branch || '']
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Update farmer error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
