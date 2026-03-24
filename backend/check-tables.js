const supabase = require('./db');

async function checkSchema() {
  console.log('--- SCHEMA CHECK ---');
  const tables = ['users', 'farmers', 'chilling_centers', 'milk_collections'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`❌ Table "${table}" error:`, error.message);
    } else {
      console.log(`✅ Table "${table}" exists.`);
    }
  }
}

checkSchema();
