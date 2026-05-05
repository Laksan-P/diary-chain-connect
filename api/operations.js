import supabase from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { cors } from './_lib/cors.js';

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  const { action, id } = req.query;

  // ══════════════════════════════════════════════════
  //  QUALITY TESTS
  // ══════════════════════════════════════════════════

  // ────────── POST /api/operations?action=quality-test ──────────
  if (action === 'quality-test' && req.method === 'POST') {
    try {
      const body = getBody(req);
      let { collectionId, snf, fat, water, offlineCollectionId } = body;

      if ((!collectionId || collectionId === 0) && offlineCollectionId) {
        // offline_id column doesn't exist — the sync engine resolves IDs before calling this
        console.warn('Quality test: collectionId is 0 and offline_id lookup not available');
      }

      if (!collectionId || snf == null || fat == null || water == null) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let resultValue = 'Pass';
      let reasonValue = null;
      if (fat < 3.5) { resultValue = 'Fail'; reasonValue = 'Low FAT'; }
      else if (snf < 8.5) { resultValue = 'Fail'; reasonValue = 'Low SNF'; }
      else if (water > 0.5) { resultValue = 'Fail'; reasonValue = 'Excess Water'; }

      // Soft idempotency check (since offline_id column is missing)
      const { data: existing } = await supabase
        .from('quality_tests')
        .select('id')
        .match({ collection_id: collectionId })
        .maybeSingle();

      if (existing) {
        console.log(`[Backend] Quality test already exists for collection ${collectionId}, skipping.`);
        return res.status(200).json({ id: existing.id, success: true });
      }

      const { data: qtRows, error: qtErr } = await supabase
        .from('quality_tests')
        .insert({ collection_id: collectionId, fat, snf, water, result: resultValue, reason: reasonValue })
        .select('id')
        .single();
      if (qtErr) throw qtErr;
      const newId = qtRows.id;

      const updates = {
        quality_result: resultValue,
        failure_reason: reasonValue,
        fat: fat,
        snf: snf,
        water: water
      };

      // Auto-approve only if tested by Nestle.
      // Chilling center testing should keep status as Pending so it can be dispatched.
      if (resultValue === 'Pass' && (user.role === 'nestle' || user.role === 'nestle_officer')) {
        updates.dispatch_status = 'Approved';
      } else if (resultValue === 'Fail' && (user.role === 'nestle' || user.role === 'nestle_officer')) {
        updates.dispatch_status = 'Rejected';
      }

      await supabase
        .from('milk_collections')
        .update(updates)
        .eq('id', collectionId);



      // Removed: Auto-approve the entire Dispatch if Nestle verification passes
      // Nestle now verifies each collection individually as requested.
      if (resultValue === 'Pass' && (user.role === 'nestle' || user.role === 'nestle_officer')) {
        const { data: itemLink } = await supabase
          .from('dispatch_items')
          .select('dispatch_id')
          .eq('collection_id', collectionId)
          .maybeSingle();

        if (itemLink?.dispatch_id) {
          const dId = itemLink.dispatch_id;

          // Check if all other items in this dispatch are also approved
          const { data: allItems } = await supabase
            .from('dispatch_items')
            .select('collection_id, milk_collections(dispatch_status)')
            .eq('dispatch_id', dId);

          if (allItems) {
            const allApproved = allItems.every(item =>
              item.collection_id === collectionId ? true : item.milk_collections?.dispatch_status === 'Approved'
            );

            if (allApproved) {
              await supabase.from('dispatches').update({ status: 'Approved' }).eq('id', dId);

              // Notify CC about the overall Dispatch Approval
              const { data: dInfo } = await supabase.from('dispatches').select('chilling_centers(user_id), vehicle_number, transporter_name').eq('id', dId).single();
              const ccOwnerId = dInfo?.chilling_centers?.user_id;
              if (ccOwnerId) {
                await supabase.from('notifications').insert({
                  user_id: ccOwnerId,
                  title: 'dispatch_accepted_by_nestle_title',
                  message: `dispatch_accepted_by_nestle_msg|id:${dId},vehicle:${dInfo.vehicle_number},transporter:${dInfo.transporter_name}`,
                  type: 'dispatch'
                });
              }
            }
          }
        }
      }

      const { data: col, error: cErr } = await supabase
        .from('milk_collections')
        .select('farmer_id, date, chilling_center_id, chilling_centers(user_id), farmers (user_id, name)')
        .eq('id', collectionId)
        .maybeSingle();

      if (col && !cErr) {
        const userId = col.farmers?.user_id;
        const farmerName = col.farmers?.name;
        const ccUserId = col.chilling_centers?.user_id;
        const date = col.date;
        let titleKey = resultValue === 'Pass' ? 'quality_test_passed_title' : 'quality_test_failed_title';
        let msgKey = resultValue === 'Pass' ? 'quality_test_passed_msg' : 'quality_test_failed_msg';

        // Special mention for Nestle's final check
        if (user.role === 'nestle_officer' || user.role === 'nestle') {
          titleKey = resultValue === 'Pass' ? 'nestle_quality_test_passed_title' : 'nestle_quality_test_failed_title';
          msgKey = resultValue === 'Pass' ? 'nestle_quality_test_passed_msg' : 'nestle_quality_test_failed_msg';
        }

        const params = resultValue === 'Pass'
          ? `date:${date}`
          : `date:${date},reason:${reasonValue || 'N/A'}`;

        if (userId) {
          // 1. If tested by Nestle, send both the quality test result AND dispatch status
          if (user.role === 'nestle_officer' || user.role === 'nestle') {
            // Nestlé quality test result notification to farmer
            await supabase.from('notifications').insert({
              user_id: userId,
              title: titleKey,
              message: `${msgKey}|${params}`,
              type: 'quality_result'
            });

            // Dispatch status notification to farmer
            const dispatchTitle = resultValue === 'Pass' ? 'dispatch_approved_title' : 'dispatch_rejected_title';
            const dispatchMsg = resultValue === 'Pass' ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';
            await supabase.from('notifications').insert({
              user_id: userId,
              title: dispatchTitle,
              message: `${dispatchMsg}|${params}`,
              type: 'dispatch'
            });

            // Notify Chilling Center about Nestlé's verification result
            if (ccUserId) {
              const ccTitle = resultValue === 'Pass' ? 'cc_collection_passed_nestle_title' : 'cc_collection_rejected_nestle_title';
              const ccMsg = resultValue === 'Pass' ? 'cc_collection_passed_nestle_msg' : 'cc_collection_rejected_nestle_msg';
              await supabase.from('notifications').insert({
                user_id: ccUserId,
                title: ccTitle,
                message: `${ccMsg}|id:${collectionId},farmer:${farmerName},result:${resultValue}${reasonValue ? `,reason:${reasonValue}` : ''}`,
                type: 'quality_result'
              });
            }
          } else {
            // 2. CC quality test — notify the farmer about the result
            await supabase.from('notifications').insert({
              user_id: userId,
              title: titleKey,
              message: `${msgKey}|${params}`,
              type: 'quality_result'
            });
          }
        }

        // ────────── PERFORMANCE TRACKING TRIGGER ──────────
        try {
          // Get last 3 tests for THIS FARMER across all collections
          const { data: farmerData } = await supabase.from('farmers').select('performance_status, performance_recommendation').eq('id', col.farmer_id).single();
          const currentStatus = farmerData?.performance_status;

          const { data: farmerCols } = await supabase.from('milk_collections').select('id').eq('farmer_id', col.farmer_id);
          const colIds = farmerCols?.map(c => c.id) || [];

          const { data: lastTests } = await supabase
            .from('quality_tests')
            .select('result, fat, snf, water')
            .in('collection_id', colIds)
            .order('tested_at', { ascending: false })
            .limit(3);

          if (lastTests && lastTests.length > 0) {
            let consecutiveFails = 0;
            for (const t of lastTests) {
              if (t.result === 'Fail') consecutiveFails++;
              else break;
            }

            if (consecutiveFails >= 3) {
              const newSeverity = consecutiveFails >= 3 ? 'HIGH' : 'LOW';

              // Only proceed if status is not already "Needs Improvement" OR severity has increased to HIGH
              let alreadyHigh = false;
              if (currentStatus === 'Needs Improvement' && farmerData?.performance_recommendation) {
                try {
                  const oldRec = JSON.parse(farmerData.performance_recommendation);
                  if (oldRec.severity === 'HIGH') alreadyHigh = true;
                } catch (e) { }
              }

              if (currentStatus !== 'Needs Improvement' || (newSeverity === 'HIGH' && !alreadyHigh)) {
                let fatFails = 0, snfFails = 0, waterFails = 0;
                lastTests.slice(0, consecutiveFails).forEach(t => {
                  if (t.fat < 3.5) fatFails++;
                  if (t.snf < 8.5) snfFails++;
                  if (t.water > 0.5) waterFails++;
                });

                const failedTypes = [];
                if (waterFails > 0) failedTypes.push("WATER");
                if (snfFails > 0) failedTypes.push("SNF");
                if (fatFails > 0) failedTypes.push("FAT");

                let recObj = {
                  message_title: "Overall Milk Quality Decline",
                  message_title_ta: "ஒட்டுமொத்த பால் தர சரிவு",
                  message_title_si: "සමස්ත කිරි ගුණාත්මක භාවයේ අඩුවීමක්",
                  short_message: "Multiple quality parameters are failing",
                  short_message_ta: "பல தர அளவுருக்கள் தோல்வியடைகின்றன",
                  short_message_si: "ගුණාත්මක පරාමිති කිහිපයක් අසමත් වේ",
                  issue: failedTypes.length > 0 ? failedTypes.join(",") : "GENERAL",
                  tips: [
                    "Improve overall feeding and nutrition practices",
                    "Maintain clean and hygienic milking environment",
                    "Schedule regular veterinary health checkups",
                    "Follow proper milk storage and delivery practices",
                    "Monitor previous test results and improve gradually"
                  ],
                  tips_ta: [
                    "ஒட்டுமொத்த உணவு மற்றும் ஊட்டச்சத்து நடைமுறைகளை மேம்படுத்தவும்",
                    "சுத்தமான மற்றும் சுகாதாரமான பால் கறக்கும் சூழலை பராமரிக்கவும்",
                    "வழக்கமான கால்நடை சுகாதார பரிசோதனைகளை திட்டமிடுங்கள்",
                    "சரியான பால் சேமிப்பு மற்றும் விநியோக நடைமுறைகளைப் பின்பற்றவும்",
                    "முந்தைய சோதனை முடிவுகளைக் கண்காணித்து படிப்படியாக மேம்படுத்தவும்"
                  ],
                  tips_si: [
                    "සමස්ත පෝෂණ හා ආහාර පුරුදු වැඩිදියුණු කරන්න",
                    "පිරිසිදු හා සෞඛ්‍යාරක්ෂිත කිරි දෙවීමේ පරිසරයක් පවත්වා ගන්න",
                    "නිතිපතා පශු වෛද්‍ය සෞඛ්‍ය පරීක්ෂණ උපලේඛනගත කරන්න",
                    "නිසි කිරි ගබඩා කිරීමේ සහ බෙදා හැරීමේ පිළිවෙත් අනුගමනය කරන්න",
                    "පෙර පරීක්ෂණ ප්‍රතිඵල නිරීක්ෂණය කර ක්‍රමානුකූලව වැඩිදියුණු කරන්න"
                  ]
                };

                // Specific case overrides for single issue predominance
                if (failedTypes.length === 1) {
                  if (failedTypes[0] === "WATER") {
                    recObj.message_title = "Milk Dilution Detected";
                    recObj.message_title_ta = "பாலின் நீர்த்துப்போதல் கண்டறியப்பட்டுள்ளது";
                    recObj.message_title_si = "කිරි දියාරු වීමක් හඳුනාගෙන ඇත";
                    recObj.short_message = "Water content in milk is above acceptable level";
                    recObj.tips = [
                      "Do not add water to milk under any condition",
                      "Use clean containers during milking and storage",
                      "Avoid contamination from rainwater or dirty environments",
                      "Maintain proper hygiene during milk collection and handling",
                      "Ensure milk is stored in covered and clean conditions"
                    ];
                  } else if (failedTypes[0] === "SNF") {
                    recObj.message_title = "Low SNF Detected";
                    recObj.message_title_ta = "குறைந்த SNF கண்டறியப்பட்டுள்ளது";
                    recObj.message_title_si = "අඩු SNF හඳුනාගෙන ඇත";
                    recObj.short_message = "Milk nutrient level (SNF) is below standard";
                    recObj.tips = [
                      "Provide protein-rich feed such as soybean meal and legume fodder",
                      "Add mineral mixture supplements to improve milk quality",
                      "Ensure clean drinking water is always available",
                      "Maintain a proper and consistent feeding schedule",
                      "Perform regular deworming and veterinary checkups"
                    ];
                  } else if (failedTypes[0] === "FAT") {
                    recObj.message_title = "Low Fat Content Detected";
                    recObj.message_title_ta = "குறைந்த கொழுப்பு சத்து கண்டறியப்பட்டுள்ளது";
                    recObj.message_title_si = "අඩු මේද ප්‍රතිශතයක් හඳුනාගෙන ඇත";
                    recObj.short_message = "Milk fat percentage is below required level";
                    recObj.tips = [
                      "Feed cows with high-energy food such as coconut poonac, maize, and rice bran",
                      "Increase green grass intake (Napier grass, Guinea grass)",
                      "Add oil-rich supplements like coconut oil cake or soybean meal",
                      "Maintain consistent milking times daily",
                      "Ensure cows are healthy, stress-free, and properly hydrated"
                    ];
                  }
                }

                recObj.severity = newSeverity;
                const recString = JSON.stringify(recObj);

                await supabase.from('farmers').update({ performance_status: 'Needs Improvement', performance_recommendation: recString }).eq('id', col.farmer_id);

                // Notify only if 3 fails OR if severity increased to HIGH
                const { data: nestleUsers } = await supabase.from('users').select('id').eq('role', 'nestle');
                const targetUsers = [...(nestleUsers?.map(u => u.id) || [])];
                if (ccUserId) targetUsers.push(ccUserId);

                for (const uid of targetUsers) {
                  await supabase.from('notifications').insert({
                    user_id: uid,
                    title: 'farmer_performance_alert_title',
                    message: `farmer_performance_alert_msg|farmer:${farmerName},issue:${recObj.short_message}`,
                    type: 'system'
                  });
                }
              }
            } else if (lastTests[0].result === 'Pass') {
              // Auto-recovery: If latest test is Pass, check previous tests to see if we were failing
              if (currentStatus === 'Needs Improvement') {
                await supabase.from('farmers').update({ performance_status: 'Improving', performance_recommendation: null }).eq('id', col.farmer_id);
              } else if (currentStatus === 'Improving') {
                await supabase.from('farmers').update({ performance_status: 'Good', performance_recommendation: null }).eq('id', col.farmer_id);
              }
            }
          }
        } catch (pErr) { console.error('Performance err:', pErr); }
      }

      return res.status(201).json({
        id: newId, collectionId, snf, fat, water,
        result: resultValue, reason: reasonValue,
        testedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Quality test error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  DISPATCHES
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=dispatches ──────────
  if (action === 'dispatches' && req.method === 'GET') {
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

      const { data: dispatches, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      if (!dispatches || dispatches.length === 0) {
        return res.status(200).json([]);
      }

      // Single bulk query for ALL dispatch items instead of N+1 loop
      const dispatchIds = dispatches.map(d => d.id);
      const { data: allItems, error: itemsErr } = await supabase
        .from('dispatch_items')
        .select(`
          id, dispatch_id, collection_id,
          milk_collections (
            quantity, quality_result, dispatch_status, failure_reason,
            farmers (name)
          )
        `)
        .in('dispatch_id', dispatchIds);

      if (itemsErr) {
        console.warn('Failed to load dispatch items:', itemsErr.message);
      }

      // Group items by dispatch_id
      const itemsByDispatch = {};
      for (const item of (allItems || [])) {
        if (!itemsByDispatch[item.dispatch_id]) itemsByDispatch[item.dispatch_id] = [];
        itemsByDispatch[item.dispatch_id].push({
          id: item.id,
          dispatchId: item.dispatch_id,
          collectionId: item.collection_id,
          quantity: item.milk_collections?.quantity,
          qualityResult: item.milk_collections?.quality_result,
          dispatchStatus: item.milk_collections?.dispatch_status,
          failureReason: item.milk_collections?.failure_reason,
          farmerName: item.milk_collections?.farmers?.name,
        });
      }

      const result = dispatches.map(d => ({
        id: d.id,
        chillingCenterId: d.chilling_center_id,
        chillingCenterName: d.chilling_centers?.name,
        dispatchDate: d.dispatch_date,
        transporterName: d.transporter_name,
        vehicleNumber: d.vehicle_number,
        driverContact: d.driver_contact,
        status: d.status,
        rejectionReason: d.rejection_reason,
        createdAt: d.created_at,
        items: itemsByDispatch[d.id] || [],
        totalQuantity: (itemsByDispatch[d.id] || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0),
      }));

      return res.status(200).json(result);
    } catch (err) {
      console.error('Get dispatches error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/operations?action=create-dispatch ──────────
  if (action === 'create-dispatch' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate, items, offline_id } = body;

      if (!chillingCenterId || !transporterName || !vehicleNumber || !driverContact || !dispatchDate || !items?.length) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Soft idempotency check (since offline_id column is missing)
      const { data: existing } = await supabase
        .from('dispatches')
        .select('id')
        .match({
          chilling_center_id: chillingCenterId,
          transporter_name: transporterName,
          dispatch_date: dispatchDate,
          vehicle_number: vehicleNumber
        })
        .maybeSingle();

      if (existing) {
        console.log(`[Backend] Dispatch already exists, skipping duplicate: ${existing.id}`);
        return res.status(200).json({ id: existing.id, success: true });
      }

      const { data: dResult, error: dErr } = await supabase
        .from('dispatches')
        .insert({
          chilling_center_id: chillingCenterId, transporter_name: transporterName,
          vehicle_number: vehicleNumber, driver_contact: driverContact,
          dispatch_date: dispatchDate,
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      const dispatchId = dResult.id;

      // 1. Insert dispatch items and update statuses
      const finalItems = [];
      for (const item of items) {
        let colId = item.collectionId || item.collection_id;
        const offId = item.offlineCollectionId;

        if ((!colId || colId === 0) && offId) {
          // offline_id column doesn't exist — the sync engine resolves IDs before calling this
          console.warn(`Dispatch item: collection not resolved for offline ID ${offId}`);
        }

        if (!colId || colId === 0) {
          // If we can't find the collection, we MUST fail this dispatch
          // so it retries later when the collection has synced.
          throw new Error(`Collection not found for item: ${offId || 'Unknown'}`);
        }

        finalItems.push(colId);

        const { error: itemErr } = await supabase.from('dispatch_items').insert({
          dispatch_id: dispatchId,
          collection_id: colId
        });
        if (itemErr) throw itemErr;
      }

      if (finalItems.length > 0) {
        await supabase.from('milk_collections')
          .update({ dispatch_status: 'Dispatched' })
          .in('id', finalItems);
      }

      // 2. Fetch farmers and users for these collections (Manual Join for robustness)
      const { data: colsData } = await supabase
        .from('milk_collections')
        .select('id, date, farmer_id, farmers (user_id)')
        .in('id', finalItems);

      // 3. Insert notifications one-by-one (matches working quality-test pattern)
      if (colsData) {
        for (const col of colsData) {
          const userId = col.farmers?.user_id || (Array.isArray(col.farmers) ? col.farmers[0]?.user_id : null);
          if (userId) {
            await supabase.from('notifications').insert({
              user_id: userId,
              title: 'milk_dispatched_title',
              message: `milk_dispatched_msg|date:${col.date}`,
              type: 'quality_result', // Use quality_result for guaranteed DB acceptance
              is_read: false
            });
          }
        }
      }

      const { data: dispatch, error: fetchErr } = await supabase
        .from('dispatches')
        // ... ...
        .select(`
          id, chilling_center_id, transporter_name, vehicle_number, driver_contact,
          dispatch_date, status, created_at,
          chilling_centers (name)
        `)
        .eq('id', dispatchId)
        .single();
      if (fetchErr) throw fetchErr;

      // 4. Notify all Nestle Officers of Incoming Dispatch
      const { data: nestleUsers } = await supabase.from('users').select('id').eq('role', 'nestle');
      if (nestleUsers && nestleUsers.length > 0) {
        for (const n of nestleUsers) {
          await supabase.from('notifications').insert({
            user_id: n.id,
            title: 'new_dispatch_alert_title',
            message: `new_dispatch_alert_msg|vehicle:${dispatch.vehicle_number},transporter:${dispatch.transporter_name},cc:${dispatch.chilling_centers?.name || 'Unknown'}`,
            type: 'dispatch'
          });
        }
      }

      return res.status(201).json({
        id: dispatch.id, chillingCenterId: dispatch.chilling_center_id,
        chillingCenterName: dispatch.chilling_centers?.name,
        transporterName: dispatch.transporter_name,
        vehicleNumber: dispatch.vehicle_number,
        driverContact: dispatch.driver_contact,
        dispatchDate: dispatch.dispatch_date,
        status: dispatch.status, createdAt: dispatch.created_at,
        items: items.map((item, i) => ({ id: i + 1, dispatchId, collectionId: item.collectionId })),
        totalQuantity: 0,
      });
    } catch (err) {
      console.error('Create dispatch error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/operations?action=dispatch-status&id=X ──────────
  if (action === 'dispatch-status' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const body = getBody(req);
      const { status, reason } = body;
      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Approved or Rejected' });
      }

      const { data: dispatch, error: dFetchErr } = await supabase
        .from('dispatches')
        .select('chilling_center_id, transporter_name, vehicle_number, chilling_centers(user_id)')
        .eq('id', id)
        .single();

      if (dFetchErr) throw dFetchErr;

      await supabase.from('dispatches').update({ status, rejection_reason: reason || null }).eq('id', id);

      // notify CC User (Include Tanker/Vehicle info)
      const ccUserId = dispatch.chilling_centers?.user_id;
      if (ccUserId) {
        const vehicle = dispatch.vehicle_number;
        const transporter = dispatch.transporter_name;
        await supabase.from('notifications').insert({
          user_id: ccUserId,
          title: status === 'Approved' ? 'dispatch_accepted_by_nestle_title' : 'dispatch_rejected_by_nestle_title',
          message: status === 'Approved'
            ? `dispatch_accepted_by_nestle_msg|id:${id},vehicle:${vehicle},transporter:${transporter}`
            : `dispatch_rejected_by_nestle_msg|id:${id},vehicle:${vehicle},transporter:${transporter},reason:${reason || 'N/A'}`,
          type: 'dispatch'
        });
      }

      // ────────── CC PERFORMANCE TRACKING TRIGGER ──────────
      try {
        const { data: currentCC } = await supabase.from('chilling_centers').select('performance_status').eq('id', dispatch.chilling_center_id).single();
        const currentStatus = currentCC?.performance_status;

        // Use dispatches to calculate pass rate consistently with both dashboards
        const { data: allDispatches } = await supabase
          .from('dispatches')
          .select('status')
          .eq('chilling_center_id', dispatch.chilling_center_id);

        if (allDispatches && allDispatches.length > 0) {
          const total = allDispatches.length;
          const rejected = allDispatches.filter(d => d.status === 'Rejected').length;
          const rejectionRate = (rejected / total) * 100;
          const passRate = Number((100 - rejectionRate).toFixed(1));

          console.log(`[Dispatch CC Perf] CenterID: ${dispatch.chilling_center_id}, PassRate: ${passRate}, CurrentDB: ${currentStatus}`);

          // STRICT RULE: Threshold is 75% pass rate
          if (passRate < 75) {
            const rec = `Low quality pass rate (${passRate}%). Please review collection and cooling procedures.`;

            await supabase.from('chilling_centers').update({ performance_status: 'Needs Improvement', performance_recommendation: rec }).eq('id', dispatch.chilling_center_id);

            if (currentStatus !== 'Needs Improvement' && ccUserId) {
              await supabase.from('notifications').insert({
                user_id: ccUserId,
                title: 'performance_warning_title',
                message: `performance_warning_msg|rate:${passRate}%`,
                type: 'system'
              });
            }
          } else {
            if (currentStatus !== 'Good') {
              await supabase.from('chilling_centers').update({
                performance_status: 'Good',
                performance_recommendation: null
              }).eq('id', dispatch.chilling_center_id);

              if (ccUserId) {
                await supabase.from('notifications').insert({
                  user_id: ccUserId,
                  title: 'performance_restored_title',
                  message: 'performance_restored_msg',
                  type: 'system'
                });
              }
            }
          }
        }
      } catch (ccPErr) { console.error('CC Performance err:', ccPErr); }

      // Fetch dispatch items for this dispatch
      const { data: items } = await supabase
        .from('dispatch_items')
        .select('id, collection_id')
        .eq('dispatch_id', id);

      if (items && items.length > 0) {
        const collectionIds = items.map(item => item.collection_id);

        // 1. Skip Bulk Update — We now track every item individually.
        // If an item wasn't verified, it stays 'Dispatched' until tested.
        // The transport status header and notifications handle the global result.

        // 2. Fetch collections to get farmer_ids and specific results
        const { data: mcData } = await supabase
          .from('milk_collections')
          .select('id, date, farmer_id, dispatch_status, failure_reason, farmers (user_id)')
          .in('id', collectionIds);

        if (mcData && mcData.length > 0) {
          // Determine if this is a global transport rejection (e.g., damage)
          // vs an individual quality-based rejection.
          const isGlobalRejection = status === 'Rejected' && mcData.every(c => !c.failure_reason);

          for (const col of mcData) {
            const userId = col.farmers?.user_id || (Array.isArray(col.farmers) ? col.farmers[0]?.user_id : null);
            if (userId) {
              const itemStatus = col.dispatch_status;

              // If it's a quality-led rejection (!isGlobalRejection), we ONLY notify the culprit (done in quality-test).
              // Bystanders (still 'Dispatched') should NOT be notified in quality-led rejections.
              const shouldNotify = (status === 'Approved' && itemStatus === 'Dispatched') ||
                (isGlobalRejection && itemStatus === 'Dispatched');

              if (shouldNotify) {
                const titleKey = (status === 'Approved') ? 'dispatch_approved_title' : 'dispatch_rejected_title';
                const msgKey = (status === 'Approved') ? 'dispatch_approved_msg' : 'dispatch_rejected_msg';

                // For bystanders, we use the global reason if it's a global rejection, otherwise generic
                const displayReason = isGlobalRejection ? reason : 'Batch quality standards not met';

                const params = (status === 'Approved')
                  ? `date:${col.date}`
                  : `date:${col.date},reason:${displayReason}`;

                await supabase.from('notifications').insert({
                  user_id: userId,
                  title: titleKey,
                  message: `${msgKey}|${params}`,
                  type: 'quality_result',
                  is_read: false
                });
              }
            }
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update dispatch status error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── DELETE /api/operations?action=delete-dispatch&id=X ──────────
  if (action === 'delete-dispatch' && req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      // 1. Get linked collections to reset their status
      const { data: items } = await supabase.from('dispatch_items').select('collection_id').eq('dispatch_id', id);
      const colIds = items?.map(i => i.collection_id).filter(Boolean) || [];

      // 2. Revert collections to 'Pending'
      if (colIds.length > 0) {
        await supabase.from('milk_collections').update({ dispatch_status: 'Pending' }).in('id', colIds);
      }

      // 3. Delete dispatch (cascade will handle dispatch_items if set, otherwise delete manually)
      await supabase.from('dispatch_items').delete().eq('dispatch_id', id);
      await supabase.from('dispatches').delete().eq('id', id);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete dispatch error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  PRICING RULES
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=pricing-rules ──────────
  if (action === 'pricing-rules' && req.method === 'GET') {
    try {
      const { data: rules, error } = await supabase
        .from('pricing_rules')
        .select('id, base_price_per_liter, fat_bonus, snf_bonus, effective_from, is_active, created_at')
        .order('effective_from', { ascending: false });
      if (error) throw error;

      const flattened = rules.map((r) => ({
        id: r.id, basePricePerLiter: r.base_price_per_liter,
        fatBonus: r.fat_bonus, snfBonus: r.snf_bonus,
        effectiveFrom: r.effective_from, isActive: r.is_active, createdAt: r.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get pricing rules error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── POST /api/operations?action=create-pricing-rule ──────────
  if (action === 'create-pricing-rule' && req.method === 'POST') {
    try {
      const body = getBody(req);
      const { basePricePerLiter, fatBonus, snfBonus, effectiveFrom } = body;
      if (!basePricePerLiter || !fatBonus || !snfBonus || !effectiveFrom) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: newRule, error: insertErr } = await supabase
        .from('pricing_rules')
        .insert({
          base_price_per_liter: basePricePerLiter, fat_bonus: fatBonus,
          snf_bonus: snfBonus, effective_from: effectiveFrom, is_active: false,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      return res.status(201).json({
        id: newRule.id,
        basePricePerLiter: parseFloat(basePricePerLiter),
        fatBonus: parseFloat(fatBonus),
        snfBonus: parseFloat(snfBonus),
        effectiveFrom, isActive: false,
      });
    } catch (err) {
      console.error('Create pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── PATCH /api/operations?action=update-pricing-rule&id=X ──────────
  if (action === 'update-pricing-rule' && req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
      const { isActive } = getBody(req);

      // If we are activating this rule, deactivate ALL others first
      if (isActive) {
        await supabase.from('pricing_rules').update({ is_active: false }).neq('id', id);
      }

      const { error } = await supabase
        .from('pricing_rules')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── DELETE /api/operations?action=delete-pricing-rule&id=X ──────────
  if (action === 'delete-pricing-rule' && req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  QUALITY TESTS (ADDITIONAL)
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=quality-tests&collectionId=X ──────────
  if (action === 'quality-tests' && req.method === 'GET') {
    try {
      const { collectionId } = req.query;
      if (!collectionId) return res.status(400).json({ error: 'collectionId required' });
      const { data: qts, error } = await supabase
        .from('quality_tests')
        .select('*')
        .eq('collection_id', collectionId)
        .order('tested_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(qts);
    } catch (err) {
      console.error('Get quality tests error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ══════════════════════════════════════════════════
  //  PERFORMANCE ANALYTICS
  // ══════════════════════════════════════════════════

  // ────────── GET /api/operations?action=performance ──────────
  if (action === 'performance' && req.method === 'GET') {
    const { type, id: targetId } = req.query;
    try {
      if (type === 'farmer') {
        const farmerId = targetId || user.farmerId;
        if (!farmerId) return res.status(400).json({ error: 'Farmer ID required' });
        const { data: farmer } = await supabase.from('farmers').select('name, performance_status, performance_recommendation').eq('id', farmerId).single();

        const { data: fCols } = await supabase.from('milk_collections').select('id').eq('farmer_id', farmerId);
        const fColIds = fCols?.map(c => c.id) || [];

        const { data: tests } = await supabase.from('quality_tests').select('result, tested_at').in('collection_id', fColIds);
        const total = tests?.length || 0;
        const passed = tests?.filter(t => t.result === 'Pass').length || 0;
        const passRateRaw = total > 0 ? (passed / total) * 100 : 100;
        const passRate = Number(passRateRaw.toFixed(1));

        // STRICT RULE: Directly determine status based on 75% threshold
        const displayStatus = passRate >= 75 ? 'Good' : 'Needs Improvement';

        const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const { data: collections } = await supabase.from('milk_collections').select('date, quantity, quality_result').eq('farmer_id', farmerId).gte('date', threeMonthsAgo.toISOString().split('T')[0]).order('date', { ascending: true });
        const trends = {};
        collections?.forEach(c => {
          const month = c.date.substring(0, 7);
          if (!trends[month]) trends[month] = { month, volume: 0, passCount: 0, total: 0 };
          trends[month].volume += parseFloat(c.quantity) || 0; trends[month].total++;
          if (c.quality_result === 'Pass') trends[month].passCount++;
        });
        const trendArray = Object.values(trends).map(t => ({ ...t, passRate: t.total > 0 ? (t.passCount / t.total) * 100 : 100 }));

        const resData = {
          status: displayStatus,
          recommendation: displayStatus === 'Good' ? null : farmer?.performance_recommendation,
          passRate,
          frequency: total > 0 ? 'Regular' : 'New',
          trends: trendArray
        };

        // If needs improvement, attach full recommendation data from DB
        if (resData.status === 'Needs Improvement') {
          try {
            const recStr = (resData.recommendation || '').toUpperCase();
            let issueTypes = [];
            if (recStr.includes('SNF')) issueTypes.push('SNF');
            if (recStr.includes('FAT')) issueTypes.push('FAT');
            if (recStr.includes('WATER')) issueTypes.push('WATER');
            if (issueTypes.length === 0) issueTypes.push('GENERAL');

            const { data: allRecs } = await supabase
              .from('performance_recommendations')
              .select('*')
              .in('issue_type', issueTypes);

            if (allRecs && allRecs.length > 0) {
              if (allRecs.length === 1) {
                resData.recommendationDetails = allRecs[0];
                if (!resData.recommendation) resData.recommendation = allRecs[0].title_en;
              } else {
                // Merge multiple recommendations
                const merged = {
                  issue_type: 'MULTIPLE',
                  title_en: 'Multiple Quality Issues Detected',
                  title_ta: 'பல தர சிக்கல்கள் கண்டறியப்பட்டுள்ளன',
                  title_si: 'ගුණාත්මක ගැටලු කිහිපයක් හඳුනාගෙන ඇත',
                  description_en: allRecs.map(r => r.description_en).join(' '),
                  description_ta: allRecs.map(r => r.description_ta).join(' '),
                  description_si: allRecs.map(r => r.description_si).join(' '),
                  guidance_en: [...new Set(allRecs.flatMap(r => r.guidance_en || []))],
                  guidance_ta: [...new Set(allRecs.flatMap(r => r.guidance_ta || []))],
                  guidance_si: [...new Set(allRecs.flatMap(r => r.guidance_si || []))]
                };
                resData.recommendationDetails = merged;
                resData.recommendation = merged.title_en;
              }
            } else if (!resData.recommendation) {
              resData.recommendation = 'Performance improvement required. Please contact your chilling center.';
            }
          } catch (e) {
            console.error('Failed to fetch recommendation details:', e);
          }
        }

        return res.status(200).json(resData);
      }
      if (type === 'center') {
        const centerId = Number(targetId || user.chillingCenterId);
        if (!centerId) return res.status(400).json({ error: 'Center ID required' });

        const { data: center } = await supabase.from('chilling_centers').select('name, performance_status, performance_recommendation').eq('id', centerId).single();
        const { data: dispatches } = await supabase.from('dispatches').select('status, dispatch_date, quantity:dispatch_items(milk_collections(quantity))').eq('chilling_center_id', centerId);

        const totalD = dispatches?.length || 0;
        const rejectedD = dispatches?.filter(d => d.status === 'Rejected').length || 0;
        const rejectionRate = totalD > 0 ? (rejectedD / totalD) * 100 : 0;
        const passRateRaw = 100 - rejectionRate;
        const passRate = Number(passRateRaw.toFixed(1));

        // STRICT RULE: Directly determine status based on 75% threshold
        const displayStatus = passRate >= 75 ? 'Good' : 'Needs Improvement';
        const showAlert = displayStatus === 'Needs Improvement';

        console.log(`[Nestle Performance Debug] CenterID: ${centerId}, PassRate: ${passRate}, Status: ${displayStatus}, ShowAlert: ${showAlert}`);

        const trends = {};
        dispatches?.forEach(d => {
          if (!d.dispatch_date) return;
          const month = d.dispatch_date.substring(0, 7);
          if (!trends[month]) {
            trends[month] = { month, volume: 0, passCount: 0, total: 0 };
          }

          trends[month].total++;
          if (d.status === 'Approved' || d.status === 'Pending' || !d.status) {
            trends[month].passCount++;
          }

          // Safer volume calculation
          let vol = 0;
          if (Array.isArray(d.quantity)) {
            vol = d.quantity.reduce((sum, item) => {
              const mc = item.milk_collections;
              const q = (mc && !Array.isArray(mc)) ? mc.quantity : (Array.isArray(mc) ? mc[0]?.quantity : 0);
              return sum + (parseFloat(q) || 0);
            }, 0);
          }
          trends[month].volume += vol;
        });

        const trendArray = Object.keys(trends).sort().map(month => {
          const t = trends[month];
          const rate = t.total > 0 ? (t.passCount / t.total) * 100 : 100;
          return {
            month,
            volume: Number(t.volume.toFixed(2)),
            passRate: Number(rate.toFixed(1))
          };
        });

        return res.status(200).json({
          status: displayStatus,
          performance_status: displayStatus,
          recommendation: displayStatus === 'Good' ? null : center?.performance_recommendation,
          passRate,
          quality_pass_rate: passRate,
          rejectionRate: Number(rejectionRate.toFixed(1)),
          show_alert: showAlert,
          trends: trendArray
        });
      }
      if (['nestle', 'nestle_officer'].includes(user.role)) {
        const { data: farmers } = await supabase.from('farmers').select('id, name, performance_status');
        const { data: centers } = await supabase.from('chilling_centers').select('id, name, performance_status');

        // Fetch all quality tests to calculate real-time stats
        const { data: allDispatches } = await supabase.from('dispatches').select('chilling_center_id, status');
        const { data: allTests } = await supabase.from('quality_tests').select('collection_id, result');
        const { data: allCollections } = await supabase.from('milk_collections').select('id, farmer_id');

        const farmerStats = (farmers || []).map(f => {
          const fColIds = (allCollections || []).filter(c => c.farmer_id === f.id).map(c => c.id);
          const fTests = (allTests || []).filter(t => fColIds.includes(t.collection_id));
          const total = fTests.length;
          const passed = fTests.filter(t => t.result === 'Pass').length;
          const passRate = total > 0 ? (passed / total) * 100 : 100;
          return { ...f, performance_status: passRate >= 75 ? 'Good' : 'Needs Improvement' };
        });

        const centerStats = (centers || []).map(c => {
          const cDispatches = allDispatches?.filter(d => d.chilling_center_id === c.id) || [];
          const total = cDispatches.length;
          const rejected = cDispatches.filter(d => d.status === 'Rejected').length;
          const passRate = total > 0 ? ((total - rejected) / total) * 100 : 100;
          return { ...c, performance_status: passRate >= 75 ? 'Good' : 'Needs Improvement' };
        });

        return res.status(200).json({ farmers: farmerStats, centers: centerStats });
      }
      return res.status(400).json({ error: 'Invalid type' });
    } catch (err) {
      console.error('Performance API error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ────────── recommendations ──────────
  if (action === 'recommendations') {
    try {
      if (req.method === 'GET') {
        try {
          const { data, error } = await supabase
            .from('performance_recommendations')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            // If table doesn't exist yet, return empty list instead of 500
            if (error.code === '42P01') return res.status(200).json([]);
            throw error;
          }
          return res.status(200).json(data || []);
        } catch (err) {
          console.error('Recommendations GET error:', err);
          return res.status(200).json([]); // Fallback to empty list for UI stability
        }
      }

      // Mutation logic
      try {
        if (req.method === 'POST') {
          const body = getBody(req);
          const { id, ...payload } = body;

          if (id) {
            const { data, error } = await supabase
              .from('performance_recommendations')
              .update({ ...payload, updated_at: new Date().toISOString() })
              .eq('id', id)
              .select()
              .single();
            if (error) throw error;
            return res.status(200).json(data);
          } else {
            const { data, error } = await supabase
              .from('performance_recommendations')
              .insert(payload)
              .select()
              .single();
            if (error) throw error;
            return res.status(201).json(data);
          }
        }

        if (req.method === 'DELETE') {
          const { id } = req.query;
          if (!id) return res.status(400).json({ error: 'ID required' });
          const { error } = await supabase
            .from('performance_recommendations')
            .delete()
            .eq('id', id);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }
      } catch (err) {
        console.error('Recommendations Mutation error:', err);
        return res.status(500).json({ error: 'Database error. Please ensure migrations are applied.' });
      }
    } catch (outerErr) {
      console.error('Recommendations API outer error:', outerErr);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
