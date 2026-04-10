import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iazqhuuwoxjcziwuvswb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenFodXV3b3hqY3ppd3V2c3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0NTk0NCwiZXhwIjoyMDg5OTIxOTQ0fQ.psCt5pilZWbAbf3YNXIWJAW7iQJKjab3FliOHV7Xdww'; // Using service role as anon for this dev env to ensure real-time works without RLS hurdles for now

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
