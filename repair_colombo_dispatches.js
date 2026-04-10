import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repair() {
  console.log('Repairing dispatches #15, #16, #17 (Moving from Colombo to Kandy)...');

  // Move dispatches to Kandy (ID: 1)
  const { error: dErr } = await supabase
    .from('dispatches')
    .update({ chilling_center_id: 1 })
    .in('id', [15, 16, 17]);

  if (dErr) console.error('Error updating dispatches:', dErr);
  else console.log('Updated dispatches #15, #16, #17 to Kandy CC');

  // Also ensure the collections within these dispatches match the center
  const { data: items } = await supabase
    .from('dispatch_items')
    .select('collection_id')
    .in('dispatch_id', [15, 16, 17]);

  if (items && items.length > 0) {
    const colIds = items.map(i => i.collection_id);
    const { error: cErr } = await supabase
      .from('milk_collections')
      .update({ chilling_center_id: 1 })
      .in('id', colIds);
    
    if (cErr) console.error('Error updating collections:', cErr);
    else console.log(`Updated ${colIds.length} collections to Kandy CC`);
  }

  console.log('Repair complete!');
}

repair().catch(console.error);
