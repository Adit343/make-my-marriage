import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { parseInviteToken } from "@/lib/invite-link";
import { getServerSession } from "@/modules/auth/server-session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your wedding workspace — Make My Marriage" };

// Stitch screen: "Make My Marriage — Create Wedding Workspace (Interactive)".
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // /signup?invite=<token>: joining someone else's wedding, so a shorter form (no workspace setup).
  const invite = parseInviteToken((await searchParams).invite);
  if (await getServerSession()) redirect(invite ? `/join/${invite}` : "/dashboard");

  return (
    <main className="flex min-h-screen w-full flex-col bg-background text-on-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed lg:flex-row">
      {/* Left: brand anchor (45% on desktop) */}
      <div className="relative flex min-h-[440px] w-full flex-col justify-between overflow-hidden border-b border-tertiary-container/30 bg-primary-container p-8 text-surface sm:p-12 lg:min-h-screen lg:w-[45%] lg:border-r lg:border-b-0 lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.16]"
        >
          <svg
            className="absolute -top-32 -left-32 h-[680px] w-[680px] text-surface-bright"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            viewBox="0 0 700 700"
          >
            <circle cx="350" cy="350" r="320" strokeDasharray="3 7" />
            <ellipse cx="350" cy="350" rx="340" ry="180" transform="rotate(-28 350 350)" />
            <circle cx="350" cy="350" r="210" />
          </svg>
          <svg
            className="absolute -right-36 -bottom-48 h-[720px] w-[720px] text-secondary-container"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            viewBox="0 0 720 720"
          >
            <ellipse cx="360" cy="360" rx="340" ry="220" transform="rotate(35 360 360)" />
            <circle cx="360" cy="360" r="270" strokeDasharray="2 6" />
            <path d="M 60,360 Q 360,120 660,360" />
          </svg>
        </div>

        <div className="relative z-10">
          <span className="font-headline-sm text-headline-sm tracking-tight text-surface-bright">
            Make My Marriage
          </span>
        </div>

        <div className="relative z-10 my-12 max-w-lg lg:my-auto">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-surface-container-lowest/10 px-3 py-1.5 backdrop-blur-md">
            <div className="flex items-center -space-x-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-bright font-label-sm text-label-sm font-bold text-primary-container">
                P
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary font-label-sm text-label-sm font-bold text-surface">
                F1
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-container font-label-sm text-label-sm font-bold text-primary-fixed">
                F2
              </span>
            </div>
            <span className="font-label-sm text-label-sm font-semibold tracking-wider text-primary-fixed uppercase">
              Unified Stakeholder Sync
            </span>
          </div>
          <h1 className="mb-5 font-headline-lg text-headline-lg leading-tight font-normal text-surface-bright">
            Plan your wedding. Together.
          </h1>
          <p className="max-w-md font-body-md text-body-md leading-relaxed text-on-primary-container">
            One shared space for your families, coordinators, and schedules — completely private and
            secure.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-surface-bright/10 pt-8 text-surface-bright/90">
            <div>
              <div className="mb-1 font-label-sm text-label-sm tracking-wider text-secondary-container uppercase">
                Architecture
              </div>
              <div className="font-body-sm text-body-sm text-surface-bright">
                Multi-family budget &amp; run-sheets
              </div>
            </div>
            <div>
              <div className="mb-1 font-label-sm text-label-sm tracking-wider text-secondary-container uppercase">
                Governance
              </div>
              <div className="font-body-sm text-body-sm text-surface-bright">
                Granular privacy &amp; role permissions
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between font-label-sm text-label-sm tracking-wider text-primary-fixed-dim/75 uppercase">
          <span>EST. 2025</span>
          <span className="h-1 w-1 rounded-full bg-surface-bright/40" />
          <span>PRODUCTION OS</span>
        </div>
      </div>

      {/* Right: registration (55% on desktop) */}
      <div className="flex w-full flex-col justify-between bg-surface px-6 py-10 sm:px-12 lg:w-[55%] lg:px-20 lg:py-14">
        <div className="mx-auto flex w-full max-w-[440px] justify-end">
          <a
            href="#help"
            className="group flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
          >
            <span>Need help?</span>
            <Icon
              name="arrow_outward"
              className="text-[16px] transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </div>

        <SignupForm invite={invite} />

        <div className="mx-auto w-full max-w-[440px] pt-4 text-center">
          <div className="inline-flex items-center justify-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant/75">
            <Icon name="lock" className="text-[14px]" />
            <span>256-bit encrypted • Indian DPDP Act compliant workspace</span>
          </div>
        </div>
      </div>
    </main>
  );
}
