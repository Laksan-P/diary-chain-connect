import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: d } = await supabase.from('dispatches').select('id, chilling_center_id, chilling_centers(name)').eq('id', 17).single();
  console.log('Dispatch 17:', JSON.stringify(d, null, 2));
}
check();
