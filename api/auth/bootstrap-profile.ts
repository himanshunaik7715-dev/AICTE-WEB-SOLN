import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
  if (authError || !authUser?.email || !authUser.email.toLowerCase().endsWith('@tcetmumbai.in')) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }

  const email = authUser.email.trim().toLowerCase();
  const { data: whitelist, error: whitelistError } = await db
    .from('admins')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (whitelistError || !whitelist || !whitelist.isWhitelisted || whitelist.approvalStatus !== 'approved') {
    return res.status(403).json({ success: false, error: 'Faculty account is not whitelisted' });
  }

  const { data: existing } = await db.from('users').select('*').eq('email', email).maybeSingle();
  const isSuperadmin =
    existing?.role === 'superadmin' ||
    authUser.user_metadata?.seededRole === 'superadmin' ||
    String(whitelist.designation || '').toLowerCase().includes('super admin');
  const profile = {
    id: authUser.id,
    name: whitelist.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0],
    email,
    role: isSuperadmin ? 'superadmin' : 'admin',
    rollNo: isSuperadmin ? 'SUPERADMIN' : 'FAC',
    erpNo: isSuperadmin ? 'SUPERADMIN' : `FAC-${email.split('@')[0].toUpperCase()}`,
    department: whitelist.department || 'Internet of Things (IoT)',
    division: existing?.division || '',
    academicBatch: existing?.academicBatch || '',
    tgmApprovalStatus: 'approved',
    approvedBy: existing?.approvedBy || 'Approved Whitelist Bootstrap',
    approvedAt: existing?.approvedAt || new Date().toISOString(),
    customRole: existing?.customRole,
  };

  const { data, error } = await db.from('users').upsert(profile).select('*').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  return res.status(200).json({ success: true, recognized: true, profile: data });
}
