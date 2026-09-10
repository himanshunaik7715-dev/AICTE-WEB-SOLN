import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
export async function registrationDecision(req: Request, res: Response, approve: boolean) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  if (!url || !key) return res.status(503).json({ error: 'Authentication unavailable' });
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error: authError } = await db.auth.getUser(token);
  if (authError || !data.user) return res.status(401).json({ error: 'Invalid session' });
  const target = String(req.body?.userIdOrEmail || '').trim();
  if (!target) return res.status(400).json({ error: 'User is required' });
  const { error } = await db.rpc('decide_registration', { target, approve });
  if (error) return res.status(403).json({ error: error.message });
  return res.json({ success: true });
}
