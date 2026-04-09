import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOrphanDispatches() {
  const { data: dispatches } = await supabase
    .from('dispatches')
    .select('id, chilling_center_id, dispatch_items(id)');
    
  console.log('Orphan Dispatches (No Items):');
  const orphans = dispatches.filter(d => d.dispatch_items.length === 0);
  console.log(JSON.stringify(orphans, null, 2));

  console.log('\nDispatches with items:');
  const healthy = dispatches.filter(d => d.dispatch_items.length > 0);
  console.log('Count:', healthy.length);
}
checkOrphanDispatches();
