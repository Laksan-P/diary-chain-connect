const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/collections — optionally filter by centerId or farmerId
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT
        mc.id, mc.farmer_id AS farmerId, f.name AS farmerName, f.farmer_id AS farmerCode,
        mc.chilling_center_id AS chillingCenterId,
        mc.date, mc.time, mc.temperature, mc.quantity, mc.milk_type AS milkType,
        mc.quality_result AS qualityResult, mc.failure_reason AS failureReason,
        mc.dispatch_status AS dispatchStatus, mc.created_at AS createdAt
      FROM milk_collections mc
      LEFT JOIN farmers f ON mc.farmer_id = f.id
    `;
    const params = [];

    if (req.query.centerId) {
      sql += ' WHERE mc.chilling_center_id = ?';
      params.push(req.query.centerId);
    } else if (req.query.farmerId) {
      sql += ' WHERE mc.farmer_id = ?';
      params.push(req.query.farmerId);
    }

    sql += ' ORDER BY mc.date DESC, mc.time DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Get collections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/collections
router.post('/', authenticate, async (req, res) => {
  try {
    const { farmerId, chillingCenterId, date, time, temperature, quantity, milkType } = req.body;
    if (!farmerId || !chillingCenterId || !date || !time || temperature == null || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await pool.query(
      'INSERT INTO milk_collections (farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [farmerId, chillingCenterId, date, time, temperature, quantity, milkType || 'Cow']
    );

    const [rows] = await pool.query(`
      SELECT
        mc.id, mc.farmer_id AS farmerId, f.name AS farmerName, f.farmer_id AS farmerCode,
        mc.chilling_center_id AS chillingCenterId,
        mc.date, mc.time, mc.temperature, mc.quantity, mc.milk_type AS milkType,
        mc.quality_result AS qualityResult, mc.failure_reason AS failureReason,
        mc.dispatch_status AS dispatchStatus, mc.created_at AS createdAt
      FROM milk_collections mc
      LEFT JOIN farmers f ON mc.farmer_id = f.id
      WHERE mc.id = ?
    `, [result.insertId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create collection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
