import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase configuration');

const email = 'superadmin@tcetmumbai.in';
const password = `Tcet!${randomBytes(15).toString('base64url')}9Z`;
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

let authUser = authUsers.users.find((user) => user.email?.toLowerCase() === email);
if (authUser) {
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: { name: 'TCET Super Admin', seededRole: 'superadmin' },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'TCET Super Admin', seededRole: 'superadmin' },
  });
  if (error) throw error;
  authUser = data.user;
}

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
const { data: existingProfiles, error: profileLookupError } = await supabase
  .from('users').select('id').eq('email', email);
if (profileLookupError) throw profileLookupError;
const profileQuery = existingProfiles.length
  ? supabase.from('users').update(profile).eq('email', email)
  : supabase.from('users').insert(profile);
const { error: profileError } = await profileQuery;
if (profileError) throw profileError;
const { error: approvalError } = await supabase.from('users').update({
  role: 'superadmin',
  tgmApprovalStatus: 'approved',
  approvedBy: 'System Bootstrap',
  approvedAt: new Date().toISOString(),
}).eq('email', email);
if (approvalError) throw approvalError;

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
const { data: existingAdmins, error: adminLookupError } = await supabase
  .from('admins').select('id').eq('email', email);
if (adminLookupError) throw adminLookupError;
const whitelistQuery = existingAdmins.length
  ? supabase.from('admins').update(whitelist).eq('email', email)
  : supabase.from('admins').insert(whitelist);
const { error: whitelistError } = await whitelistQuery;
if (whitelistError) throw whitelistError;

console.log(JSON.stringify({
  target: new URL(url).host,
  email,
  password,
  userId: authUser.id,
}, null, 2));
