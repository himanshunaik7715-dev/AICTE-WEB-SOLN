import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  const userIdOrEmail = String(req.body?.userIdOrEmail || '').trim();
  if (!url || !serviceKey) return res.status(503).json({ success: false, error: 'Server authentication is not configured' });
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (!userIdOrEmail) return res.status(400).json({ success: false, error: 'A user ID or email is required' });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const authUser = authData.user;
  if (authError || !authUser?.email) return res.status(401).json({ success: false, error: 'Invalid or expired session' });

  const actorEmail = authUser.email.trim().toLowerCase();
  const [{ data: actorProfile }, { data: actorWhitelist }] = await Promise.all([
    db.from('users').select('id,name,role').eq('email', actorEmail).maybeSingle(),
    db.from('admins').select('id,isWhitelisted,approvalStatus').eq('email', actorEmail).maybeSingle(),
  ]);
  if (
    actorProfile?.id !== authUser.id || actorProfile.role !== 'superadmin' ||
    actorWhitelist?.id !== authUser.id || !actorWhitelist.isWhitelisted || actorWhitelist.approvalStatus !== 'approved'
  ) {
    return res.status(403).json({ success: false, error: 'Approved Superadmin access is required' });
  }

  const isEmail = userIdOrEmail.includes('@');
  const normalizedKey = isEmail ? userIdOrEmail.toLowerCase() : userIdOrEmail;
  const [{ data: profile }, { data: admin }] = await Promise.all([
    isEmail
      ? db.from('users').select('*').eq('email', normalizedKey).maybeSingle()
      : db.from('users').select('*').eq('id', normalizedKey).maybeSingle(),
    isEmail
      ? db.from('admins').select('*').eq('email', normalizedKey).maybeSingle()
      : db.from('admins').select('*').eq('id', normalizedKey).maybeSingle(),
  ]);
  if (!profile && !admin) return res.status(404).json({ success: false, error: 'Pending request was not found' });

  const approvedAt = new Date().toISOString();
  if (profile) {
    const { error } = await db.from('users').update({
      tgmApprovalStatus: 'approved',
      approvedBy: actorProfile.name || 'Super Admin',
      approvedAt,
    }).eq('id', profile.id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  }
  if (admin) {
    const { error } = await db.from('admins').update({
      isWhitelisted: true,
      approvalStatus: 'approved',
    }).eq('id', admin.id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({
    success: true,
    email: profile?.email || admin?.email,
    userId: profile?.id || null,
    adminId: admin?.id || null,
  });
}
