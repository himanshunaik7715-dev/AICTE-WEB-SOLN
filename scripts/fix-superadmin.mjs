// One-off fix script: ensure the Super Admin account exists with a known
// password and all required profile / whitelist rows are in place.
//
// Usage:  node scripts/fix-superadmin.mjs <password>
// If no password is supplied, the script keeps whatever is already set.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const email = 'superadmin@tcetmumbai.in';
const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/fix-superadmin.mjs <password>');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1) Find or create the auth user
const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) {
  console.error('Failed to list auth users:', listError.message);
  process.exit(1);
}

let authUser = listData.users.find((u) => u.email?.toLowerCase() === email);

if (authUser) {
  console.log('• Auth user already exists, updating password…');
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: { name: 'TCET Super Admin', seededRole: 'superadmin' },
  });
  if (error) {
    console.error('Failed to update auth user:', error.message);
    process.exit(1);
  }
  authUser = data.user;
} else {
  console.log('• Creating auth user…');
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'TCET Super Admin', seededRole: 'superadmin' },
  });
  if (error) {
    console.error('Failed to create auth user:', error.message);
    process.exit(1);
  }
  authUser = data.user;
}

console.log('  auth uid =', authUser.id);

// 2) Upsert the users table profile
const profile = {
  id: authUser.id,
  name: 'TCET Super Admin',
  email,
  role: 'superadmin',
  rollNo: 'SUPERADMIN',
  erpNo: 'SUPERADMIN',
  department: 'Internet of Things (IoT)',
  division: '',
  academicBatch: '',
  tgmApprovalStatus: 'approved',
  approvedBy: 'System Bootstrap',
  approvedAt: new Date().toISOString(),
  customRole: 'Principal & Super Admin',
};

const { data: existingProfile } = await supabase
  .from('users')
  .select('id')
  .eq('email', email)
  .maybeSingle();

let profileErr;
if (existingProfile) {
  if (existingProfile.id !== authUser.id) {
    // The profile id is stale (different from the auth uid). Realign it.
    console.log('• Realigning users.id to match the new auth uid…');
    const { error: realignErr } = await supabase
      .from('users')
      .update({ id: authUser.id })
      .eq('email', email);
    if (realignErr) {
      console.warn('  could not realign id (likely a dependent row). Will try update by id.');
    }
  }
  const { error } = await supabase
    .from('users')
    .update(profile)
    .eq('email', email);
  profileErr = error;
} else {
  const { error } = await supabase.from('users').insert(profile);
  profileErr = error;
}

if (profileErr) {
  console.error('Failed to write users profile:', profileErr.message);
  process.exit(1);
}
console.log('• users profile OK (role=superadmin, tgmApprovalStatus=approved)');

// 3) Upsert the admins whitelist
const whitelist = {
  id: authUser.id,
  email,
  name: 'TCET Super Admin',
  designation: 'Principal & Super Admin',
  department: 'Internet of Things (IoT)',
  addedBy: 'System Bootstrap',
  addedAt: new Date().toISOString().slice(0, 10),
  isWhitelisted: true,
  approvalStatus: 'approved',
};

const { data: existingAdmin } = await supabase
  .from('admins')
  .select('id')
  .eq('email', email)
  .maybeSingle();

if (existingAdmin) {
  const { error } = await supabase.from('admins').update(whitelist).eq('email', email);
  if (error) {
    console.error('Failed to update admins row:', error.message);
    process.exit(1);
  }
} else {
  const { error } = await supabase.from('admins').insert(whitelist);
  if (error) {
    console.error('Failed to insert admins row:', error.message);
    process.exit(1);
  }
}
console.log('• admins whitelist OK (isWhitelisted=true, approvalStatus=approved)');

console.log('\nDone. Super Admin credentials are now:');
console.log('  email:    ', email);
console.log('  password: ', password);
console.log('  auth uid: ', authUser.id);
