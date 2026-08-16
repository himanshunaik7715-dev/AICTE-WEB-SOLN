import React, { useState } from 'react';
import { AdminUser, UserProfile } from '../types';
import {
  ShieldCheck, Crown, UserCheck, UserX, UserPlus, Shield, Trash2, RotateCcw, Clock, Users, GraduationCap, CheckCircle2, X,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  admins: AdminUser[];
  allUsers?: UserProfile[];
  onAddAdmin: (newAdmin: Omit<AdminUser, 'id' | 'addedAt'>) => void;
  onRemoveAdmin: (id: string) => void;
  onApproveTgmUser?: (userIdOrEmail: string) => void;
  onRejectTgmUser?: (userIdOrEmail: string) => void;
  studentProfile: UserProfile;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  admins,
  allUsers = [],
  onAddAdmin,
  onRemoveAdmin,
  onApproveTgmUser,
  onRejectTgmUser,
  studentProfile,
}) => {
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminDesignation, setNewAdminDesignation] = useState('Teacher Guardian Mentor (TGM)');
  const [newAdminDept, setNewAdminDept] = useState('Internet of Things (IoT)');

  // Pending approvals
  const pendingRequestsMap = new Map<string, { id: string; name: string; email: string; department: string; designation: string; date: string; role: 'admin' | 'superadmin' }>();

  allUsers.filter((u) => u.role === 'admin' && u.tgmApprovalStatus === 'pending').forEach((u) => {
    pendingRequestsMap.set(u.email.toLowerCase(), {
      id: u.id, name: u.name, email: u.email,
      department: u.department || 'Internet of Things (IoT)',
      designation: 'Teacher Guardian Mentor (TGM)',
      date: 'Recent Sign-Up Request', role: 'admin',
    });
  });

  allUsers.filter((u) => u.role === 'superadmin' && u.tgmApprovalStatus === 'pending' && u.email.toLowerCase() !== 'superadmin@tcetmumbai.in').forEach((u) => {
    pendingRequestsMap.set(u.email.toLowerCase(), {
      id: u.id, name: u.name, email: u.email,
      department: u.department || 'Institutional Head Office',
      designation: 'Super Admin (Applicant)',
      date: 'Recent Sign-Up Request', role: 'superadmin',
    });
  });

  admins.filter((a) => a.approvalStatus === 'pending' || (a.addedBy.includes('Request') && !a.isWhitelisted)).forEach((a) => {
    const isSuperApp = a.designation.includes('Super Admin') || a.addedBy.includes('Super Admin');
    pendingRequestsMap.set(a.email.toLowerCase(), {
      id: a.id, name: a.name, email: a.email,
      department: a.department, designation: a.designation,
      date: a.addedAt || 'Recent Sign-Up Request',
      role: isSuperApp ? 'superadmin' : 'admin',
    });
  });

  const allPendingRequests = Array.from(pendingRequestsMap.values());
  const pendingSuperAdminRequests = allPendingRequests.filter((r) => r.role === 'superadmin');
  const pendingTgmRequests = allPendingRequests.filter((r) => r.role !== 'superadmin');

  const approvedTgms = allUsers.filter((u) => u.role === 'admin' && u.tgmApprovalStatus === 'approved');
  const totalStudents = allUsers.filter((u) => u.role === 'student').length;

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminName.trim()) { alert('Please fill out email and name.'); return; }
    onAddAdmin({ email: newAdminEmail.trim(), name: newAdminName.trim(), designation: newAdminDesignation, department: newAdminDept, addedBy: 'System Admin (Current Session)', isWhitelisted: true });
    setNewAdminEmail(''); setNewAdminName(''); setShowAddAdminModal(false);
  };

  // Pending authorization screen for unapproved super admins
  const isSeedSuperAdmin = studentProfile.email.toLowerCase() === 'superadmin@tcetmumbai.in';
  const isApprovedSuperAdmin = isSeedSuperAdmin || (studentProfile.role === 'superadmin' && (studentProfile.tgmApprovalStatus === 'approved' || admins.some((a) => a.email.toLowerCase() === studentProfile.email.toLowerCase() && (a.isWhitelisted || a.approvalStatus === 'approved'))));

  if (!isApprovedSuperAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-8 max-w-2xl mx-auto my-12 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <div>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
            ⏳ Super Admin Registration Pending Approval
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-3">Awaiting Existing Super Admin Authorization</h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Welcome, <strong>{studentProfile.name}</strong>. Your Super Admin request has been submitted for official verification.
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">Applicant Name:</span><span className="font-bold text-slate-900">{studentProfile.name}</span></div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">Email Address:</span><span className="font-mono text-slate-800">{studentProfile.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 font-medium">Approval Status:</span><span className="font-bold text-amber-600">Pending Decision</span></div>
        </div>
        <button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Refresh Authorization Status
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto space-y-6 pt-4 px-4 pb-12 sm:px-6 lg:px-8">

      {/* Super Admin Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-md border border-indigo-100">
              <Crown className="w-3.5 h-3.5 text-indigo-600" />
              Super Admin — System Administration
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{studentProfile.name}</h2>
            <p className="text-slate-500 text-xs">
              Manage TGM & Super Admin approvals, whitelist faculty, and administer system users.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {[
              { label: 'Total Students', value: totalStudents, color: 'text-slate-900' },
              { label: 'Approved TGMs', value: approvedTgms.length, color: 'text-emerald-600' },
              { label: 'Pending TGM Requests', value: pendingTgmRequests.length, color: 'text-amber-600' },
              { label: 'Pending SuperAdmin', value: pendingSuperAdminRequests.length, color: 'text-indigo-600' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-[110px]">
                <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Super Admin Signup Requests */}
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-indigo-100 bg-indigo-50/60 flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs"><Crown className="w-5 h-5" /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              Super Admin Sign-Up Approval Queue
              <span className="bg-indigo-100 text-indigo-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                {pendingSuperAdminRequests.length} Applicants
              </span>
            </h3>
            <p className="text-xs text-slate-600">Applicants requesting Super Admin / Principal privileges.</p>
          </div>
        </div>
        {pendingSuperAdminRequests.length === 0 ? (
          <div className="p-6 text-center bg-slate-50/30">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No Pending Super Admin Sign-Up Requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-indigo-50/50 text-indigo-950 font-bold border-b border-indigo-100 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Department / Office</th>
                  <th className="py-3 px-4">Requested Designation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100/60">
                {pendingSuperAdminRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />{req.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{req.email}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{req.department}</td>
                    <td className="py-3.5 px-4 text-indigo-800 font-bold">{req.designation}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">⏳ Awaiting Decision</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => onApproveTgmUser && onApproveTgmUser(req.email || req.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" /> Approve Super Admin
                        </button>
                        <button type="button" onClick={() => onRejectTgmUser && onRejectTgmUser(req.email || req.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                          <UserX className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending TGM Signup Requests */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl border border-amber-200"><ShieldCheck className="w-5 h-5 text-amber-700" /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              TGM Approval Queue
              <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200">{pendingTgmRequests.length} Pending</span>
            </h3>
            <p className="text-xs text-slate-600">Faculty members who registered as TGM awaiting approval.</p>
          </div>
        </div>
        {pendingTgmRequests.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/30">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No Pending TGM Sign-Up Requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/40 text-amber-900 font-bold border-b border-amber-100 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60">
                {pendingTgmRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />{req.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{req.email}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{req.department}</td>
                    <td className="py-3.5 px-4 text-slate-600">{req.designation}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">⏳ Pending Approval</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => onApproveTgmUser && onApproveTgmUser(req.email || req.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" /> Approve TGM
                        </button>
                        <button type="button" onClick={() => onRejectTgmUser && onRejectTgmUser(req.email || req.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                          <UserX className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Approved TGMs & Whitelist */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Active Approved TGMs & Whitelisted Admins
            </h3>
            <p className="text-xs text-slate-500">Faculty members granted Stage-2 verification privileges.</p>
          </div>
          <button type="button" onClick={() => setShowAddAdminModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer">
            <UserPlus className="w-4 h-4" /> Directly Whitelist Email
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Admin / TGM Name</th>
                <th className="py-3.5 px-4">Email Address</th>
                <th className="py-3.5 px-4">Designation</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Added/Approved By</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin, idx) => (
                <tr key={`${admin.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors border-b border-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{admin.name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{admin.email}</td>
                  <td className="py-3.5 px-4 text-slate-800">{admin.designation}</td>
                  <td className="py-3.5 px-4 text-slate-600">{admin.department}</td>
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">{admin.addedBy}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">Approved & Whitelisted ✓</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {admins.length > 1 && (
                      <button type="button" onClick={() => onRemoveAdmin(admin.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Revoke Whitelist Access">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System User Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'Total Registered Students', value: totalStudents, desc: 'Active in system', color: 'indigo' },
          { icon: ShieldCheck, label: 'Approved TGMs (from users table)', value: approvedTgms.length, desc: 'Stage-2 authorized', color: 'emerald' },
          { icon: GraduationCap, label: 'Whitelisted Faculty', value: admins.length, desc: 'In admin whitelist', color: 'purple' },
        ].map((card) => (
          <div key={card.label} className={`bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4`}>
            <div className={`w-10 h-10 rounded-xl bg-${card.color}-50 text-${card.color}-600 flex items-center justify-center border border-${card.color}-100 shrink-0`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{card.label}</p>
              <h4 className="text-2xl font-bold text-slate-900 mt-0.5">{card.value}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdmin} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" /> Add Whitelisted Admin / TGM Email
              </h3>
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input type="email" required placeholder="e.g. skmehta@tcetmumbai.in" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input type="text" required placeholder="e.g. Prof. Name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <select value={newAdminDesignation} onChange={(e) => setNewAdminDesignation(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none">
                  <option value="Teacher Guardian Mentor (TGM)">Teacher Guardian Mentor (TGM)</option>
                  <option value="Senior TGM & Assistant Professor">Senior TGM & Assistant Professor</option>
                  <option value="AICTE Activity Coordinator">AICTE Activity Coordinator</option>
                  <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department (Restricted)</label>
                <input type="text" readOnly value={newAdminDept} className="w-full border border-slate-300 bg-slate-100 text-slate-600 rounded-xl p-2.5 text-xs font-medium cursor-not-allowed" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddAdminModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer">Whitelist Email</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
