import React from "react";
import { ActivityCategoryGuide } from "./ActivityCategoryGuide";
import {
  GraduationCap,
  BookOpen,
  Award,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

interface RoleSelectionPageProps {
  onSelectRole: (role: "student" | "cr" | "admin") => void;
}

interface RoleCard {
  role: "student" | "cr" | "admin";
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  access: string;
}

const roles: RoleCard[] = [
  {
    role: "student",
    number: "01",
    icon: <GraduationCap className="h-7 w-7" strokeWidth={1.5} />,
    title: "Student",
    subtitle: "Build your activity portfolio",
    description:
      "Submit certificates, monitor verification progress, and track AICTE points across every semester.",
    access: "Institutional account",
  },
  {
    role: "cr",
    number: "02",
    icon: <Award className="h-7 w-7" strokeWidth={1.5} />,
    title: "CR / Club Head",
    subtitle: "Stage-one verification",
    description:
      "Review submissions for your assigned class or club before forwarding validated records to the mentor.",
    access: "Approval required",
  },
  {
    role: "admin",
    number: "03",
    icon: <BookOpen className="h-7 w-7" strokeWidth={1.5} />,
    title: "Teacher / Mentor",
    subtitle: "Final academic review",
    description:
      "Verify assigned student activities, approve eligible points, and oversee progress across your division.",
    access: "Approval required",
  },
];

export const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({
  onSelectRole,
}) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full min-w-0 max-w-[1440px] flex-col px-3 min-[481px]:px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/15 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/tcet-logo.ico"
              alt="TCET logo"
              className="h-11 w-11 shrink-0 object-contain min-[481px]:h-14 min-[481px]:w-14 sm:h-16 sm:w-16"
            />
            <img
              src="/TCET IOT LOGO.png"
              alt="TCET IOT logo"
              className="h-11 w-11 shrink-0 object-contain min-[481px]:h-14 min-[481px]:w-14 sm:h-16 sm:w-16"
            />
            <div className="min-w-0 border-l border-white/20 pl-4">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                TCET
              </p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-[#7e7e7e] sm:text-xs">
                AICTE Activity Points Portal
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#bbbbbb] sm:flex">
            <ShieldCheck className="h-4 w-4 text-white" strokeWidth={1.5} />
            Secure institutional access
          </div>
        </header>

        <div aria-hidden="true" className="flex h-1 w-full">
          <span className="w-1/3 bg-[#0066b1]" />
          <span className="w-1/3 bg-[#1c69d4]" />
          <span className="w-1/3 bg-[#e22718]" />
        </div>

        <main className="flex flex-1 flex-col justify-center py-8 min-[481px]:py-14 sm:py-20 lg:py-24">
          <div className="grid items-end gap-8 border-b border-white/15 pb-10 lg:grid-cols-[1.5fr_0.7fr] lg:pb-14">
            <div>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#bbbbbb]">
                Thakur College of Engineering &amp; Technology · Autonomous
              </p>
              <h1 className="max-w-4xl text-[clamp(2.25rem,10vw,6.25rem)] font-bold uppercase leading-[0.92] tracking-[-0.04em]">
                Select your
                <br />
                portal.
              </h1>
            </div>

            <div className="max-w-lg lg:justify-self-end">
            <p className="text-sm font-light leading-7 text-[#bbbbbb] sm:text-base">
              One verified workspace for activity certificates, structured
              reviews, and semester-wise AICTE point tracking. Continue with
              your assigned institutional role.
            </p>
            <a
              href="#activity-category-guide"
              className="mt-4 inline-block rounded border border-white/30 px-4 py-3 text-sm font-semibold text-white underline underline-offset-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              View all 16 categories &amp; filename guide
            </a>
            </div>
          </div>

          <div className="grid border-x border-b border-white/15 md:grid-cols-3">
            {roles.map((card) => (
              <button
                key={card.role}
                id={`role-card-${card.role}`}
                type="button"
                onClick={() => onSelectRole(card.role)}
                className="group relative flex min-h-64 min-[481px]:min-h-[300px] flex-col overflow-hidden border-t border-white/15 bg-[#0d0d0d] p-5 sm:p-6 text-left transition-colors duration-300 hover:bg-[#1a1a1a] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white md:min-h-[360px] md:border-t-0 md:border-r md:last:border-r-0 lg:p-8"
              >
                <span className="absolute right-5 top-4 text-5xl font-bold tracking-[-0.06em] text-white/[0.06] lg:text-7xl">
                  {card.number}
                </span>

                <div className="relative flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center border border-white/25 text-white transition-colors group-hover:border-white">
                    {card.icon}
                  </div>
                  <ArrowUpRight
                    className="h-5 w-5 text-[#7e7e7e] transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white"
                    strokeWidth={1.5}
                  />
                </div>

                <div className="mt-auto pt-16">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7e7e7e]">
                    {card.access}
                  </p>
                  <h2 className="text-2xl font-bold uppercase tracking-[-0.02em] sm:text-3xl">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#e6e6e6]">
                    {card.subtitle}
                  </p>
                  <div className="my-5 h-px bg-white/15" />
                  <p className="max-w-sm text-sm font-light leading-6 text-[#bbbbbb]">
                    {card.description}
                  </p>
                </div>

                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 flex h-1 translate-y-full transition-transform duration-300 group-hover:translate-y-0"
                >
                  <span className="w-1/3 bg-[#0066b1]" />
                  <span className="w-1/3 bg-[#1c69d4]" />
                  <span className="w-1/3 bg-[#e22718]" />
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-x border-b border-white/15 bg-black px-6 py-5 text-[10px] uppercase tracking-[0.14em] text-[#7e7e7e] sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>Use an authorised @tcetmumbai.in account</span>
            <span>CR and mentor access requires approval</span>
          </div>
          <ActivityCategoryGuide />
        </main>
      </div>
    </div>
  );
};
