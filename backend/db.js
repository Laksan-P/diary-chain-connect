const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: SUPABASE_URL and SUPABASE_KEY are required in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// We export the supabase client for usage in routes
module.exports = supabase;
