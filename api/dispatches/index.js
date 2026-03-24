import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET') {
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

        d.items = items.map((item) => ({
          id: item.id,
          dispatchId: item.dispatch_id,
          collectionId: item.collection_id,
          quantity: item.milk_collections?.quantity,
          qualityResult: item.milk_collections?.quality_result,
          farmerName: item.milk_collections?.farmers?.name,
        }));
        d.totalQuantity = d.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
      }

      return res.status(200).json(dispatches);
    } catch (err) {
      console.error('Get dispatches error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { chillingCenterId, transporterName, vehicleNumber, driverContact, dispatchDate, items } = req.body;
      if (!chillingCenterId || !transporterName || !vehicleNumber || !driverContact || !dispatchDate || !items?.length) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: dResult, error: dErr } = await supabase
        .from('dispatches')
        .insert({
          chilling_center_id: chillingCenterId,
          transporter_name: transporterName,
          vehicle_number: vehicleNumber,
          driver_contact: driverContact,
          dispatch_date: dispatchDate,
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      const dispatchId = dResult.id;

      for (const item of items) {
        await supabase.from('dispatch_items').insert({ dispatch_id: dispatchId, collection_id: item.collectionId });
        await supabase.from('milk_collections').update({ dispatch_status: 'Dispatched' }).eq('id', item.collectionId);
      }

      // Return created dispatch
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

      return res.status(201).json({
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
        totalQuantity: 0,
      });
    } catch (err) {
      console.error('Create dispatch error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
