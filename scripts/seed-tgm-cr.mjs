import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase configuration');

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const faculty = [
  { name: 'Sonal Dubal', email: 'sonal.dubal@tcetmumbai.in', batch: '2025-2029', division: 'A', groups: ['ST-A1'] },
  { name: 'Sakshi Sukhale', email: 'sakshi.sukhale@tcetmumbai.in', batch: '2025-2029', division: 'A', groups: ['ST-A2', 'ST-A3'] },
  { name: 'Usha Gupta', email: 'usha.gupta@tcetmumbai.in', batch: '2025-2029', division: 'B', groups: ['ST-B1'] },
  { name: 'Ashwini Haryan', email: 'ashwini.haryan@tcetmumbai.in', batch: '2025-2029', division: 'B', groups: ['ST-B2', 'ST-B3'] },
  { name: 'Amit Maurya', email: 'amit.maurya@tcetmumbai.in', batch: '2024-2028', division: '', groups: ['TT-E1'] },
  { name: 'Ekta Desai', email: 'ekta.desai@tcetmumbai.in', batch: '2024-2028', division: '', groups: ['TT-E2'] },
  { name: 'Priyanka Musale', email: 'priyanka.musale@tcetmumbai.in', batch: '2023-2027', division: '', groups: ['BT-E1'] },
  { name: 'Sunil Khatri', email: 'sunil.khatri@tcetmumbai.in', batch: '2023-2027', division: '', groups: ['BT-E2'] },
];

const crAccounts = [
  { name: 'ST CR A', email: 'cr.st.a@tcetmumbai.in', batch: '2025-2029', division: 'A', code: 'ST' },
  { name: 'ST CR B', email: 'cr.st.b@tcetmumbai.in', batch: '2025-2029', division: 'B', code: 'ST' },
  { name: 'TT CR 1', email: 'cr.tt.1@tcetmumbai.in', batch: '2024-2028', division: '', code: 'TT' },
  { name: 'TT CR 2', email: 'cr.tt.2@tcetmumbai.in', batch: '2024-2028', division: '', code: 'TT' },
  { name: 'BT CR 1', email: 'cr.bt.1@tcetmumbai.in', batch: '2023-2027', division: '', code: 'BT' },
  { name: 'BT CR 2', email: 'cr.bt.2@tcetmumbai.in', batch: '2023-2027', division: '', code: 'BT' },
];

const password = () => `Tc!${randomBytes(12).toString('base64url')}9a`;

const { data: authData, error: authListError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (authListError) throw authListError;
const authByEmail = new Map((authData.users || []).map((user) => [user.email?.toLowerCase(), user]));

for (const item of faculty) {
  const { data: existing, error: lookupError } = await supabase
    .from('admins').select('id').eq('email', item.email).maybeSingle();
  if (lookupError) throw lookupError;
  const record = {
    id: existing?.id || randomUUID(),
    email: item.email,
    name: item.name,
    designation: `Teacher Guardian Mentor (TGM) · ${item.groups.join(', ')}`,
    department: 'Internet of Things (IoT)',
    addedBy: 'Institutional TGM Seed',
    addedAt: new Date().toISOString().slice(0, 10),
    isWhitelisted: true,
    approvalStatus: 'approved',
  };
  const facultyQuery = existing
    ? supabase.from('admins').update(record).eq('email', item.email)
    : supabase.from('admins').insert(record);
  const { error } = await facultyQuery;
  if (error) throw error;

  const facultyProfile = {
    id: record.id,
    name: item.name,
    email: item.email,
    role: 'admin',
    rollNo: 'FAC',
    erpNo: `FAC-${item.email.split('@')[0].toUpperCase()}`,
    department: 'Internet of Things (IoT)',
    division: item.division,
    academicBatch: item.batch,
    tgmApprovalStatus: 'approved',
    approvedBy: 'Institutional TGM Seed',
    approvedAt: new Date().toISOString(),
    customRole: item.groups.join(', '),
  };
  const { data: facultyProfiles, error: facultyProfileLookupError } = await supabase
    .from('users').select('id').eq('email', item.email);
  if (facultyProfileLookupError) throw facultyProfileLookupError;
  const facultyProfileQuery = facultyProfiles.length
    ? supabase.from('users').update(facultyProfile).eq('email', item.email)
    : supabase.from('users').insert(facultyProfile);
  const { error: facultyProfileError } = await facultyProfileQuery;
  if (facultyProfileError) throw facultyProfileError;
  const { error: facultyApprovalError } = await supabase.from('users').update({
    role: 'admin',
    tgmApprovalStatus: 'approved',
    approvedBy: 'Institutional TGM Seed',
    approvedAt: new Date().toISOString(),
  }).eq('email', item.email);
  if (facultyApprovalError) throw facultyApprovalError;
}

const credentials = [];
if (!process.argv.includes('--faculty-only')) for (const item of crAccounts) {
  const temporaryPassword = password();
  let authUser = authByEmail.get(item.email);
  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: temporaryPassword,
      email_confirm: true,
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: item.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { name: item.name, seededRole: 'cr' },
    });
    if (error) throw error;
    authUser = data.user;
  }

  const profile = {
    id: authUser.id,
    name: item.name,
    email: item.email,
    role: 'cr',
    rollNo: item.name.replaceAll(' ', '-'),
    erpNo: `CR-${item.code}-${item.division || item.name.slice(-1)}`,
    department: 'Internet of Things (IoT)',
    division: item.division,
    academicBatch: item.batch,
    tgmApprovalStatus: 'approved',
    customRole: 'Class Representative (CR)',
    crName: item.name,
  };
  const { data: existingProfiles, error: profileLookupError } = await supabase
    .from('users').select('id').eq('email', item.email);
  if (profileLookupError) throw profileLookupError;
  const profileQuery = existingProfiles.length
    ? supabase.from('users').update(profile).eq('email', item.email)
    : supabase.from('users').insert(profile);
  const { error: profileError } = await profileQuery;
  if (profileError) throw profileError;
  const { error: approvalError } = await supabase
    .from('users')
    .update({ tgmApprovalStatus: 'approved', approvedBy: 'Institutional Seed', approvedAt: new Date().toISOString() })
    .eq('email', item.email);
  if (approvalError) throw approvalError;

  credentials.push({
    academicBatch: item.batch,
    cr: item.name,
    division: item.division || null,
    email: item.email,
    temporaryPassword,
    crId: authUser.id,
  });
}

console.log(JSON.stringify({
  target: new URL(url).host,
  facultyWhitelistCount: faculty.length,
  credentials,
}, null, 2));
