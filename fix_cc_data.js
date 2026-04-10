import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Fixing dulen nimsadu and CC emails...');

  // 1. Fix dulen nimsadu
  const { data: dulen } = await supabase.from('farmers').select('id, name, chilling_center_id').eq('name', 'dulen nimsadu').single();
  if (dulen) {
    console.log(`Dulen current CC: ${dulen.chilling_center_id}`);
    if (dulen.chilling_center_id !== 1) {
      console.log('Moving dulen to Kandy CC (ID: 1)...');
      await supabase.from('farmers').update({ chilling_center_id: 1 }).eq('id', dulen.id);
    }
    
    // Also update his collections to CC 1 if they are scattered
    const { error: ce } = await supabase.from('milk_collections').update({ chilling_center_id: 1 }).eq('farmer_id', dulen.id);
    if (ce) console.error('Error updating collections:', ce);
    else console.log('Updated dulen collections to Kandy CC');
  } else {
    console.log('Farmer dulen nimsadu not found.');
  }

  // 2. Fix CC Emails
  const ccEmails = {
    'Kandy Central CC': 'cc@nestle.com',
    'Kurunegala CC': 'kurunegala@nestle.com',
    'Matale CC': 'matale@nestle.com',
    'Colombo CC': 'colombo@nestle.com',
    'jaffna CC': 'jaffna@nestle.com'
  };

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const [name, email] of Object.entries(ccEmails)) {
    console.log(`Processing CC: ${name} -> ${email}`);
    
    // Check if user exists
    let { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    
    if (!user) {
      console.log(`Creating user for ${email}...`);
      const { data: newUser, error: ue } = await supabase.from('users').insert({
        email,
        password_hash: passwordHash,
        name: name,
        role: 'chilling_center'
      }).select('id').single();
      if (ue) { console.error(`Error creating user ${email}:`, ue); continue; }
      user = newUser;
    }

    // Update CC with user_id
    const { error: cce } = await supabase.from('chilling_centers').update({ user_id: user.id }).eq('name', name);
    if (cce) console.error(`Error updating CC ${name}:`, cce);
    else console.log(`Linked CC ${name} to user ${email}`);
  }

  console.log('Done!');
}

run().catch(console.error);
