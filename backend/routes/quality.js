const express = require('express');
const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/quality-tests
router.post('/', authenticate, async (req, res) => {
  try {
    const { collectionId, snf, fat, water } = req.body;
    if (!collectionId || snf == null || fat == null || water == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine pass/fail
    let resultValue = 'Pass';
    let reasonValue = null;
    if (fat < 3.5) { resultValue = 'Fail'; reasonValue = 'Low FAT'; }
    else if (snf < 8.5) { resultValue = 'Fail'; reasonValue = 'Low SNF'; }
    else if (water > 0.5) { resultValue = 'Fail'; reasonValue = 'Excess Water'; }

    // Insert quality test
    const { data: qtRows, error: qtErr } = await supabase
       .from('quality_tests')
       .insert({ collection_id: collectionId, fat, snf, water, result: resultValue, reason: reasonValue })
       .select('id')
       .single();
    
    if (qtErr) throw qtErr;
    const newId = qtRows.id;

    // Update collection
    await supabase
       .from('milk_collections')
       .update({ quality_result: resultValue, failure_reason: reasonValue })
       .eq('id', collectionId);

    // Notification
    const { data: col, error: cErr } = await supabase
      .from('milk_collections')
      .select('farmer_id, date, farmers (user_id)')
      .eq('id', collectionId)
      .maybeSingle();

    if (col && !cErr) {
       const user_id = col.farmers?.user_id;
       const date = col.date;
       const title = resultValue === 'Pass' ? 'Quality Test Passed' : 'Quality Test Failed';
       const message = resultValue === 'Pass'
        ? `Your milk collection on ${date} passed quality testing.`
        : `Your milk collection on ${date} failed quality testing. Reason: ${reasonValue}`;
       
       if (user_id) {
         await supabase.from('notifications').insert({ user_id, title, message, type: 'quality_result' });
       }
    }

    res.status(201).json({
      id: newId,
      collectionId,
      snf, fat, water,
      result: resultValue, reason: reasonValue,
      testedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Quality test error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
