import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDispatches() {
  const { data: centers } = await supabase.from('chilling_centers').select('id, name');
  console.log(`Found ${centers?.length} centers:`, centers);

  const { data: dispatches } = await supabase.from('dispatches').select('id, chilling_center_id');
  console.log(`Found ${dispatches?.length} dispatches`);
  dispatches.forEach(d => {
    if (d.id === 2) console.log(`DISPATCH #2 EXISTS: Center ID is ${d.chilling_center_id}`);
  });
}

checkDispatches();
