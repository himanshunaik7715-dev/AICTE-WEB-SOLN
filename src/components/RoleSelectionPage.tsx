import React, { useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Award,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface RoleSelectionPageProps {
  onSelectRole: (role: "student" | "cr" | "admin") => void;
  onGoToSuperAdmin: () => void;
}

interface RoleCard {
  role: "student" | "cr" | "admin";
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
    role: "student",
    icon: <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8" />,
    title: "Student",
    subtitle: "Manage your AICTE activities",
    description:
      "Upload certificates, track activity points across semesters, and monitor your submission status in real time.",
    gradient: "from-indigo-500 to-violet-500",
    iconBg: "bg-indigo-500/15 text-indigo-300",
    border: "border-indigo-500/30 hover:border-indigo-400/70",
    tag: "Open Access",
    tagColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  {
    role: "cr",
    icon: <Award className="w-7 h-7 sm:w-8 sm:h-8" />,
    title: "CR / Club Head",
    subtitle: "Class Representative or Club Leader",
    description:
    "Stage-1 review of student certificates for your class or club. NSS Heads, Cultural Secretaries, and other Club Heads also sign in here.",
    gradient: "from-rose-500 to-pink-500",
    iconBg: "bg-rose-500/15 text-rose-300",
    border: "border-rose-500/30 hover:border-rose-400/70",
    tag: "Requires Approval",
    tagColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    role: "admin",
    icon: <BookOpen className="w-7 h-7 sm:w-8 sm:h-8" />,
    title: "Teacher / Mentor",
    subtitle: "TGM — Teacher Guardian Mentor",
    description:
      "Review and approve student submissions at Stage-2. Manage your assigned class or division with full oversight.",
    gradient: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-500/15 text-emerald-300",
    border: "border-emerald-500/30 hover:border-emerald-400/70",
    tag: "Requires Approval",
    tagColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
];

export const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({
  onSelectRole,
}) => {
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-950 text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-indigo-600/10 blur-[120px]" />

        <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[120px]" />

        <div className="absolute left-1/2 top-1/2 h-[280px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/[0.04] blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25 sm:h-10 sm:w-10">
              <Sparkles className="h-5 w-5 text-white sm:h-5 sm:w-5" />
            </div>

            <div>
              <p className="text-xs font-bold leading-none text-slate-200 sm:text-sm">
                TCET
              </p>

              <p className="mt-0.5 text-[9px] leading-none text-slate-500 sm:text-[10px]">
                AICTE Activity Portal
              </p>
            </div>
          </div>
        </header>

        {/* Main Landing Content */}
        <main className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-6">
          {/* College Badge */}
          <div className="mb-3 flex max-w-full items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 sm:mb-4 sm:px-4">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-indigo-400" />

            <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-indigo-300 sm:text-[11px]">
              Thakur College of Engineering &amp; Technology (Autonomous)
            </span>
          </div>

          {/* Heading */}
          <h1 className="mb-2 px-4 sm:px-8 lg:px-0 text-center text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            <span className="text-white">Who are </span>

            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400 bg-clip-text pr-1 text-transparent">
              you?
            </span>
          </h1>

          <p className="mb-5 max-w-md text-center text-xs leading-relaxed text-slate-400 sm:mb-7 sm:text-sm">
            Select your role to continue to the right portal. Only{" "}
            <strong className="text-slate-200">@tcetmumbai.in</strong> accounts
            are permitted.
          </p>

          {/* Role Cards */}
          <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {roles.map((card) => (
              <button
                key={card.role}
                id={`role-card-${card.role}`}
                type="button"
                onClick={() => onSelectRole(card.role)}
                onMouseEnter={() => setHoveredRole(card.role)}
                onMouseLeave={() => setHoveredRole(null)}
                className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border bg-slate-900/75 p-4 text-left backdrop-blur-md transition-all duration-300 sm:min-h-[250px] sm:p-5 ${
                  card.border
                } ${
                  hoveredRole === card.role
                    ? "-translate-y-1 shadow-2xl"
                    : "shadow-lg"
                }`}
              >
                {/* Hover gradient */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.06]`}
                />

                {/* Decorative glow */}
                <div
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-30`}
                />

                {/* Card top */}
                <div className="relative z-10 mb-4 flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 ${card.iconBg} transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12`}
                  >
                    {card.icon}
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-bold sm:text-[10px] ${card.tagColor}`}
                  >
                    {card.tag}
                  </span>
                </div>

                {/* Card title */}
                <div className="relative z-10">
                  <h2 className="text-base font-black text-white sm:text-lg">
                    {card.title}
                  </h2>

                  <p
                    className={`mt-0.5 bg-gradient-to-r ${card.gradient} bg-clip-text text-[10px] font-semibold text-transparent sm:text-[11px]`}
                  >
                    {card.subtitle}
                  </p>
                </div>

                {/* Divider */}
                <div
                  className={`relative z-10 my-3 h-px w-full bg-gradient-to-r ${card.gradient} opacity-20`}
                />

                {/* Description */}
                <p className="relative z-10 flex-1 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                  {card.description}
                </p>

                {/* Continue */}
                <div
                  className={`relative z-10 mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r ${card.gradient} px-3 py-2 text-[11px] font-bold text-white shadow-lg transition-all duration-300 group-hover:brightness-110 sm:text-xs`}
                >
                  <span>Continue</span>

                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>

          {/* Approval Note */}
          <div className="max-w-sm rounded-xl border border-indigo-500/20 bg-slate-900/50 px-4 py-2.5 text-center backdrop-blur-sm sm:mt-6 sm:px-6">
            <p className="text-[9px] leading-relaxed text-slate-500 sm:text-[10px] sm:leading-relaxed sm:tracking-wide">
              Teacher / Mentor (TGM) and CR / Club Head roles require approval
              by the Super Admin before dashboard access is granted.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};
