const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/pricing-rules
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, base_price_per_liter AS basePricePerLiter, fat_bonus AS fatBonus,
             snf_bonus AS snfBonus, effective_from AS effectiveFrom, is_active AS isActive,
             created_at AS createdAt
      FROM pricing_rules ORDER BY effective_from DESC
    `);
    // Convert isActive from 0/1 to boolean
    rows.forEach(r => r.isActive = !!r.isActive);
    res.json(rows);
  } catch (err) {
    console.error('Get pricing rules error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pricing-rules
router.post('/', authenticate, async (req, res) => {
  try {
    const { basePricePerLiter, fatBonus, snfBonus, effectiveFrom } = req.body;
    if (!basePricePerLiter || !fatBonus || !snfBonus || !effectiveFrom) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Deactivate existing active rules
    await pool.query('UPDATE pricing_rules SET is_active = FALSE');

    const [result] = await pool.query(
      'INSERT INTO pricing_rules (base_price_per_liter, fat_bonus, snf_bonus, effective_from, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [basePricePerLiter, fatBonus, snfBonus, effectiveFrom]
    );

    res.status(201).json({
      id: result.insertId,
      basePricePerLiter: parseFloat(basePricePerLiter),
      fatBonus: parseFloat(fatBonus),
      snfBonus: parseFloat(snfBonus),
      effectiveFrom,
      isActive: true,
    });
  } catch (err) {
    console.error('Create pricing rule error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
