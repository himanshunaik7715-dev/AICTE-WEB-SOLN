import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/test-login.mjs <email> <password>');
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { console.error('LOGIN FAILED:', error.message); process.exit(1); }
console.log('LOGIN OK');
console.log('  auth uid:', data.user.id);
console.log('  email:   ', data.user.email);
