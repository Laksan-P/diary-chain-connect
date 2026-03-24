const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dispatches
router.get('/', authenticate, async (req, res) => {
  try {
    let query = supabase
      .from('dispatches')
      .select(`
        id, chilling_center_id, transporter_name, vehicle_number, driver_contact, 
        dispatch_date, status, rejection_reason, created_at,
        chilling_centers (name)
      `);

    if (req.query.centerId) {
      query = query.eq('chilling_center_id', req.query.centerId);
    }
    
    const { data: dispatches, error } = await query.order('dispatch_date', { ascending: false });
    
    if (error) throw error;

    for (const d of dispatches) {
       // Fetch items for each dispatch
       const { data: items, error: iErr } = await supabase
         .from('dispatch_items')
         .select(`
            id, dispatch_id, collection_id, 
            milk_collections!inner (
               quantity, quality_result,
               farmers (name)
            )
         `)
         .eq('dispatch_id', d.id);
       
       if (iErr) throw iErr;

       d.chillingCenterName = d.chilling_centers?.name;
       d.dispatchDate = d.dispatch_date;
       d.transporterName = d.transporter_name;
       d.vehicleNumber = d.vehicle_number;
       d.driverContact = d.driver_contact;
       d.rejectionReason = d.rejection_reason;
       d.createdAt = d.created_at;

       d.items = items.map(item => ({
          id: item.id,
          dispatchId: item.dispatch_id,
          collectionId: item.collection_id,
          quantity: item.milk_collections?.quantity,
          qualityResult: item.milk_collections?.quality_result,
          farmerName: item.milk_collections?.farmers?.name
       }));
       d.totalQuantity = d.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
    }

    res.json(dispatches);
  } catch (err) {
    console.error('Get dispatches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/dispatches
router.post('/', authenticate, async (req, res) => {
  try {
    const { chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate, items } = req.body;
    if (!chillingCenterId || !transporterName || !vehicleNumber || !driverContact || !dispatchDate || !items?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: dResult, error: dErr } = await supabase
       .from('dispatches')
       .insert({ chilling_center_id: chillingCenterId, transporter_name: transporterName, vehicle_number: vehicleNumber, driver_contact: driverContact, dispatch_date: dispatchDate })
       .select('id')
       .single();
    
    if (dErr) throw dErr;
    const dispatchId = dResult.id;

    for (const item of items) {
       await supabase.from('dispatch_items').insert({ dispatch_id: dispatchId, collection_id: item.collectionId });
       await supabase.from('milk_collections').update({ dispatch_status: 'Dispatched' }).eq('id', item.collectionId);
    }

    // Return created dispatch info
    const { data: dispatch, error: fetchErr } = await supabase
       .from('dispatches')
       .select(`
         id, chilling_center_id, transporter_name, vehicle_number, driver_contact, 
         dispatch_date, status, created_at,
         chilling_centers (name)
       `)
       .eq('id', dispatchId)
       .single();
    
    if (fetchErr) throw fetchErr;

    res.status(201).json({
       id: dispatch.id,
       chillingCenterId: dispatch.chilling_center_id,
       chillingCenterName: dispatch.chilling_centers?.name,
       transporterName: dispatch.transporter_name,
       vehicleNumber: dispatch.vehicle_number,
       driverContact: dispatch.driver_contact,
       dispatchDate: dispatch.dispatch_date,
       status: dispatch.status,
       createdAt: dispatch.created_at,
       items: items.map((item, i) => ({ id: i + 1, dispatchId, collectionId: item.collectionId })),
       totalQuantity: 0
    });
  } catch (err) {
    console.error('Create dispatch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/dispatches/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    await supabase.from('dispatches').update({ status, rejection_reason: reason || null }).eq('id', req.params.id);

    // Update items in collection
    const { data: items, error: iErr } = await supabase.from('dispatch_items').select('collection_id').eq('dispatch_id', req.params.id);
    if (!iErr && items) {
       for (const item of items) {
          await supabase.from('milk_collections').update({ dispatch_status: status }).eq('id', item.collection_id);
       }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update dispatch status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
