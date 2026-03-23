const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments — list all or filter by farmerId
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT p.id, p.farmer_id AS farmerId, f.name AS farmerName, f.farmer_id AS farmerCode,
             p.collection_id AS collectionId, p.quantity, p.base_pay AS basePay,
             p.fat_bonus AS fatBonus, p.snf_bonus AS snfBonus, p.amount,
             p.status, p.paid_at AS paidAt, p.created_at AS createdAt,
             mc.date AS collectionDate, mc.quality_result AS qualityResult,
             mc.dispatch_status AS dispatchStatus
      FROM payments p
      JOIN farmers f ON p.farmer_id = f.id
      JOIN milk_collections mc ON p.collection_id = mc.id
    `;
    const params = [];
    if (req.query.farmerId) {
      sql += ' WHERE p.farmer_id = ?';
      params.push(req.query.farmerId);
    }
    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/generate — generate payment for an approved collection
router.post('/generate', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { collectionId } = req.body;
    if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

    // Check collection is approved
    const [colRows] = await conn.query(
      'SELECT mc.*, f.name AS farmerName, f.farmer_id AS farmerCode FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id WHERE mc.id = ?',
      [collectionId]
    );
    if (colRows.length === 0) return res.status(404).json({ error: 'Collection not found' });
    const col = colRows[0];

    if (col.dispatch_status !== 'Approved') {
      return res.status(400).json({ error: 'Only approved collections can be paid' });
    }

    // Check if already paid
    const [existingPay] = await conn.query('SELECT id FROM payments WHERE collection_id = ?', [collectionId]);
    if (existingPay.length > 0) {
      return res.status(409).json({ error: 'Payment already exists for this collection' });
    }

    // Get active pricing rule
    const [priceRows] = await conn.query(
      'SELECT * FROM pricing_rules WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1'
    );
    if (priceRows.length === 0) return res.status(400).json({ error: 'No active pricing rule' });
    const rule = priceRows[0];

    // Get quality test for bonuses
    const [qtRows] = await conn.query('SELECT fat, snf FROM quality_tests WHERE collection_id = ?', [collectionId]);
    const qt = qtRows[0] || { fat: 0, snf: 0 };

    const quantity = parseFloat(col.quantity);
    const basePay = quantity * parseFloat(rule.base_price_per_liter);
    const fatBonus = quantity * parseFloat(rule.fat_bonus) * (parseFloat(qt.fat) / 100);
    const snfBonus = quantity * parseFloat(rule.snf_bonus) * (parseFloat(qt.snf) / 100);
    const amount = basePay + fatBonus + snfBonus;

    await conn.beginTransaction();

    const [payResult] = await conn.query(
      'INSERT INTO payments (farmer_id, collection_id, quantity, base_pay, fat_bonus, snf_bonus, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [col.farmer_id, collectionId, quantity, basePay.toFixed(2), fatBonus.toFixed(2), snfBonus.toFixed(2), amount.toFixed(2)]
    );

    await conn.commit();

    res.status(201).json({
      id: payResult.insertId,
      farmerId: col.farmer_id,
      farmerName: col.farmerName,
      farmerCode: col.farmerCode,
      collectionId,
      quantity,
      basePay: parseFloat(basePay.toFixed(2)),
      fatBonus: parseFloat(fatBonus.toFixed(2)),
      snfBonus: parseFloat(snfBonus.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    console.error('Generate payment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// PATCH /api/payments/:id/status — mark as paid
router.patch('/:id/status', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { status } = req.body;
    if (status !== 'Paid') return res.status(400).json({ error: 'Status must be Paid' });

    await conn.beginTransaction();

    await conn.query('UPDATE payments SET status = ?, paid_at = NOW() WHERE id = ?', [status, req.params.id]);

    // Send notification to farmer
    const [payRows] = await conn.query(
      'SELECT p.amount, f.user_id FROM payments p JOIN farmers f ON p.farmer_id = f.id WHERE p.id = ?',
      [req.params.id]
    );
    if (payRows.length > 0) {
      const { amount, user_id } = payRows[0];
      await conn.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [user_id, 'Payment Completed', `Payment of Rs. ${parseFloat(amount).toLocaleString()} has been credited.`, 'payment']
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
