import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Changing all CC passwords to "password"...');

  const ccEmails = [
    'cc@nestle.com',
    'kurunegala@nestle.com',
    'matale@nestle.com',
    'colombo@nestle.com',
    'jaffna@nestle.com'
  ];

  const passwordHash = await bcrypt.hash('password', 10);

  for (const email of ccEmails) {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email);
    
    if (error) console.error(`Error updating ${email}:`, error);
    else console.log(`Updated password for ${email}`);
  }

  console.log('Done!');
}

run().catch(console.error);
