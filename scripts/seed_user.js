const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedUser() {
  console.log('Signing up admin user...');
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@nawab.com',
    password: 'password123',
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  if (data.user) {
    console.log('User created:', data.user.email);
    console.log('Setting role to admin in profiles table...');
    
    // We may need to do this from the DB directly if RLS prevents inserts.
    // Let's attempt it.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'admin', name: 'System Admin' })
      .eq('id', data.user.id);
      
    if (profileError) {
      console.error('Profile update failed (likely RLS):', profileError.message);
      console.log('Please run this in your Supabase SQL Editor:');
      console.log(`UPDATE profiles SET role = 'admin', name = 'System Admin' WHERE id = '${data.user.id}';`);
    } else {
      console.log('Admin user seeded successfully. You can log in with: admin@nawab.local / password123');
    }
  }
}

seedUser();
