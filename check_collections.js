import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: farmers } = await supabase.from('farmers').select('id, name, chilling_center_id').eq('name', 'dulen nimsadu');
  console.log('Farmer:', JSON.stringify(farmers, null, 2));

  if (farmers && farmers[0]) {
    const { data: cols } = await supabase.from('milk_collections').select('id, chilling_center_id, farmer_id').eq('farmer_id', farmers[0].id);
    console.log('Collections:', JSON.stringify(cols, null, 2));
  }
}
check();
