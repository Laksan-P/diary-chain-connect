import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const reqUser = authenticate(req, res);
  if (!reqUser) return;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', reqUser.id)
      .single();
    if (error) throw error;

    const roleMap = { nestle: 'nestle_officer', chilling_center: 'chilling_center', farmer: 'farmer' };
    user.role = roleMap[user.role] || user.role;

    if (user.role === 'farmer') {
      const { data: fRows } = await supabase
        .from('farmers')
        .select('id, farmer_id, address, phone, nic')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fRows) {
        user.farmerId = fRows.id;
        user.farmerCode = fRows.farmer_id;
        user.address = fRows.address;
        user.phone = fRows.phone;
        user.nic = fRows.nic;

        const { data: bRows } = await supabase
          .from('bank_accounts')
          .select('bank_name, account_number, branch')
          .eq('farmer_id', user.farmerId)
          .maybeSingle();
        if (bRows) {
          user.bankName = bRows.bank_name;
          user.accountNumber = bRows.account_number;
          user.branch = bRows.branch;
        }
      }
    }
    if (user.role === 'chilling_center') {
      const { data: cc } = await supabase
        .from('chilling_centers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cc) user.chillingCenterId = cc.id;
    }
    if (user.role === 'nestle_officer' || user.role === 'nestle') {
      const { data: off } = await supabase
        .from('nestle_officers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (off) user.nestleOfficerId = off.id;
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
