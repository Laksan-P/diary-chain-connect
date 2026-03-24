import supabase from '../../_lib/supabase.js';
import { authenticate } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { data: rules, error } = await supabase
        .from('pricing_rules')
        .select('id, base_price_per_liter, fat_bonus, snf_bonus, effective_from, is_active, created_at')
        .order('effective_from', { ascending: false });

      if (error) throw error;

      const flattened = rules.map((r) => ({
        id: r.id,
        basePricePerLiter: r.base_price_per_liter,
        fatBonus: r.fat_bonus,
        snfBonus: r.snf_bonus,
        effectiveFrom: r.effective_from,
        isActive: r.is_active,
        createdAt: r.created_at,
      }));

      return res.status(200).json(flattened);
    } catch (err) {
      console.error('Get pricing rules error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { basePricePerLiter, fatBonus, snfBonus, effectiveFrom } = req.body;
      if (!basePricePerLiter || !fatBonus || !snfBonus || !effectiveFrom) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Deactivate existing
      await supabase.from('pricing_rules').update({ is_active: false }).eq('is_active', true);

      const { data: newRule, error: insertErr } = await supabase
        .from('pricing_rules')
        .insert({
          base_price_per_liter: basePricePerLiter,
          fat_bonus: fatBonus,
          snf_bonus: snfBonus,
          effective_from: effectiveFrom,
          is_active: true,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      return res.status(201).json({
        id: newRule.id,
        basePricePerLiter: parseFloat(basePricePerLiter),
        fatBonus: parseFloat(fatBonus),
        snfBonus: parseFloat(snfBonus),
        effectiveFrom,
        isActive: true,
      });
    } catch (err) {
      console.error('Create pricing rule error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
