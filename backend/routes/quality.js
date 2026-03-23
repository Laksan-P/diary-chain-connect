const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/quality-tests
router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { collectionId, snf, fat, water } = req.body;
    if (!collectionId || snf == null || fat == null || water == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine pass/fail
    let result = 'Pass';
    let reason = null;
    if (fat < 3.5) { result = 'Fail'; reason = 'Low FAT'; }
    else if (snf < 8.5) { result = 'Fail'; reason = 'Low SNF'; }
    else if (water > 0.5) { result = 'Fail'; reason = 'Excess Water'; }

    await conn.beginTransaction();

    // Insert quality test
    const [qResult] = await conn.query(
      'INSERT INTO quality_tests (collection_id, fat, snf, water, result, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [collectionId, fat, snf, water, result, reason]
    );

    // Update collection quality result
    await conn.query(
      'UPDATE milk_collections SET quality_result = ?, failure_reason = ? WHERE id = ?',
      [result, reason, collectionId]
    );

    // Create notification for farmer
    const [colRows] = await conn.query(
      'SELECT mc.farmer_id, mc.date, f.user_id FROM milk_collections mc JOIN farmers f ON mc.farmer_id = f.id WHERE mc.id = ?',
      [collectionId]
    );
    if (colRows.length > 0) {
      const { user_id, date } = colRows[0];
      const title = result === 'Pass' ? 'Quality Test Passed' : 'Quality Test Failed';
      const message = result === 'Pass'
        ? `Your milk collection on ${date} passed quality testing.`
        : `Your milk collection on ${date} failed quality testing. Reason: ${reason}`;
      await conn.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [user_id, title, message, 'quality_result']
      );
    }

    await conn.commit();

    res.status(201).json({
      id: qResult.insertId,
      collectionId,
      snf, fat, water,
      result, reason,
      testedAt: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    console.error('Quality test error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
