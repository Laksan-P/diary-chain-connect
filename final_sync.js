import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Final Data Sync: Updating CC table with emails and passwords...');

  const ccData = [
    { name: 'Kandy Central CC', email: 'cc@nestle.com', password: 'password' },
    { name: 'Kurunegala CC', email: 'kurunegala@nestle.com', password: 'password' },
    { name: 'Matale CC', email: 'matale@nestle.com', password: 'password' },
    { name: 'Colombo CC', email: 'colombo@nestle.com', password: 'password' },
    { name: 'jaffna CC', email: 'jaffna@nestle.com', password: 'password' }
  ];

  for (const item of ccData) {
    const { error } = await supabase
      .from('chilling_centers')
      .update({ 
        email: item.email, 
        password: item.password 
      })
      .eq('name', item.name);
    
    if (error) {
      console.log(`Note: Could not update CC table for ${item.name}. (Likely columns 'email' and 'password' don't exist yet in the CC table). Error: ${error.message}`);
    } else {
      console.log(`Updated CC table for ${item.name}`);
    }
  }

  console.log('Sync sequence complete!');
}

run().catch(console.error);
