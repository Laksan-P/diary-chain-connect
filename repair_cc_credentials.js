import { createClient } from '@supabase/supabase-client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function repair() {
  console.log('Starting CC credentials repair...');

  // 1. Get all chilling centers
  const { data: centers, error: cErr } = await supabase.from('chilling_centers').select('*');
  if (cErr) throw cErr;

  const password = await bcrypt.hash('password123', 10);

  for (const cc of centers) {
    if (cc.user_id) {
      console.log(`Center ${cc.name} already has a user ID: ${cc.user_id}`);
      continue;
    }

    // Generate a unique email based on name
    const email = cc.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '@nestle.com';
    
    // Check if user exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log(`User ${email} already exists. Linking to center ${cc.name}`);
    } else {
      // Create user
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: password,
          name: cc.name,
          role: 'chilling_center'
        })
        .select('id')
        .single();
      
      if (uErr) {
        console.error(`Error creating user for ${cc.name}:`, uErr);
        continue;
      }
      userId = newUser.id;
      console.log(`Created user ${email} for center ${cc.name}`);
    }

    // Link user to center
    const { error: lErr } = await supabase
      .from('chilling_centers')
      .update({ user_id: userId })
      .eq('id', cc.id);
    
    if (lErr) {
      console.error(`Error linking user to center ${cc.name}:`, lErr);
    }
  }

  console.log('Repair complete!');
}

repair().catch(console.error);
