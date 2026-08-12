import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Award,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { UserRole } from '../types';

interface RoleSelectionPageProps {
  onSelectRole: (role: 'student' | 'cr' | 'admin') => void;
  onGoToSuperAdmin: () => void;
}

interface RoleCard {
  role: 'student' | 'cr' | 'admin';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  iconBg: string;
  border: string;
  tag: string;
  tagColor: string;
}

const roles: RoleCard[] = [
  {
    role: 'student',
    icon: <GraduationCap className="w-8 h-8" />,
    title: 'Student',
    subtitle: 'Manage your AICTE activities',
    description:
      'Upload certificates, track activity points across semesters, and monitor your submission status in real time.',
    gradient: 'from-indigo-600 to-violet-600',
    iconBg: 'bg-indigo-500/20 text-indigo-300',
    border: 'border-indigo-500/30 hover:border-indigo-400/60',
    tag: 'Open Access',
    tagColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    role: 'admin',
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Teacher / Mentor',
    subtitle: 'TGM — Teacher Guardian Mentor',
    description:
      'Review and approve student submissions at Stage-2. Manage your assigned class or division with full oversight.',
    gradient: 'from-emerald-600 to-teal-600',
    iconBg: 'bg-emerald-500/20 text-emerald-300',
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    tag: 'Requires Approval',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    role: 'cr',
    icon: <Award className="w-8 h-8" />,
    title: 'CR / Club Head',
    subtitle: 'Class Representative or Club Leader',
    description:
      'Stage-1 review of student certificates for your class or club. NSS Heads, Cultural Secretaries, and other Club Heads also sign in here.',
    gradient: 'from-rose-600 to-pink-600',
    iconBg: 'bg-rose-500/20 text-rose-300',
    border: 'border-rose-500/30 hover:border-rose-400/60',
    tag: 'Requires Approval',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
];

export const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({
  onSelectRole,
  onGoToSuperAdmin,
}) => {
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[600px] h-[300px] bg-rose-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300 leading-none">TCET</p>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">AICTE Activity Portal</p>
          </div>
        </div>

        {/* Super Admin link */}
        <button
          onClick={onGoToSuperAdmin}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-400 transition-colors duration-200 cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Super Admin
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Badge */}
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-indigo-300 tracking-wider uppercase">
            Thakur College of Engineering &amp; Technology (Autonomous)
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-black text-center tracking-tight mb-3 leading-tight">
          <span className="text-white">Who are</span>{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400 bg-clip-text text-transparent">
            you?
          </span>
        </h1>
        <p className="text-slate-400 text-sm text-center max-w-md mb-12 leading-relaxed">
          Select your role to continue to the right portal. Only{' '}
          <strong className="text-slate-300">@tcetmumbai.in</strong> accounts are
          permitted.
        </p>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl">
          {roles.map((card) => (
            <button
              key={card.role}
              id={`role-card-${card.role}`}
              onClick={() => onSelectRole(card.role)}
              onMouseEnter={() => setHoveredRole(card.role)}
              onMouseLeave={() => setHoveredRole(null)}
              className={`group relative flex flex-col text-left bg-slate-900/80 backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 cursor-pointer overflow-hidden ${card.border} ${
                hoveredRole === card.role
                  ? 'shadow-2xl -translate-y-1 scale-[1.02]'
                  : 'shadow-lg'
              }`}
              style={{
                boxShadow:
                  hoveredRole === card.role
                    ? `0 20px 60px -10px rgba(0,0,0,0.5)`
                    : undefined,
              }}
            >
              {/* Gradient shimmer on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}
              />

              {/* Top row: icon + tag */}
              <div className="flex items-start justify-between mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${card.iconBg} border border-white/5 transition-transform duration-300 group-hover:scale-110`}
                >
                  {card.icon}
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${card.tagColor}`}
                >
                  {card.tag}
                </span>
              </div>

              {/* Title & subtitle */}
              <h2 className="text-lg font-black text-white mb-0.5">{card.title}</h2>
              <p className="text-[11px] font-semibold text-slate-400 mb-3">{card.subtitle}</p>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed flex-1">{card.description}</p>

              {/* CTA row */}
              <div
                className={`flex items-center gap-1.5 mt-5 text-xs font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}
              >
                Continue
                <ArrowRight
                  className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1 ${
                    card.role === 'student'
                      ? 'text-indigo-400'
                      : card.role === 'admin'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>

        {/* Info note */}
        <p className="mt-8 text-[11px] text-slate-600 text-center max-w-sm">
          Teacher / Mentor (TGM) and CR / Club Head roles require approval by the Super
          Admin before dashboard access is granted.
        </p>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-6 px-4">
        <p className="text-[11px] text-slate-700">
          © 2026 Thakur College of Engineering &amp; Technology (Autonomous). All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};
