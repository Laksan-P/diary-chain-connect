const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');

// Route imports
const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmers');
const collectionRoutes = require('./routes/collections');
const qualityRoutes = require('./routes/quality');
const dispatchRoutes = require('./routes/dispatches');
const pricingRoutes = require('./routes/pricing');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Test DB endpoint ----------
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result');
    res.json({ status: 'ok', db: 'connected', result: rows[0].result });
  } catch (err) {
    console.error('DB test error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ---------- Chilling Centers (simple) ----------
app.get('/api/chilling-centers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, location FROM chilling_centers');
    res.json(rows);
  } catch (err) {
    console.error('Get chilling centers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Center Performance (analytics) ----------
const { authenticate } = require('./middleware/auth');
app.get('/api/chilling-centers/performance', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        cc.id AS centerId, cc.name AS centerName,
        COALESCE(SUM(mc.quantity), 0) AS totalQuantity,
        COALESCE(AVG(mc.quantity), 0) AS avgQuantity,
        COUNT(mc.id) AS collectionCount
      FROM chilling_centers cc
      LEFT JOIN milk_collections mc ON mc.chilling_center_id = cc.id
      GROUP BY cc.id
      ORDER BY totalQuantity DESC
    `);

    // Calculate quality rate and revenue per center
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const [qRows] = await pool.query(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN mc.quality_result = 'Pass' THEN 1 ELSE 0 END) AS passed
        FROM milk_collections mc
        WHERE mc.chilling_center_id = ? AND mc.quality_result IS NOT NULL
      `, [r.centerId]);

      const total = qRows[0].total || 0;
      const passed = qRows[0].passed || 0;
      r.qualityRate = total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0;
      r.totalQuantity = parseFloat(r.totalQuantity);
      r.avgQuantity = parseFloat(parseFloat(r.avgQuantity).toFixed(0));

      // Revenue estimate from payments
      const [revRows] = await pool.query(`
        SELECT COALESCE(SUM(p.amount), 0) AS rev
        FROM payments p
        JOIN milk_collections mc ON p.collection_id = mc.id
        WHERE mc.chilling_center_id = ?
      `, [r.centerId]);
      r.totalRevenue = parseFloat(revRows[0].rev || 0);
      r.rank = i + 1;
    }

    res.json(rows);
  } catch (err) {
    console.error('Performance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- API Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/quality-tests', qualityRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/pricing-rules', pricingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Nestlé Dairy Supply Chain API running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Test DB connection: http://localhost:${PORT}/test-db\n`);
});
