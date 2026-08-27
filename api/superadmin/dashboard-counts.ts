import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !serviceKey) {
    return res.status(503).json({ success: false, error: 'Server authentication is not configured' });
  }
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const authUser = authData.user;
  if (authError || !authUser?.email) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }

  const email = authUser.email.trim().toLowerCase();
  const [{ data: profile }, { data: whitelist }] = await Promise.all([
    db.from('users').select('id,role').eq('email', email).maybeSingle(),
    db.from('admins').select('id,isWhitelisted,approvalStatus').eq('email', email).maybeSingle(),
  ]);
  const isApprovedSuperadmin =
    profile?.id === authUser.id &&
    profile.role === 'superadmin' &&
    whitelist?.id === authUser.id &&
    whitelist.isWhitelisted &&
    whitelist.approvalStatus === 'approved';
  if (!isApprovedSuperadmin) {
    return res.status(403).json({ success: false, error: 'Approved Superadmin access is required' });
  }

  const [
    { data: students, error: studentsError },
    { data: faculty, error: facultyError },
    { data: adminRows, error: adminsError },
  ] = await Promise.all([
    db.from('users').select('id,tgmId,tgmName').eq('role', 'student'),
    db.from('users').select('id,name,email,role,department,tgmApprovalStatus').in('role', ['admin', 'superadmin']),
    db.from('admins').select('id,name,email,department,designation,addedAt,addedBy,approvalStatus,isWhitelisted'),
  ]);
  if (studentsError || facultyError || adminsError) {
    return res.status(500).json({
      success: false,
      error: studentsError?.message || facultyError?.message || adminsError?.message || 'Unable to load dashboard data',
    });
  }

  const assignedStudentCounts: Record<string, number> = {};
  for (const tgm of (faculty || []).filter((user) => user.role === 'admin')) {
    const normalizedName = String(tgm.name || '').trim().toLowerCase();
    assignedStudentCounts[tgm.id] = (students || []).filter((student) =>
      student.tgmId === tgm.id ||
      (!student.tgmId && Boolean(student.tgmName) && String(student.tgmName).toLowerCase().includes(normalizedName)),
    ).length;
  }

  const pendingRequests = new Map<string, any>();
  for (const user of (faculty || []).filter((row) => row.tgmApprovalStatus === 'pending')) {
    if (user.email.toLowerCase() === 'superadmin@tcetmumbai.in') continue;
    pendingRequests.set(user.email.toLowerCase(), {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department || 'Internet of Things (IoT)',
      designation: user.role === 'superadmin' ? 'Super Admin (Applicant)' : 'Teacher Guardian Mentor (TGM)',
      date: 'Recent Sign-Up Request',
      role: user.role,
    });
  }
  for (const row of (adminRows || []).filter((admin) =>
    admin.approvalStatus === 'pending' || !admin.isWhitelisted || String(admin.addedBy || '').includes('Request'),
  )) {
    const isSuperadmin =
      String(row.designation || '').toLowerCase().includes('super admin') ||
      String(row.addedBy || '').toLowerCase().includes('super admin');
    pendingRequests.set(row.email.toLowerCase(), {
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department || 'Internet of Things (IoT)',
      designation: row.designation || (isSuperadmin ? 'Super Admin (Applicant)' : 'Teacher Guardian Mentor (TGM)'),
      date: row.addedAt || 'Recent Sign-Up Request',
      role: isSuperadmin ? 'superadmin' : 'admin',
    });
  }

  return res.status(200).json({
    success: true,
    registeredStudents: students?.length || 0,
    studentsWithSelectedTgm: (students || []).filter((student) => Boolean(student.tgmId)).length,
    assignedStudentCounts,
    pendingRequests: Array.from(pendingRequests.values()),
  });
}
