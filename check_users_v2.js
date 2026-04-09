import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
  const { data: users } = await supabase.from('users').select('id, name, email, role');
  console.log('Users:', JSON.stringify(users, null, 2));
  
  const { data: ccs } = await supabase.from('chilling_centers').select('id, name, user_id');
  console.log('CC Records:', JSON.stringify(ccs, null, 2));
}
checkUsers();
