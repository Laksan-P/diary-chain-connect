import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDispatches() {
  const { data: farmer } = await supabase.from('farmers').select('id, name, chilling_center_id').eq('id', 3).single();
  console.log('Farmer #3:', farmer);

  const { data: col } = await supabase.from('milk_collections').select('id, chilling_center_id').eq('id', 4).single();
  console.log('Collection #4:', col);

  const { data: disp } = await supabase.from('dispatches').select('id, chilling_center_id').eq('id', 2).single();
  console.log('Dispatch #2:', disp);
}

checkDispatches();
