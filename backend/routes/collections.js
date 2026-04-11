const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/collections — optionally filter by centerId or farmerId
router.get('/', authenticate, async (req, res) => {
  try {
    let query = supabase
      .from('milk_collections')
      .select(`
        id, farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type,
        quality_result, failure_reason, dispatch_status, created_at,
        farmers (name, farmer_id)
      `);

    if (req.query.centerId) {
      query = query.eq('chilling_center_id', req.query.centerId);
    } else if (req.query.farmerId) {
      query = query.eq('farmer_id', req.query.farmerId);
    }

    const { data: rawCollections, error: colErr } = await query.order('date', { ascending: false }).order('time', { ascending: false });
    
    if (colErr) throw colErr;

    // --- MANUAL JOIN FOR QUALITY TESTS ---
    // Fetch all quality tests for these collections in a separate query to be 100% sure we get them
    const collectionIds = rawCollections.map(c => c.id);
    let testsByCollection = {};
    
    if (collectionIds.length > 0) {
      const { data: allTests, error: testErr } = await supabase
         .from('quality_tests')
         .select('collection_id, fat, snf, water')
         .in('collection_id', collectionIds);
      
      if (!testErr && allTests) {
        allTests.forEach(t => {
          testsByCollection[t.collection_id] = t;
        });
      }
    }

    // Flatten for consistent API format with the joined test data
    const flattened = rawCollections.map(item => {
      const test = testsByCollection[item.id] || {};
      
      return {
        id: item.id,
        farmerId: item.farmer_id,
        farmerName: item.farmers?.name,
        farmerCode: item.farmers?.farmer_id,
        chillingCenterId: item.chilling_center_id,
        date: item.date,
        time: item.time,
        temperature: item.temperature,
        quantity: item.quantity,
        milkType: item.milk_type,
        qualityResult: item.quality_result,
        failureReason: item.failure_reason,
        dispatchStatus: item.dispatch_status,
        createdAt: item.created_at,
        fat: test.fat,
        snf: test.snf,
        water: test.water
      };
    });

    res.json(flattened);
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

    const { data: insertRows, error: insertErr } = await supabase
      .from('milk_collections')
      .insert({ farmer_id: farmerId, chilling_center_id: chillingCenterId, date, time, temperature, quantity, milk_type: milkType || 'Cow' })
      .select('id')
      .single();
    
    if (insertErr) throw insertErr;
    const newId = insertRows.id;

    const { data: mc, error: fetchErr } = await supabase
       .from('milk_collections')
       .select(`
          id, farmer_id, chilling_center_id, date, time, temperature, quantity, milk_type,
          quality_result, failure_reason, dispatch_status, created_at,
          farmers (name, farmer_id)
       `)
       .eq('id', newId)
       .single();

    if (fetchErr) throw fetchErr;

    res.status(201).json({
      id: mc.id,
      farmerId: mc.farmer_id,
      farmerName: mc.farmers?.name,
      farmerCode: mc.farmers?.farmer_id,
      chillingCenterId: mc.chilling_center_id,
      date: mc.date,
      time: mc.time,
      temperature: mc.temperature,
      quantity: mc.quantity,
      milkType: mc.milk_type,
      qualityResult: mc.quality_result,
      failureReason: mc.failure_reason,
      dispatchStatus: mc.dispatch_status,
      createdAt: mc.created_at
    });
  } catch (err) {
    console.error('Create collection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
