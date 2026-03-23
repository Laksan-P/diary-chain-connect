const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — get for current user or by userId query
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const [rows] = await pool.query(
      'SELECT id, user_id AS userId, title, message, type, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    rows.forEach(r => r.isRead = !!r.isRead);
    res.json(rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
