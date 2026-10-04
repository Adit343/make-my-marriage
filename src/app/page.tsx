import Link from "next/link";
import { GuestManagerShowcase } from "@/components/landing/guest-manager-showcase";
import { WalkthroughDialog } from "@/components/landing/walkthrough-dialog";
import { Icon, type IconName } from "@/components/ui/icon";

// Stitch screen: "Make My Marriage — Collaborative Wedding Planning SaaS Landing Page (Interactive)".
// All names, numbers and quotes below are sample content from the design.

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#collaboration", label: "Collaboration", active: true },
  { href: "#privacy", label: "Privacy" },
  { href: "#pricing", label: "Pricing" },
];

const HERO_METRICS = [
  {
    label: "GUESTS CONFIRMED",
    value: "482",
    suffix: "/ 550",
    note: "87% RSVP",
    noteClass: "text-primary",
    bar: "bg-primary",
    percent: 87,
  },
  {
    label: "BUDGET ALLOCATED",
    value: "₹45,00,000",
    note: "68% spent",
    noteClass: "text-secondary",
    bar: "bg-secondary",
    percent: 68,
  },
  {
    label: "PENDING TASKS",
    value: "18",
    suffix: "of 64",
    note: "72% done",
    noteClass: "text-primary",
    bar: "bg-primary-container",
    percent: 72,
  },
];

const ACTIVITY = [
  {
    initial: "M",
    avatar: "bg-secondary-fixed text-on-secondary-fixed",
    who: "Meera (Bride)",
    what: "updated the Sangeet playlist & stage floorplan",
    when: "4 mins ago",
  },
  {
    initial: "R",
    avatar: "bg-primary-fixed text-on-primary-fixed",
    who: "Rohan (Brother)",
    what: "confirmed Airport Transfers for 42 guests arriving at UDR",
    when: "28 mins ago",
  },
  {
    initial: "S",
    avatar: "bg-surface-container-high text-on-surface",
    who: "Sanjay Kapoor (Planner)",
    what: "recorded advance payment of ₹3,50,000 for Decor",
    when: "1 hr ago",
  },
];

const STEPS: { number: string; icon: IconName; title: string; body: string }[] = [
  {
    number: "01",
    icon: "calendar_month",
    title: "Create your wedding",
    body: "Set your multi-day dates, venues (Sangeet, Mehendi, Pheras, Reception), and total estimated budget framework in under 3 minutes.",
  },
  {
    number: "02",
    icon: "group_add",
    title: "Invite your family and planner",
    body: "Add your partner, parents, siblings, and wedding coordinators with granular module-level permissions tailored to Indian family dynamics.",
  },
  {
    number: "03",
    icon: "task_alt",
    title: "Plan everything together",
    body: "Assign tasks, track multi-ceremony RSVP confirmations, and reconcile expenses in real-time without duplicate vendor calls or confusion.",
  },
];

const MEMBERS = [
  {
    initials: "AM",
    avatar: "bg-primary text-on-primary",
    name: "Aarav Mehta & Meera Sen",
    detail: "aarav.meera@outlook.com",
    role: "Couple / Owner",
    roleClass: "bg-primary-fixed text-on-primary-fixed",
    modules: "All Modules (Full Admin)",
    budget: "Unrestricted",
    budgetStrong: true,
  },
  {
    initials: "RS",
    avatar: "bg-secondary-fixed text-on-secondary-fixed",
    name: "Rajesh Sen",
    detail: "Father of the Bride",
    role: "Family Admin",
    roleClass: "bg-surface-container text-on-surface",
    modules: "Catering, Venue, Guest List",
    budget: "Approve > ₹50,000",
    budgetStrong: true,
  },
  {
    initials: "VE",
    avatar: "bg-surface-container-highest text-on-surface",
    name: "Veda Luxury Events (Sanjay K.)",
    detail: "Lead Wedding Production Team",
    role: "Lead Planner",
    roleClass: "bg-secondary-container/30 text-on-secondary-container",
    modules: "Vendors, Logistics, Schedule",
    budget: "Vendor Contracts Only",
    budgetStrong: false,
  },
  {
    initials: "RM",
    avatar: "bg-tertiary-fixed text-on-tertiary-fixed",
    name: "Rhea Mehta",
    detail: "Sister of the Groom",
    role: "Member",
    roleClass: "bg-surface-container text-on-surface",
    modules: "Sangeet Choreography, Favors",
    budget: "Hidden",
    budgetStrong: false,
  },
];

const TASKS = [
  {
    tag: "High Priority",
    tagClass: "bg-secondary-fixed text-on-secondary-fixed",
    due: "Due Tomorrow",
    title: "Finalize Sangeet Choreographer",
    initials: "RM",
    avatar: "bg-tertiary-fixed text-on-tertiary-fixed",
    owner: "Rhea Mehta",
    status: "Pending Review",
    statusClass: "text-secondary font-medium",
  },
  {
    tag: "Venue & Stay",
    tagClass: "bg-primary-fixed text-on-primary-fixed",
    due: "In 4 Days",
    title: "Approve Udaipur Hotel Rooming List",
    initials: "RS",
    avatar: "bg-secondary-fixed text-on-secondary-fixed",
    owner: "Rajesh Sen",
    status: "62/80 Confirmed",
    statusClass: "text-primary font-medium",
  },
  {
    tag: "Gifting",
    tagClass: "bg-surface-container text-on-surface font-medium",
    due: "Nov 20",
    title: "Select Mithai Box Packaging",
    initials: "AM",
    avatar: "bg-primary text-on-primary",
    owner: "Aarav & Meera",
    status: "Vendor Samples Sent",
    statusClass: "text-on-surface-variant",
  },
];

const PRIVACY: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield",
    title: "Private by Default",
    body: "No public search indexing, zero data brokering, and complete isolation of wedding spaces. Only people you explicitly invite can view details.",
  },
  {
    icon: "key",
    title: "Tokenized Guest Access",
    body: "Guests access wedding itineraries and upload memories via secure cryptographic tokens — eliminating cumbersome sign-ups for elderly relatives.",
  },
  {
    icon: "lock_person",
    title: "Bank-Grade Infrastructure",
    body: "Full AES-256 encryption at rest and TLS 1.3 in transit. Strictly compliant with the Indian Information Technology Act and DPDP 2023 norms.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "“Our wedding had 650 guests across 4 days in Jaipur. Make My Marriage allowed my father and our wedding planner to stay on the exact same page without endless midnight WhatsApp calls.”",
    name: "Ananya & Kabir Roy",
    detail: "Couples Workspace • Delhi & Jaipur",
  },
  {
    quote:
      "“Being able to give my brothers module-specific tasks while keeping overall family budgeting completely confidential was what made this indispensable for us.”",
    name: "Vikramaditya & Sunita Sen",
    detail: "Parents of the Bride • Kolkata",
  },
  {
    quote:
      "“We manage destination luxury weddings. This platform replaced four disjointed spreadsheets and gave our clients complete transparency into logistical milestones.”",
    name: "Priya Mehra",
    detail: "Founder, The Regal Knot Productions • Mumbai",
  },
];

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#how-it-works", label: "How It Works" },
      { href: "#collaboration", label: "Collaboration" },
      { href: "#pricing", label: "Pricing" },
    ],
  },
  {
    heading: "For Stakeholders",
    links: [
      { href: "#", label: "For Couples" },
      { href: "#", label: "For Extended Families" },
      { href: "#", label: "For Wedding Planners" },
      { href: "#", label: "Contact Support" },
    ],
  },
  {
    heading: "Governance",
    links: [
      { href: "#privacy", label: "Privacy Policy" },
      { href: "#", label: "Terms of Service" },
      { href: "#", label: "Security & Compliance" },
      { href: "#", label: "DPDP 2023 Compliance" },
    ],
  },
];

function SectionEyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`mb-2 block font-label-md text-label-md tracking-wider text-secondary uppercase ${className}`}
    >
      {children}
    </span>
  );
}

function BrowserDots({ size = "h-3 w-3" }: { size?: string }) {
  return (
    <div className="flex items-center space-x-2">
      <span className={`${size} rounded-full bg-on-surface/20`} />
      <span className={`${size} rounded-full bg-on-surface/20`} />
      <span className={`${size} rounded-full bg-on-surface/20`} />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative overflow-x-hidden text-body-md selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Ambient low-opacity glows */}
      <div className="pointer-events-none fixed top-0 left-1/4 -z-10 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-primary-fixed/20 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-secondary-container/15 blur-3xl" />
      <div className="pointer-events-none fixed bottom-1/4 left-10 -z-10 h-[550px] w-[550px] rounded-full bg-primary-fixed-dim/15 blur-3xl" />

      <header className="sticky top-0 z-50 bg-surface/90 shadow-xs backdrop-blur-md transition-all duration-200">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 md:px-12">
          <Link
            href="/"
            className="font-headline-sm text-headline-sm font-medium tracking-tight text-primary transition-opacity hover:opacity-90"
          >
            Make My Marriage
          </Link>
          <nav className="hidden items-center space-x-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={
                  link.active
                    ? "font-label-md text-label-md font-semibold text-primary"
                    : "font-label-md text-label-md text-on-surface-variant transition-colors duration-150 hover:text-primary"
                }
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center space-x-5">
            <Link
              href="/login"
              className="font-label-md text-label-md text-on-surface-variant transition-colors duration-150 hover:text-primary"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-primary-container px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-xs transition-all duration-200 hover:bg-primary active:scale-[0.99]"
            >
              Start planning free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-20 text-center md:px-12 md:pt-24 md:pb-28">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-on-surface/5 bg-surface-container px-3.5 py-1.5 font-label-md text-label-md text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            <span>V1 Collaborative Platform • Built for Indian Weddings</span>
          </div>
          <h1 className="mx-auto mb-6 max-w-4xl font-display text-display tracking-tight text-on-surface">
            Plan your wedding. <span className="font-display text-primary italic">Together.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
            Everything your wedding needs — guests, budget, tasks, and memories — in one place,
            shared with everyone who&apos;s helping plan it.
          </p>
          <div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-lg bg-primary-container px-8 py-3.5 text-center font-title text-title text-on-primary shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary sm:w-auto"
            >
              Start planning free
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-lg border border-on-surface/15 bg-surface-container-lowest px-8 py-3.5 text-center font-title text-title text-on-surface transition-all duration-200 hover:bg-surface-container sm:w-auto"
            >
              See how it works
            </a>
          </div>
          <p className="mb-16 flex items-center justify-center gap-2 font-body-sm text-body-sm text-on-surface-variant/75">
            <Icon name="verified_user" className="text-[16px] text-primary" />
            No credit card required • Instant setup for couples &amp; planners
          </p>

          {/* Product preview */}
          <div className="custom-elevation-elevated relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-on-surface/10 bg-surface-container-lowest text-left">
            <div className="flex items-center justify-between border-b border-on-surface/10 bg-surface-container-low px-4 py-3">
              <BrowserDots />
              <div className="flex w-72 items-center justify-center space-x-1.5 rounded-md border border-on-surface/10 bg-surface-container-lowest/80 px-4 py-1 font-label-sm text-label-sm text-on-surface-variant">
                <Icon name="lock" className="text-[14px]" />
                <span>app.makemymarriage.in/overview</span>
              </div>
              <div className="flex items-center space-x-2 text-on-surface-variant">
                <Icon name="share" className="text-[18px]" />
              </div>
            </div>

            <div className="bg-surface-bright p-6 md:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-on-surface/10 pb-6 md:flex-row md:items-center">
                <div>
                  <div className="mb-1 flex items-center space-x-3">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">
                      Aarav &amp; Meera’s Wedding
                    </h2>
                    <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 font-label-sm text-label-sm text-on-secondary-fixed">
                      142 Days to Go
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    December 14, 2025 • The Leela Palace, Udaipur
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex -space-x-2">
                    {[
                      ["AM", "bg-primary text-on-primary"],
                      ["MK", "bg-secondary text-on-secondary"],
                      ["SK", "bg-tertiary-container text-on-tertiary-container"],
                      ["+3", "bg-surface-container-high text-on-surface"],
                    ].map(([initials, colors]) => (
                      <span
                        key={initials}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-container-lowest text-label-sm font-medium ${colors}`}
                      >
                        {initials}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="flex items-center space-x-1 rounded-md bg-primary-container px-3.5 py-1.5 font-label-md text-label-md text-on-primary"
                  >
                    <Icon name="person_add" className="text-[16px]" />
                    <span>Invite Family</span>
                  </button>
                </div>
              </div>

              <div className="my-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {HERO_METRICS.map((metric) => (
                  <div
                    key={metric.label}
                    className="custom-subtle-shadow rounded-lg border border-on-surface/5 bg-surface-container-lowest p-4"
                  >
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {metric.label}
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-title text-title text-on-surface">
                        {metric.value}{" "}
                        {metric.suffix ? (
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {metric.suffix}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`font-label-sm text-label-sm font-semibold ${metric.noteClass}`}
                      >
                        {metric.note}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className={`h-full rounded-full ${metric.bar}`}
                        style={{ width: `${metric.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="custom-subtle-shadow rounded-lg border border-on-surface/5 bg-surface-container-lowest p-4">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    COLLABORATORS
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-title text-title text-on-surface">6 Active</span>
                    <span className="font-label-sm text-label-sm font-semibold text-primary">
                      All Online
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-1 text-label-sm text-on-surface-variant">
                    <span>Parents, Planners, Couple</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-on-surface/5 bg-surface-container-lowest p-4">
                <div className="mb-3 flex items-center justify-between border-b border-on-surface/10 pb-3">
                  <span className="font-label-md text-label-md tracking-wider text-on-surface uppercase">
                    Live Wedding Activity
                  </span>
                  <span className="flex items-center gap-1 font-label-sm text-label-sm text-primary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Syncing
                    Realtime
                  </span>
                </div>
                <div className="space-y-3 font-body-sm text-body-sm">
                  {ACTIVITY.map((item) => (
                    <div key={item.who} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${item.avatar}`}
                        >
                          {item.initial}
                        </span>
                        <span className="text-on-surface">
                          <strong className="font-medium">{item.who}</strong> {item.what}
                        </span>
                      </div>
                      <span className="text-label-sm text-on-surface-variant">{item.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="border-y border-on-surface/5 bg-surface-container-low py-20">
          <div className="mx-auto max-w-4xl px-6 text-center md:px-12">
            <span className="mb-4 block font-label-md text-label-md tracking-wider text-secondary uppercase">
              The Problem We Solve
            </span>
            <blockquote className="mb-8 font-headline-lg text-headline-lg leading-tight text-on-surface">
              “The modern Indian wedding isn’t planned in isolation. Yet today, it runs on chaotic
              WhatsApp group chats, scattered spreadsheets, outdated PDFs, and misplaced vendor
              contracts. Important decisions get lost in the noise.”
            </blockquote>
            <div className="custom-subtle-shadow inline-flex items-center gap-3 rounded-full border border-on-surface/10 bg-surface-container-lowest px-6 py-3">
              <Icon name="check_circle" className="text-[20px] text-primary" />
              <span className="font-title text-title text-primary">
                One shared single source of truth for the entire family.
              </span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-6 py-24 md:px-12" id="how-it-works">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <SectionEyebrow>Architectural Workflow</SectionEyebrow>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Designed for clarity across three steps
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="custom-subtle-shadow relative rounded-xl border border-on-surface/10 bg-surface-container-lowest p-8 transition-transform duration-200 hover:-translate-y-1"
              >
                <span className="mb-6 block font-display text-4xl text-secondary">
                  {step.number}
                </span>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                  <Icon name={step.icon} className="text-[24px]" />
                </div>
                <h3 className="mb-3 font-title text-title text-on-surface">{step.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Collaboration */}
        <section
          className="border-y border-on-surface/5 bg-surface-container-low py-24"
          id="collaboration"
        >
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mb-12 max-w-3xl">
              <SectionEyebrow>Collaborative Engine</SectionEyebrow>
              <h2 className="mb-4 font-headline-lg text-headline-lg text-on-surface">
                One wedding. One shared plan. Everyone in sync.
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Indian weddings are never a two-person project. They bridge families, continents,
                and seasoned professionals. Give everyone an exact role without exposing
                confidential budgets or private vendor agreements.
              </p>
            </div>

            <div className="custom-elevation-elevated overflow-hidden rounded-xl border border-on-surface/10 bg-surface-container-lowest">
              <div className="flex items-center justify-between border-b border-on-surface/10 bg-surface-container px-6 py-3.5">
                <div className="flex items-center space-x-2">
                  <BrowserDots size="h-2.5 w-2.5" />
                  <span className="ml-3 font-label-md text-label-md text-on-surface-variant">
                    Members &amp; Permissions • Aarav &amp; Meera
                  </span>
                </div>
                <span className="rounded-md bg-primary-fixed px-2.5 py-0.5 font-label-sm text-label-sm font-semibold text-on-primary-fixed">
                  Active Workspace
                </span>
              </div>
              <div className="p-6 md:p-8">
                <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex items-center space-x-2">
                    <span className="font-title text-title text-on-surface">
                      Collaborator Directory
                    </span>
                    <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                      6 Members
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      className="rounded-md bg-surface-container px-3 py-1.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-variant"
                    >
                      Export Access Log
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-md bg-primary-container px-4 py-1.5 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary"
                    >
                      <Icon name="add" className="text-[16px]" />
                      <span>Invite Collaborator</span>
                    </button>
                  </div>
                </div>

                <div className="mb-8 overflow-x-auto rounded-lg border border-on-surface/10">
                  <table className="w-full text-left font-body-sm text-body-sm">
                    <thead className="bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                      <tr>
                        <th className="px-4 py-3">Member Name</th>
                        <th className="px-4 py-3">Role / Relation</th>
                        <th className="px-4 py-3">Accessible Modules</th>
                        <th className="px-4 py-3">Budget Access</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-on-surface/10 bg-surface-container-lowest">
                      {MEMBERS.map((member) => (
                        <tr key={member.name}>
                          <td className="flex items-center space-x-3 px-4 py-3.5">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-label-sm font-semibold ${member.avatar}`}
                            >
                              {member.initials}
                            </div>
                            <div>
                              <div className="font-medium text-on-surface">{member.name}</div>
                              <div className="text-label-sm text-on-surface-variant">
                                {member.detail}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded px-2.5 py-1 font-label-sm text-label-sm ${member.roleClass}`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-on-surface">{member.modules}</td>
                          <td
                            className={`px-4 py-3.5 ${member.budgetStrong ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
                          >
                            {member.budget}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1 font-medium text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-on-surface/5 bg-surface-bright p-5">
                  <span className="mb-4 block font-label-md text-label-md tracking-wider text-on-surface uppercase">
                    Assigned Operational Tasks
                  </span>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {TASKS.map((task) => (
                      <div
                        key={task.title}
                        className="custom-subtle-shadow rounded-md border border-on-surface/10 bg-surface-container-lowest p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`rounded px-2 py-0.5 font-label-sm text-label-sm ${task.tagClass}`}
                          >
                            {task.tag}
                          </span>
                          <span className="text-label-sm text-on-surface-variant">{task.due}</span>
                        </div>
                        <h4 className="mb-2 font-title text-title text-on-surface">{task.title}</h4>
                        <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${task.avatar}`}
                            >
                              {task.initials}
                            </span>
                            <span>{task.owner}</span>
                          </span>
                          <span className={`text-label-sm ${task.statusClass}`}>{task.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Guest list & RSVP */}
        <section className="mx-auto max-w-7xl px-6 py-24 md:px-12">
          <div className="mb-12 max-w-3xl">
            <SectionEyebrow>Guest Logistics</SectionEyebrow>
            <h2 className="mb-4 font-headline-lg text-headline-lg text-on-surface">
              Guest lists and digital RSVPs without the spreadsheet nightmare.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Indian celebrations encompass distinct guest sub-communities. Organize 500+ guests
              with smart grouping, granular ceremony invitations, and zero-password guest link
              access via WhatsApp.
            </p>
          </div>
          <GuestManagerShowcase />
        </section>

        {/* Supporting features */}
        <section
          className="border-y border-on-surface/5 bg-surface-container-low py-24"
          id="features"
        >
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <SectionEyebrow>Comprehensive Toolset</SectionEyebrow>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Precision instruments for every facet
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <FeatureCard
                icon="account_balance_wallet"
                title="Budget & Vendor Tracking"
                body="Split costs across categories, monitor advance deposits, and manage vendor contact books with clear contractual deadlines."
                footnote="Automatic payment reminders via WhatsApp"
              >
                <div className="space-y-2 rounded-lg border border-on-surface/5 bg-surface-bright p-4 text-label-sm">
                  {[
                    ["Venue & Palace Decor", "₹22,00,000", "(Adv. Paid)", "text-primary"],
                    ["Catering & Royal Dining", "₹12,50,000", "(Due Dec 01)", "text-secondary"],
                    ["Cinematography & Drone", "₹4,50,000", "(Verified)", "text-primary"],
                  ].map(([item, amount, status, tone], index, rows) => (
                    <div
                      key={item}
                      className={`flex items-center justify-between ${index < rows.length - 1 ? "border-b border-on-surface/10 pb-2" : ""}`}
                    >
                      <span className="font-medium text-on-surface">{item}</span>
                      <span className="text-on-surface">
                        {amount} <span className={`font-semibold ${tone}`}>{status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </FeatureCard>

              <FeatureCard
                icon="web"
                title="Wedding Website Builder"
                body="Publish a bespoke, ad-free guest hub complete with ceremony schedules, dress codes, Google Maps navigation, and travel guidelines."
                footnote="100% ad-free & zero public search indexing"
              >
                <div className="space-y-2 rounded-lg border border-on-surface/5 bg-surface-bright p-4 text-center text-label-sm">
                  <span className="block font-headline-sm text-headline-sm text-primary">
                    Aarav &amp; Meera
                  </span>
                  <span className="block text-label-sm tracking-widest text-secondary uppercase">
                    Udaipur, Rajasthan
                  </span>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-on-surface/10 pt-3 text-left">
                    <div className="rounded bg-surface-container-lowest p-2">
                      <strong className="block text-on-surface">Pheras &amp; Dinner</strong>
                      <span className="text-[11px] text-on-surface-variant">Dec 14 • 6:30 PM</span>
                    </div>
                    <div className="rounded bg-surface-container-lowest p-2">
                      <strong className="block text-on-surface">Dress Code</strong>
                      <span className="text-[11px] text-on-surface-variant">Traditional Royal</span>
                    </div>
                  </div>
                </div>
              </FeatureCard>

              <FeatureCard
                icon="photo_library"
                title="Private Photo & Memory Vault"
                body="Collect every candid photo directly from guests through quick QR codes at banquet tables without forcing them to install an app."
                footnote="Direct original quality storage via CloudFront"
              >
                <div className="rounded-lg border border-on-surface/5 bg-surface-bright p-4">
                  <div className="mb-3 flex items-center justify-between text-label-sm">
                    <span className="font-medium text-on-surface">Guest Gallery Stream</span>
                    <span className="font-semibold text-primary">1,248 Photos</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["photo", "photo_camera", "favorite"] as const).map((icon) => (
                      <div
                        key={icon}
                        className="flex h-16 items-center justify-center rounded bg-surface-container-highest text-on-surface-variant"
                      >
                        <Icon name={icon} className="text-[20px]" />
                      </div>
                    ))}
                  </div>
                </div>
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* Trust & security */}
        <section className="mx-auto max-w-7xl px-6 py-24 md:px-12" id="privacy">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <SectionEyebrow>Discretion Guaranteed</SectionEyebrow>
            <h2 className="mb-3 font-headline-lg text-headline-lg text-on-surface">
              Your family’s celebrations. Completely private.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Weddings involve sensitive personal data: home addresses, travel manifests, flight
              bookings, and vendor budgets. We treat your wedding data like private enterprise
              information.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PRIVACY.map((item) => (
              <div
                key={item.title}
                className="custom-subtle-shadow rounded-xl border border-on-surface/10 bg-surface-container-lowest p-8"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-primary">
                  <Icon name={item.icon} className="text-[24px]" />
                </div>
                <h3 className="mb-2 font-title text-title text-on-surface">{item.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-y border-on-surface/5 bg-surface-container-low py-24">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <SectionEyebrow>Proven Coordination</SectionEyebrow>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Designed for the scale and warmth of Indian celebrations
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {TESTIMONIALS.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="custom-subtle-shadow flex flex-col justify-between rounded-xl border border-on-surface/10 bg-surface-container-lowest p-8"
                >
                  <p className="mb-6 font-headline-sm text-headline-sm leading-relaxed text-on-surface italic">
                    {testimonial.quote}
                  </p>
                  <div>
                    <strong className="block font-title text-title text-on-surface">
                      {testimonial.name}
                    </strong>
                    <span className="text-body-sm text-on-surface-variant">
                      {testimonial.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final conversion band */}
        <section className="bg-primary-container py-24 text-on-primary">
          <div className="mx-auto max-w-4xl px-6 text-center md:px-12">
            <h2 className="mb-6 font-display text-display text-surface-bright">
              Ready to replace the wedding planning chaos?
            </h2>
            <p className="mx-auto mb-10 max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-primary-container">
              Join hundreds of couples, families, and wedding producers coordinating seamless
              multi-ceremony celebrations across India.
            </p>
            <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-lg bg-surface-bright px-8 py-4 text-center font-title text-title text-primary shadow-md transition-all duration-200 hover:bg-surface sm:w-auto"
              >
                Start planning free
              </Link>
              <WalkthroughDialog />
            </div>
            <p className="font-body-sm text-body-sm text-on-primary-container">
              Free to start • No credit card required • Invite up to 10 family members
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-on-surface/5 bg-surface-container-low">
        <div className="mx-auto w-full max-w-7xl px-6 py-16 md:px-12">
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-5">
            <div className="space-y-4 md:col-span-2">
              <Link
                href="/"
                className="block font-headline-sm text-headline-sm font-medium tracking-tight text-primary"
              >
                Make My Marriage
              </Link>
              <p className="max-w-sm font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                The architectural collaboration platform for modern Indian weddings. Built for
                discerning couples, families, and coordinators.
              </p>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <span className="mb-4 block font-label-sm text-label-sm font-semibold tracking-wider text-secondary uppercase">
                  {column.heading}
                </span>
                <ul className="space-y-2.5 font-body-sm text-body-sm">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-on-surface-variant transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-on-surface/10 pt-8 font-body-sm text-body-sm text-on-surface-variant md:flex-row">
            <p>
              © 2025 Make My Marriage Technologies Pvt Ltd. All rights reserved. Indian IT Act
              (2000) &amp; DPDP Compliant.
            </p>
            <div className="flex items-center space-x-6">
              <span className="font-label-sm text-label-sm text-secondary">
                Hosted securely in Mumbai (ap-south-1)
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  footnote,
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  footnote: string;
  children: React.ReactNode;
}) {
  return (
    <div className="custom-subtle-shadow flex flex-col justify-between rounded-xl border border-on-surface/10 bg-surface-container-lowest p-6">
      <div>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-surface-container text-primary">
          <Icon name={icon} className="text-[20px]" />
        </div>
        <h3 className="mb-2 font-title text-title text-on-surface">{title}</h3>
        <p className="mb-6 font-body-md text-body-md text-on-surface-variant">{body}</p>
        {children}
      </div>
      <div className="mt-6 flex items-center gap-1 border-t border-on-surface/10 pt-4 text-label-sm font-medium text-primary">
        <span>{footnote}</span>
      </div>
    </div>
  );
}
