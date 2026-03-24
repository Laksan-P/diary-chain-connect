import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const { data: f, error } = await supabase
        .from('farmers')
        .select(`
          id, farmer_id, user_id, name, address, phone, nic, chilling_center_id,
          chilling_centers (name),
          milk_collections (quantity),
          created_at
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!f) return res.status(404).json({ error: 'Farmer not found' });

      const totalQuantity = (f.milk_collections || []).reduce(
        (sum, mc) => sum + parseFloat(mc.quantity || 0),
        0
      );

      return res.status(200).json({
        id: f.id,
        farmerId: f.farmer_id,
        userId: f.user_id,
        name: f.name,
        address: f.address,
        phone: f.phone,
        nic: f.nic,
        chillingCenterId: f.chilling_center_id,
        chillingCenterName: f.chilling_centers?.name,
        totalQuantity,
        createdAt: f.created_at,
      });
    } catch (err) {
      console.error('Get farmer error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { name, address, phone, nic, bankName, accountNumber, branch } = req.body;

      // Check farmer exists
      const { data: f, error: fErr } = await supabase
        .from('farmers')
        .select('user_id')
        .eq('id', id)
        .single();
      if (fErr || !f) return res.status(404).json({ error: 'Farmer not found' });

      // Permissions check
      if (user.role === 'farmer' && user.id !== f.user_id) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Update farmer
      await supabase.from('farmers').update({ name, address, phone, nic }).eq('id', id);

      // Update user name
      await supabase.from('users').update({ name }).eq('id', f.user_id);

      // Update/Insert Bank Account
      if (bankName !== undefined || accountNumber !== undefined) {
        const { data: exba } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('farmer_id', id)
          .maybeSingle();
        if (exba) {
          await supabase
            .from('bank_accounts')
            .update({
              bank_name: bankName || '',
              account_number: accountNumber || '',
              branch: branch || '',
            })
            .eq('farmer_id', id);
        } else {
          await supabase.from('bank_accounts').insert({
            farmer_id: parseInt(id),
            bank_name: bankName || '',
            account_number: accountNumber || '',
            branch: branch || '',
          });
        }
      }

      return res.status(200).json({ success: true, message: 'Profile updated' });
    } catch (err) {
      console.error('Update farmer error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
