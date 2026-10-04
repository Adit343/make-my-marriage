import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ForgotPasswordFlow } from "./forgot-password-flow";

export const metadata: Metadata = { title: "Reset your password — Make My Marriage" };

// Stitch screen: "Make My Marriage — Forgot Password (Field Validation & Toastify)".
export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 overflow-hidden bg-[#FAF6F0] text-on-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed lg:grid-cols-12">
      {/* Left: brand panel (desktop only) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary-container p-12 text-[#FAF6F0] select-none lg:col-span-5 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full border border-[#FAF6F0]/10" />
          <div className="absolute -top-16 -left-16 h-[420px] w-[420px] rounded-full border border-secondary/20" />
          <div className="absolute top-1/4 -right-48 h-[640px] w-[640px] rounded-full border border-[#FAF6F0]/[0.08]" />
          <div className="absolute -bottom-24 left-1/4 h-[480px] w-[480px] rounded-full border border-secondary/15" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-tertiary-container/30 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="group inline-flex items-center gap-3 focus:outline-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FAF6F0]/20 bg-surface/10 text-[#FAF6F0] transition-colors group-hover:bg-surface/20">
              <Icon name="account_balance" className="text-[18px]" />
            </div>
            <span className="font-headline-sm text-headline-sm font-medium tracking-tight text-[#FAF6F0]">
              Make My Marriage
            </span>
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-md py-12">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#FAF6F0]/15 bg-[#FAF6F0]/10 px-3 py-1 text-[#FAF6F0]">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm tracking-widest text-[#FAF6F0]/90">
              ACCOUNT RECOVERY GATEWAY
            </span>
          </div>
          <h1 className="mb-6 font-headline-lg text-headline-lg leading-tight text-[#FAF6F0]">
            Plan your wedding.{" "}
            <span className="font-light text-[#FAF6F0]/95 italic">Together.</span>
          </h1>
          <p className="font-body-md text-body-md leading-relaxed text-[#FAF6F0]/75">
            One shared space for your families, coordinators, and schedules — completely private,
            encrypted, and synchronized in real time.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#FAF6F0]/10 pt-8">
            {[
              ["Dual-Family", "Permission tiers"],
              ["Budget Split", "Real-time ledger"],
              ["256-bit", "Vault encryption"],
            ].map(([title, caption]) => (
              <div key={title}>
                <div className="mb-0.5 font-title text-title text-[#FAF6F0]">{title}</div>
                <div className="font-label-sm text-label-sm text-[#FAF6F0]/60">{caption}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between font-label-sm text-label-sm text-[#FAF6F0]/50">
          <span>EST. 2025</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-[#FAF6F0]/40" />
            PRODUCTION OS • SECURE INFRASTRUCTURE
          </span>
        </div>
      </section>

      {/* Right: recovery panel */}
      <section className="relative col-span-1 flex min-h-screen flex-col justify-between bg-[#FAF6F0] p-6 sm:p-12 lg:col-span-7 lg:p-16">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <div className="flex items-center gap-2 lg:hidden">
            <Icon name="account_balance" className="text-[20px] text-primary" />
            <span className="font-headline-sm text-headline-sm font-medium tracking-tight text-primary">
              Make My Marriage
            </span>
          </div>
          <div className="ml-auto">
            <Link
              href="/login"
              className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant transition-all duration-150 hover:bg-surface-container hover:text-primary active:scale-95"
            >
              <Icon
                name="arrow_back"
                className="text-[16px] transition-transform duration-150 group-hover:-translate-x-0.5"
              />
              <span>Back to login</span>
            </Link>
          </div>
        </div>

        <ForgotPasswordFlow />

        <footer className="mx-auto w-full max-w-xl pt-6 text-center">
          <div className="inline-flex items-center justify-center gap-2 font-body-sm text-[12px] text-on-surface-variant/60">
            <Icon name="lock" className="text-[15px] text-on-surface-variant/50" />
            <span>256-bit encrypted • Indian IT Act (2000) &amp; DPDP Act compliant workspace</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
