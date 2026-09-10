import { supabase } from '../lib/supabase';
import { CertificateSubmission, UserProfile } from '../types';

export interface AcademicScope { id: number; academic_batch: string; department: string; course: string; division: string; }
export interface ReviewerOption { assignment_id: number; reviewer_id: string; reviewer_role: 'cr' | 'admin'; name: string; tg_group: string; scope_id: number; }
export interface AcademicChange { id: number; student_id: string; original_scope_id: number; requested_scope_id: number; reason: string; status: string; remarks?: string; }
async function collectPages<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await load(from, from + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
export async function getStudentsForScope(scopeId?: number): Promise<UserProfile[]> {
  const ids = await collectPages<{student_id: string}>((from, to) => {
    let query = supabase.from('student_registry').select('student_id').order('student_id').range(from, to);
    if (scopeId !== undefined) query = query.eq('scope_id', scopeId);
    return query;
  });
  const rows: UserProfile[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('users').select('*').in('id', ids.slice(i, i + 100).map(r => r.student_id));
    if (error) throw error;
    rows.push(...(data || []) as UserProfile[]);
  }
  return rows;
}
export async function getSubmissionsForScope(scopeId?: number): Promise<CertificateSubmission[]> {
  const students = await getStudentsForScope(scopeId);
  const rows: CertificateSubmission[] = [];
  for (let i = 0; i < students.length; i += 100) {
    const ids = students.slice(i, i + 100).map(s => s.id);
    rows.push(...await collectPages<CertificateSubmission>((from, to) =>
      supabase.from('submissions').select('*').in('studentId', ids).order('id').range(from, to)));
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getReviewerOptions(): Promise<ReviewerOption[]> {
  const { data, error } = await supabase.rpc('get_reviewer_options');
  if (error) throw error;
  return data || [];
}
export async function getCRForScope() { return (await getReviewerOptions()).filter(r => r.reviewer_role === 'cr'); }
export async function getTGMForScope() { return (await getReviewerOptions()).filter(r => r.reviewer_role === 'admin'); }
export async function assignReviewer(id: number): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('assign_student_reviewer', { candidate_id: id });
  if (error) throw error;
  return data;
}
export async function updateStudentProfile(patch: { phoneNumber?: string; driveRootFolderId?: string }): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('update_student_profile', { patch });
  if (error) throw error;
  return data;
}
export async function getAcademicScopes(): Promise<AcademicScope[]> {
  const { data, error } = await supabase.from('academic_scopes').select('id,academic_batch,department,course,division').eq('enabled', true).order('academic_batch');
  if (error) throw error;
  return data || [];
}
export async function requestAcademicChange(scopeId: number, reason: string) {
  const { error } = await supabase.rpc('request_academic_change', { destination_scope: scopeId, change_reason: reason });
  if (error) throw error;
}
export async function getAcademicChanges(): Promise<AcademicChange[]> {
  const { data, error } = await supabase.from('academic_change_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function decideAcademicChange(id: number, approve: boolean, remarks: string) {
  const { error } = await supabase.rpc('decide_academic_change', { request_id: id, approve, decision_remarks: remarks });
  if (error) throw error;
}
