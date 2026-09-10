import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { UserProfile } from '../types';
import { AcademicScope, getAcademicScopes } from '../services/scopeService';
import { supabase } from '../lib/supabase';

export function StudentProfileEditor({ student, onSaved }: { student: UserProfile; onSaved: (p: UserProfile) => void }) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [scopes,setScopes]=useState<AcademicScope[]>([]), [scopeId,setScopeId]=useState('');
  const [name,setName]=useState(''), [erp,setErp]=useState(''), [roll,setRoll]=useState(''), [phone,setPhone]=useState('');
  useEffect(()=>{ if(!open)return; let active=true;
    setName(student.name);setErp(student.erpNo||'');setRoll(student.rollNo||'');setPhone(student.phoneNumber||'');setError('');setScopeId('');
    Promise.all([getAcademicScopes(),supabase.from('student_registry').select('scope_id').eq('student_id',student.id).single()]).then(([options,current])=>{
      if(current.error)throw current.error;if(active){setScopes(options);setScopeId(String(current.data.scope_id));}
    }).catch(()=>{if(active)setError('Unable to load academic options. Close and try again.');});
    return()=>{active=false;};
  },[open,student.id]);
  const selected=scopes.find(s=>String(s.id)===scopeId);
  const batches=[...new Set(scopes.map(s=>s.academic_batch))].sort();
  const batchScopes=scopes.filter(s=>s.academic_batch===selected?.academic_batch);
  const departments=[...new Set(batchScopes.map(s=>s.department))];
  const courses=[...new Set(batchScopes.filter(s=>s.department===selected?.department).map(s=>s.course))];
  const divisions=batchScopes.filter(s=>s.department===selected?.department&&s.course===selected?.course);
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const {data,error}=await supabase.rpc('edit_student_profile',{patch:{name:name.trim(),erpNo:erp.trim(),rollNo:roll.trim(),phoneNumber:phone.trim(),scope_id:Number(scopeId)}});
    if(error)throw error;onSaved(data);window.dispatchEvent(new Event('portal-scope-changed'));setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:(e as {message?:string})?.message||'Unable to save profile.');}finally{setBusy(false);}}
  const input='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return <><button type="button" onClick={()=>setOpen(true)} className="ml-2 inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil size={13}/>Edit Profile</button>
    {open&&createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setOpen(false);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between"><h2 id="edit-profile-title" className="text-xl font-bold text-slate-900">Edit Profile</h2><button aria-label="Close edit profile" type="button" disabled={busy} onClick={()=>setOpen(false)}><X size={20}/></button></div>
        <p className="mt-2 text-sm text-slate-500">Changing academic details refreshes your CR and TGM choices.</p>
        <form onSubmit={save} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700 sm:col-span-2">Name<input autoFocus required minLength={2} maxLength={120} className={input} value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="text-sm text-slate-700">ERP<input required pattern="[0-9]{6,12}" className={input} value={erp} onChange={e=>setErp(e.target.value)}/></label>
          <label className="text-sm text-slate-700">Roll No<input required maxLength={20} className={input} value={roll} onChange={e=>setRoll(e.target.value)}/></label>
          <label className="text-sm text-slate-700 sm:col-span-2">Academic year / batch<select required className={input} value={selected?.academic_batch||''} onChange={e=>setScopeId(String(scopes.find(s=>s.academic_batch===e.target.value)?.id||''))}><option value="">Select academic batch</option>{batches.map(b=><option key={b}>{b}</option>)}</select></label>
          <label className="text-sm text-slate-700 sm:col-span-2">Department<select required className={input} value={selected?.department||''} onChange={e=>setScopeId(String(batchScopes.find(s=>s.department===e.target.value)?.id||''))}><option value="">Select department</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label>
          <label className="text-sm text-slate-700">Course<select required className={input} value={selected?.course||''} onChange={e=>setScopeId(String(batchScopes.find(s=>s.department===selected?.department&&s.course===e.target.value)?.id||''))}><option value="">Select course</option>{courses.map(c=><option key={c}>{c}</option>)}</select></label>
          <label className="text-sm text-slate-700">Division<select required className={input} value={scopeId} onChange={e=>setScopeId(e.target.value)}><option value="">Select division</option>{divisions.map(s=><option key={s.id} value={s.id}>{s.division||'Not divided'}</option>)}</select></label>
          <label className="text-sm text-slate-700 sm:col-span-2">Phone number<input required pattern="[6-9][0-9]{9}" className={input} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
          {error&&<p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy||!selected} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Save changes'}</button></div>
        </form>
      </section>
    </div>,document.body)}</>;
}

