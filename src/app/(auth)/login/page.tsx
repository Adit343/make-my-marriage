import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/auth/server-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log In — Make My Marriage" };

// Stitch screen: "Make My Marriage — Wedding Workspace Login (Interactive)".
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getServerSession()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen w-full flex-col bg-surface text-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed md:flex-row">
      {/* Left: brand canvas (~45% on desktop) */}
      <section className="relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden bg-primary-container p-8 select-none md:min-h-screen md:w-[45%] md:p-14 lg:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="absolute -top-[15%] -left-[20%] h-[130%] w-[130%] opacity-[0.09]"
            fill="none"
            viewBox="0 0 800 800"
          >
            <ellipse
              cx="400"
              cy="380"
              rx="360"
              ry="340"
              stroke="#FAF6F0"
              strokeDasharray="4 6"
              strokeWidth="1.2"
            />
            <path
              d="M120 400C120 220 260 90 440 90C620 90 730 240 700 440C670 640 500 710 320 680"
              stroke="#B5714A"
              strokeWidth="1.5"
            />
            <circle cx="410" cy="410" r="260" stroke="#FAF6F0" strokeWidth="1" />
            <circle cx="430" cy="430" opacity="0.6" r="180" stroke="#B5714A" strokeWidth="1.2" />
          </svg>
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-secondary-fixed/5 blur-3xl" />
        </div>

        <header className="relative z-10">
          <span className="font-headline-sm text-headline-sm font-medium tracking-tight text-surface-bright">
            Make My Marriage
          </span>
        </header>

        <div className="relative z-10 my-auto max-w-md py-12 md:py-0">
          <div className="mb-6 h-[2px] w-8 bg-secondary-container opacity-75" />
          <h1 className="mb-4 font-headline-lg text-headline-lg leading-tight font-normal tracking-normal text-surface-bright">
            Plan your wedding.{" "}
            <span className="font-normal text-secondary-fixed italic">Together.</span>
          </h1>
          <p className="font-body-md text-body-md leading-relaxed font-normal text-primary-fixed-dim/90">
            One shared space for your families, coordinators, and schedules — completely private and
            secure.
          </p>
          <div className="mt-8 flex items-center gap-3 border-t border-surface-bright/10 pt-6">
            <div className="flex -space-x-2 overflow-hidden py-0.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-bright/20 text-[11px] font-medium text-surface-bright ring-2 ring-primary-container">
                P
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container/40 text-[11px] font-medium text-surface-bright ring-2 ring-primary-container">
                F1
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-bright/30 text-[11px] font-medium text-surface-bright ring-2 ring-primary-container">
                F2
              </span>
            </div>
            <span className="font-label-md text-label-md tracking-wider text-primary-fixed-dim/75 uppercase">
              Multi-Stakeholder Sync
            </span>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-between pt-4 font-label-sm text-label-sm text-surface-bright/40">
          <span>EST. 2025</span>
          <span>PRODUCTION OS</span>
        </footer>
      </section>

      {/* Right: authentication workspace (~55% on desktop) */}
      <section className="flex w-full items-center justify-center overflow-y-auto bg-surface px-6 py-12 md:w-[55%] md:px-12 lg:px-16">
        <LoginForm oauthError={typeof error === "string" ? error : undefined} />
      </section>
    </main>
  );
}
