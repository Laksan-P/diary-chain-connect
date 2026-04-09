import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repair() {
  console.log('--- REPAIRING COLLECTIONS ---');
  // 1. Fetch all collections and their farmers' center IDs
  const { data: collections } = await supabase
    .from('milk_collections')
    .select(`
      id, chilling_center_id, 
      farmers (chilling_center_id)
    `);

  for (const col of collections || []) {
    const farmerCenterId = col.farmers?.chilling_center_id;
    if (farmerCenterId && col.chilling_center_id !== farmerCenterId) {
      console.log(`Mismatch in Collection #${col.id}: Current CC ${col.chilling_center_id}, Farmer's CC ${farmerCenterId}`);
      await supabase.from('milk_collections').update({ chilling_center_id: farmerCenterId }).eq('id', col.id);
      console.log(`Updated Collection #${col.id} to CC ID ${farmerCenterId}`);
    }
  }

  console.log('\n--- REPAIRING DISPATCHES ---');
  // 2. Fetch all dispatches and the correct center IDs (now that collections are fixed)
  const { data: dispatches } = await supabase
    .from('dispatches')
    .select(`
      id, chilling_center_id,
      dispatch_items (
        milk_collections (chilling_center_id)
      )
    `);

  for (const d of dispatches || []) {
    const items = d.dispatch_items.map(i => i.milk_collections).filter(Boolean);
    if (items.length === 0) continue;

    // Use the CC ID of the first collection item
    const actualCenterId = items[0].chilling_center_id;
    
    if (actualCenterId && d.chilling_center_id !== actualCenterId) {
      console.log(`Mismatch in Dispatch #${d.id}: Current CC ${d.chilling_center_id}, Correct CC ${actualCenterId}`);
      await supabase.from('dispatches').update({ chilling_center_id: actualCenterId }).eq('id', d.id);
      console.log(`Updated Dispatch #${d.id} to CC ID ${actualCenterId}`);
    }
  }
  
  console.log('\n--- Repair Complete ---');
}

repair();
