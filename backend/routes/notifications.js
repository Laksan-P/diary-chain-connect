const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const { data: notes, error } = await supabase
       .from('notifications')
       .select('id, user_id, title, message, type, is_read, created_at')
       .eq('user_id', userId)
       .order('created_at', { ascending: false });
    
    if (error) throw error;

    const flattened = notes.map(n => ({
       id: n.id,
       userId: n.user_id,
       title: n.title,
       message: n.message,
       type: n.type,
       isRead: n.is_read,
       createdAt: n.created_at
    }));

    res.json(flattened);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
