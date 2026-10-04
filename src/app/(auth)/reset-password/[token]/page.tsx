import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password — Make My Marriage",
  // Pages reached through a secret link must not leak it to other sites.
  referrer: "no-referrer",
};

// Stitch screen: "Make My Marriage — Set New Password (Active with Toast Validation)".
export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-md text-on-surface selection:bg-secondary/20 selection:text-primary lg:flex-row">
      {/* Left: brand canvas (~45% on desktop) */}
      <div className="relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden bg-[#1F4D3D] p-8 text-[#FAF6F0] sm:p-12 lg:min-h-screen lg:w-[45%] lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex -translate-x-12 translate-y-8 items-center justify-center opacity-20"
        >
          <svg className="h-[850px] w-[850px] text-[#FAF6F0]" fill="none" viewBox="0 0 800 800">
            <circle
              cx="400"
              cy="400"
              opacity="0.4"
              r="160"
              stroke="currentColor"
              strokeDasharray="3 6"
              strokeWidth="1"
            />
            <circle cx="400" cy="400" opacity="0.6" r="240" stroke="currentColor" strokeWidth="1" />
            <circle
              cx="400"
              cy="400"
              opacity="0.45"
              r="320"
              stroke="currentColor"
              strokeDasharray="8 8"
              strokeWidth="1.2"
            />
            <circle cx="400" cy="400" opacity="0.3" r="390" stroke="currentColor" strokeWidth="1" />
            <path
              d="M120 400C120 245.36 245.36 120 400 120"
              opacity="0.55"
              stroke="#B5714A"
              strokeWidth="1.5"
            />
            <path
              d="M400 680C554.64 680 680 554.64 680 400"
              opacity="0.4"
              stroke="#B5714A"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
          <span className="font-label-md text-label-md tracking-wider text-[#FAF6F0]/70 uppercase">
            Production Protocol
          </span>
        </div>

        <div className="relative z-10 my-auto py-12 lg:py-0">
          <h1 className="mb-4 font-display text-display leading-tight tracking-tight text-[#FAF6F0]">
            Make My Marriage
          </h1>
          <p className="max-w-sm font-headline-sm text-headline-sm font-normal tracking-wide text-[#FAF6F0]/85">
            Plan your wedding. Together.
          </p>
          <div className="mt-8 max-w-xs border-t border-[#FAF6F0]/15 pt-8">
            <p className="font-body-sm text-body-sm leading-relaxed text-[#FAF6F0]/65">
              Multi-stakeholder orchestration infrastructure designed for family offices, couples,
              and master production directors.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between pt-6 font-label-sm text-label-sm tracking-wider text-[#FAF6F0]/60 uppercase">
          <span>EST. 2025</span>
          <span className="text-[#FAF6F0]/30">•</span>
          <span>PRODUCTION OS</span>
          <span className="text-[#FAF6F0]/30">•</span>
          <span>SECURE INFRASTRUCTURE</span>
        </div>
      </div>

      {/* Right: password form (~55% on desktop) */}
      <div className="flex min-h-screen w-full flex-col justify-between bg-[#FAF6F0] p-6 sm:p-10 lg:w-[55%] lg:p-16">
        <div className="flex w-full justify-end">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant transition-colors duration-150 hover:bg-surface-variant/40 hover:text-primary"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span>Back to login</span>
          </Link>
        </div>

        <ResetPasswordForm token={token} />

        <div className="flex w-full items-center justify-between pt-6 font-label-sm text-label-sm text-on-surface-variant/60">
          <span>MAKE MY MARRIAGE TECH</span>
          <span>AUTH GATEWAY V2.4</span>
        </div>
      </div>
    </div>
  );
}
