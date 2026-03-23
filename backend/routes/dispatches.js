const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dispatches
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT d.id, d.chilling_center_id AS chillingCenterId, cc.name AS chillingCenterName,
             d.transporter_name AS transporterName, d.vehicle_number AS vehicleNumber,
             d.driver_contact AS driverContact, d.dispatch_date AS dispatchDate,
             d.status, d.rejection_reason AS rejectionReason, d.created_at AS createdAt
      FROM dispatches d
      LEFT JOIN chilling_centers cc ON d.chilling_center_id = cc.id
    `;
    const params = [];
    if (req.query.centerId) {
      sql += ' WHERE d.chilling_center_id = ?';
      params.push(req.query.centerId);
    }
    sql += ' ORDER BY d.dispatch_date DESC';

    const [dispatches] = await pool.query(sql, params);

    // Fetch items + totalQuantity for each dispatch
    for (const d of dispatches) {
      const [items] = await pool.query(`
        SELECT di.id, di.dispatch_id AS dispatchId, di.collection_id AS collectionId,
               f.name AS farmerName, mc.quantity, mc.quality_result AS qualityResult
        FROM dispatch_items di
        JOIN milk_collections mc ON di.collection_id = mc.id
        JOIN farmers f ON mc.farmer_id = f.id
        WHERE di.dispatch_id = ?
      `, [d.id]);
      d.items = items;
      d.totalQuantity = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
    }

    res.json(dispatches);
  } catch (err) {
    console.error('Get dispatches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/dispatches
router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate, items } = req.body;
    if (!chillingCenterId || !transporterName || !vehicleNumber || !driverContact || !dispatchDate || !items?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await conn.beginTransaction();

    const [dResult] = await conn.query(
      'INSERT INTO dispatches (chilling_center_id, transporter_name, vehicle_number, driver_contact, dispatch_date) VALUES (?, ?, ?, ?, ?)',
      [chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate]
    );
    const dispatchId = dResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO dispatch_items (dispatch_id, collection_id) VALUES (?, ?)',
        [dispatchId, item.collectionId]
      );
      await conn.query(
        'UPDATE milk_collections SET dispatch_status = ? WHERE id = ?',
        ['Dispatched', item.collectionId]
      );
    }

    await conn.commit();

    // Return created dispatch
    const [rows] = await conn.query(`
      SELECT d.id, d.chilling_center_id AS chillingCenterId, cc.name AS chillingCenterName,
             d.transporter_name AS transporterName, d.vehicle_number AS vehicleNumber,
             d.driver_contact AS driverContact, d.dispatch_date AS dispatchDate,
             d.status, d.created_at AS createdAt
      FROM dispatches d
      LEFT JOIN chilling_centers cc ON d.chilling_center_id = cc.id
      WHERE d.id = ?
    `, [dispatchId]);

    const dispatch = rows[0];
    dispatch.items = items.map((item, i) => ({ id: i + 1, dispatchId, collectionId: item.collectionId }));
    dispatch.totalQuantity = 0;

    res.status(201).json(dispatch);
  } catch (err) {
    await conn.rollback();
    console.error('Create dispatch error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// PATCH /api/dispatches/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { status, reason } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    await conn.beginTransaction();

    await conn.query(
      'UPDATE dispatches SET status = ?, rejection_reason = ? WHERE id = ?',
      [status, reason || null, req.params.id]
    );

    // Update all collection items in this dispatch
    const newCollectionStatus = status; // 'Approved' or 'Rejected'
    const [items] = await conn.query('SELECT collection_id FROM dispatch_items WHERE dispatch_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query(
        'UPDATE milk_collections SET dispatch_status = ? WHERE id = ?',
        [newCollectionStatus, item.collection_id]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Update dispatch status error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
