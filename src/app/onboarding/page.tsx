import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/auth/server-session";
import { findActiveMembershipByUser } from "@/modules/members/member.repository";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your wedding — Make My Marriage" };

// Stitch screen: "Make My Marriage — Set Up Your Wedding (Onboarding)". Step 2 of 2 after signup
// (email/password or Google): creates the wedding with the signed-in person as its owner.
export default async function OnboardingPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  if (await findActiveMembershipByUser(auth.userId)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FAF6F0] text-[#2A2622] selection:bg-[#1F4D3D]/20 selection:text-[#1F4D3D] lg:flex-row">
      {/* Left: brand panel (45% on desktop) */}
      <div className="relative flex min-h-[340px] w-full flex-col justify-between overflow-hidden bg-[#1F4D3D] p-8 text-[#FAF6F0] sm:p-12 lg:min-h-screen lg:w-[45%] lg:p-16">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
          viewBox="0 0 600 900"
          fill="none"
        >
          <circle
            cx="180"
            cy="450"
            r="320"
            stroke="#FAF6F0"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <circle cx="180" cy="450" r="480" stroke="#FAF6F0" strokeWidth="1" strokeOpacity="0.6" />
          <circle
            cx="180"
            cy="450"
            r="620"
            stroke="#FAF6F0"
            strokeWidth="0.75"
            strokeOpacity="0.3"
          />
          <path
            d="M-60 850C140 760 300 840 500 700C650 595 720 380 620 200"
            stroke="#FAF6F0"
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
          <path
            d="M-100 200C120 180 260 340 440 280C560 240 680 120 720 -20"
            stroke="#FAF6F0"
            strokeWidth="0.8"
            strokeOpacity="0.35"
          />
        </svg>

        <div className="relative z-10 flex items-center justify-between">
          <span className="font-display text-2xl font-medium tracking-tight text-[#FAF6F0] lg:text-3xl">
            Make My Marriage
          </span>
          <span className="inline-flex items-center rounded-full border border-[#FAF6F0]/15 bg-[#FAF6F0]/10 px-2.5 py-1 text-xs font-medium tracking-wide text-[#FAF6F0]/80">
            Workspace Onboarding
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-md py-10 lg:py-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FAF6F0]/15 bg-[#FAF6F0]/10 px-3 py-1 text-xs font-medium text-[#FAF6F0]/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E5A882]" />
            <span>Unified Family &amp; Planner Architecture</span>
          </div>
          <h1 className="mb-5 font-display text-3xl leading-[1.15] font-normal tracking-[-0.02em] text-[#FAF6F0] sm:text-4xl lg:text-5xl">
            Plan your wedding. <br />
            <span className="font-light text-[#FAF6F0]/90 italic">Together.</span>
          </h1>
          <p className="mb-8 text-sm leading-relaxed font-light text-[#FAF6F0]/80 sm:text-base">
            One shared space for your families, coordinators, and schedules — completely private,
            encrypted, and synchronized in real time.
          </p>
          <div className="grid grid-cols-2 gap-4 border-t border-[#FAF6F0]/15 pt-6 text-xs">
            <div>
              <p className="mb-0.5 text-sm font-semibold text-[#FAF6F0]">Role-Isolated</p>
              <p className="text-[#FAF6F0]/70">Budgets stay private to wedding owners.</p>
            </div>
            <div>
              <p className="mb-0.5 text-sm font-semibold text-[#FAF6F0]">Single Source</p>
              <p className="text-[#FAF6F0]/70">Replaces chaotic WhatsApp chats &amp; sheets.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-[#FAF6F0]/10 pt-6 text-xs text-[#FAF6F0]/60">
          <span>EST. 2025</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            PRODUCTION OS • SECURE INFRASTRUCTURE
          </span>
        </div>
      </div>

      {/* Right: setup form (55% on desktop) */}
      <OnboardingForm email={auth.user.email} />
    </div>
  );
}
