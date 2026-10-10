import Link from "next/link";
import { ComingSoonButton } from "@/components/dashboard/coming-soon-button";
import { canManageMembers, RELATIONSHIP_LABEL, ROLE_LABEL } from "@/components/dashboard/labels";
import { Icon, type IconName } from "@/components/ui/icon";
import type { MemberRole } from "@/lib/constants/enums";
import type { Dashboard, NextEvent, TeamMember } from "@/modules/dashboard/dashboard.service";

// Sections of the Stitch "Member Wedding Dashboard". Widgets for modules that don't exist yet
// render their designed empty states; nothing on this page is sample data.

type Workspace = NonNullable<Dashboard["workspace"]>;

const CARD = "elevation-1 rounded-xl border border-[#2A2622]/[0.05] bg-surface-container-lowest";
const WIDGET_HEADER = "flex items-center justify-between border-b border-[#2A2622]/[0.06] pb-4";

function WidgetTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h4 className="font-headline-sm text-headline-sm font-medium text-on-surface">{title}</h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A2622]/15 bg-surface-container-low px-6 py-8 text-center">
      <Icon name={icon} className="text-outline" />
      <p className="font-title text-body-sm text-on-surface">{title}</p>
      <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">{message}</p>
    </div>
  );
}

/** "today", "tomorrow", "in 12 days", or "under way" for an event that has already started. */
function whenText(daysUntil: number): string {
  if (daysUntil < 0) return "under way";
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

export function CountdownHero({ workspace }: { workspace: Workspace }) {
  const next = workspace.nextEvent;
  const days = workspace.daysUntilWedding;
  const countdown =
    days === null
      ? { value: "—", label: "Wedding date not set" }
      : days > 0
        ? { value: String(days), label: days === 1 ? "Day until wedding" : "Days until wedding" }
        : days === 0
          ? { value: "Today", label: "It's your wedding day" }
          : { value: "Married", label: "Congratulations" };

  return (
    <section className="elevation-1 relative overflow-hidden rounded-2xl border border-[#2A2622]/[0.05] bg-surface-container-lowest p-6 transition-all duration-200 hover:border-primary/20 md:p-10">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 -mr-16 h-full w-96 text-secondary/[0.06]"
        fill="none"
        viewBox="0 0 400 400"
      >
        <circle
          cx="200"
          cy="200"
          r="160"
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
        <circle cx="200" cy="200" r="230" stroke="currentColor" strokeWidth="1" />
        <path d="M50 200 C 150 100, 250 300, 350 200" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="flex items-baseline gap-4 border-b border-[#2A2622]/[0.06] pb-6 lg:col-span-4 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <div className="text-left">
            <span className="inline-block font-display text-display font-normal tracking-tight text-primary">
              {countdown.value}
            </span>
            <p className="mt-1 font-label-md text-label-md font-semibold tracking-wider text-outline uppercase">
              {countdown.label}
            </p>
          </div>
          {workspace.city ? (
            <div className="hidden font-headline-md text-headline-sm text-outline italic sm:block">
              / {workspace.city}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center lg:col-span-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded bg-[#FAF3EC] px-2.5 py-1 font-label-sm text-[11px] font-semibold tracking-wider text-secondary uppercase">
              <Icon name="schedule" className="text-[14px]" />
              Next Milestone Event
            </div>
            {next ? (
              <>
                <h3 className="font-headline-md text-headline-md text-on-surface">{next.name}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {next.whenLabel}
                  {next.venue ? ` · ${next.venue}` : ""}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  {workspace.counts.events > 0 ? "All events have passed" : "No events planned yet"}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {workspace.counts.events > 0
                    ? "Add another function to see what's coming up next."
                    : "Add Mehendi, Sangeet, the ceremony and more to see what's coming up next."}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={next ? `/dashboard/events/${next.id}` : "/dashboard/events"}
              className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body-sm text-body-sm font-medium text-on-primary shadow-xs transition-all hover:bg-[#163A2E] focus:ring-2 focus:ring-primary/30 focus:outline-hidden active:scale-[0.98]"
            >
              <Icon name="calendar_month" className="text-[17px]" />
              {next ? "View Event" : "Plan Events"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatCards({
  counts,
  nextEvent,
}: {
  counts: Workspace["counts"];
  nextEvent: NextEvent | null;
}) {
  const stats: {
    label: string;
    icon: IconName;
    value: number;
    detail: string;
    accent: "primary" | "secondary";
  }[] = [
    {
      label: "Events",
      icon: "event_note",
      value: counts.events,
      detail: nextEvent
        ? `Next: ${nextEvent.name} ${whenText(nextEvent.daysUntil)}`
        : counts.events > 0
          ? "All events have passed"
          : "No events planned yet",
      accent: "primary",
    },
    {
      label: "Guests",
      icon: "person_outline",
      value: counts.guests,
      detail: "No guests added yet",
      accent: "primary",
    },
    {
      label: "Pending Tasks",
      icon: "assignment_turned_in",
      value: counts.pendingTasks,
      detail: "Nothing assigned yet",
      accent: "secondary",
    },
    {
      label: "Contracted Vendors",
      icon: "handshake",
      value: counts.vendors,
      detail: "No vendors booked yet",
      accent: "primary",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
      {stats.map((stat) => {
        const color = stat.accent === "secondary" ? "text-secondary" : "text-primary";
        return (
          <div
            key={stat.label}
            className={`${CARD} group p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${stat.accent === "secondary" ? "hover:border-secondary/40" : "hover:border-primary/30"}`}
          >
            <div className="mb-2 flex items-center justify-between text-outline">
              <span
                className={`font-label-md text-label-md tracking-wider text-outline uppercase transition-colors ${stat.accent === "secondary" ? "group-hover:text-secondary" : "group-hover:text-primary"}`}
              >
                {stat.label}
              </span>
              <Icon
                name={stat.icon}
                className={`text-[19px] ${color} transition-transform group-hover:scale-110`}
              />
            </div>
            <div className={`font-headline-md text-headline-md font-medium ${color}`}>
              {stat.value}
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{stat.detail}</p>
          </div>
        );
      })}
    </section>
  );
}

export function RsvpWidget() {
  const breakdown = [
    {
      label: "Attending",
      dot: "bg-primary-container",
      text: "text-primary",
      box: "bg-[#F3F8F5] border-primary/5",
    },
    {
      label: "Declined",
      dot: "bg-secondary",
      text: "text-secondary",
      box: "bg-[#FAF3EC] border-secondary/10",
    },
    {
      label: "Pending",
      dot: "bg-outline",
      text: "text-on-surface-variant",
      box: "bg-surface-container border-[#2A2622]/[0.05]",
    },
  ];

  return (
    <div className={`${CARD} flex flex-col justify-between p-6 lg:col-span-6`}>
      <div>
        <div className={WIDGET_HEADER}>
          <WidgetTitle
            title="RSVP Attendance"
            subtitle="Live guest response status across all functions"
          />
          <ComingSoonButton
            iconAfter="arrow_forward"
            title="Guest management is coming soon"
            message="Build one guest list for every function."
            className="group flex items-center gap-1 font-label-md text-label-md font-semibold text-primary hover:text-primary-container focus:outline-hidden"
          >
            Guest Directory
          </ComingSoonButton>
        </div>

        <div className="my-6">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container p-0.5" />
          <div className="mt-2 flex justify-between font-label-sm text-body-sm text-outline">
            <span>Total Invited: 0 individuals</span>
            <span className="font-medium text-primary">Response rate: —</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          {breakdown.map((item) => (
            <div key={item.label} className={`rounded-lg border p-3 ${item.box}`}>
              <div className={`flex items-center gap-1.5 text-body-sm ${item.text}`}>
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                <span className="font-title text-body-sm font-semibold">0</span>
              </div>
              <p className="mt-1 font-label-sm text-label-sm font-medium tracking-wider text-outline uppercase">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#2A2622]/[0.06] pt-4 text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <Icon name="info" className="text-[16px] text-primary" />
          Responses appear here once invitations go out
        </span>
      </div>
    </div>
  );
}

export function TasksWidget({ pendingTasks }: { pendingTasks: number }) {
  return (
    <div className={`${CARD} flex flex-col justify-between p-6 lg:col-span-6`}>
      <div>
        <div className={WIDGET_HEADER}>
          <WidgetTitle
            title="Upcoming Coordination"
            subtitle="Operational tasks assigned to family & coordinators"
          />
          <ComingSoonButton
            iconAfter="arrow_forward"
            title="The task planner is coming soon"
            message="Assign to-dos to family and your planner."
            className="group flex items-center gap-1 font-label-md text-label-md font-semibold text-primary hover:text-primary-container focus:outline-hidden"
          >
            All Tasks ({pendingTasks})
          </ComingSoonButton>
        </div>
        <div className="mt-4">
          <EmptyState
            icon="checklist"
            title="No tasks yet"
            message="Tasks you assign to family members and your planner will appear here with their due dates."
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#2A2622]/[0.04] pt-3 text-body-sm">
        <span className="text-body-sm text-outline">Assign tasks to family and coordinators</span>
      </div>
    </div>
  );
}

export function FollowUpWidget() {
  return (
    <div className={`${CARD} p-6 lg:col-span-6`}>
      <div className={WIDGET_HEADER}>
        <WidgetTitle title="Pending RSVP Follow-up" subtitle="Guests who haven't replied yet" />
        <span className="rounded bg-surface-container-high px-2 py-0.5 font-label-sm text-[11px] font-medium text-on-surface-variant">
          0 Priority
        </span>
      </div>
      <div className="mt-4">
        <EmptyState
          icon="send"
          title="No pending RSVPs"
          message="Guests who haven't responded will be listed here so you can send a reminder by email or WhatsApp."
        />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#2A2622]/[0.06] pt-3 text-body-sm">
        <span className="text-body-sm text-outline">Direct member outreach</span>
      </div>
    </div>
  );
}

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "rounded bg-primary-container text-on-primary",
  admin: "rounded bg-secondary text-on-secondary",
  member:
    "rounded-full border border-[#2A2622]/[0.08] bg-surface-container-high text-on-surface-variant",
};

function TeamRow({ member }: { member: TeamMember }) {
  const relationship = member.relationship ? RELATIONSHIP_LABEL[member.relationship] : "Member";
  return (
    <div
      className={
        member.isYou
          ? "flex items-center justify-between rounded-lg border border-[#2A2622]/5 bg-surface-container-low px-2 py-1.5"
          : "flex items-center justify-between rounded-lg p-1 transition-colors hover:bg-surface-container-low"
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-title text-[13px] ${member.isYou ? "border border-[#2A2622]/10 bg-[#E5DCD3] text-primary" : "bg-primary/10 text-primary"}`}
        >
          {member.initials}
        </div>
        <div>
          <h5
            className={`font-title text-body-sm text-on-surface ${member.isYou ? "font-semibold" : ""}`}
          >
            {member.name}
            {member.isYou ? (
              <span className="text-[11px] font-normal text-outline"> (You)</span>
            ) : null}
          </h5>
          <p className="font-body-sm text-[12px] text-outline">{relationship}</p>
        </div>
      </div>
      <span
        className={`px-2 py-0.5 font-label-sm text-[10px] font-semibold tracking-wider uppercase ${ROLE_BADGE[member.role]}`}
      >
        {ROLE_LABEL[member.role]}
      </span>
    </div>
  );
}

export function TeamWidget({
  team,
  viewerRole,
}: {
  team: TeamMember[];
  viewerRole: MemberRole | null;
}) {
  return (
    <div className={`${CARD} flex flex-col justify-between p-6 lg:col-span-6`}>
      <div>
        <div className={WIDGET_HEADER}>
          <WidgetTitle
            title="Wedding Workspace Team"
            subtitle="Couple, coordinators, and professional planners"
          />
          <span className="font-label-sm tracking-wider text-outline uppercase">
            {team.length} {team.length === 1 ? "Member" : "Members"}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {team.map((member) => (
            <TeamRow key={member.id} member={member} />
          ))}
        </div>
      </div>
      {canManageMembers(viewerRole) ? (
        <div className="mt-5 pt-3">
          <Link
            href="/dashboard/team"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A2622]/25 py-2.5 text-body-sm text-on-surface-variant transition-all hover:border-primary hover:bg-surface-container-low hover:text-primary active:scale-[0.99]"
          >
            <Icon name="person_add" className="text-[17px]" />
            <span className="font-medium">+ Invite Family Coordinator</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const FOOTER_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#collaboration", label: "Collaboration" },
  { href: "/#privacy", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Security & Compliance" },
  { href: "#", label: "Contact Support" },
];

export function DashboardFooter() {
  return (
    <footer className="mt-16 border-t border-[#2A2622]/[0.06] pt-12 pb-16 text-on-surface-variant">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary-container" />
            <span className="font-headline-sm text-headline-sm font-medium text-primary">
              Make My Marriage
            </span>
          </div>
          <p className="mt-1 max-w-md font-body-sm text-body-sm text-outline">
            High-trust digital architecture for multi-stakeholder wedding production.
          </p>
          <p className="mt-3 font-body-sm text-[12px] text-outline">
            © 2025 Make My Marriage Technologies Pvt Ltd. All rights reserved. Indian IT Act (2000)
            &amp; DPDP Compliant.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
