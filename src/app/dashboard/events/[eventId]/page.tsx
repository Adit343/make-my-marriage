import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ComingSoonButton } from "@/components/dashboard/coming-soon-button";
import { DashboardFooter } from "@/components/dashboard/sections";
import { EventDetailActions } from "@/components/events/event-detail-actions";
import { ScheduleCard } from "@/components/events/schedule-card";
import { EventTasksCard } from "@/components/tasks/event-tasks-card";
import { Icon, type IconName } from "@/components/ui/icon";
import type { EventDetailView } from "@/lib/events/view";
import { getServerSession } from "@/modules/auth/server-session";
import { getEventPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Event — Make My Marriage" };

// Stitch screen: "Event Detail (Haldi)". Guests, tasks and expenses arrive in later steps, so
// their cards show designed empty states instead of invented numbers.

const CARD =
  "rounded-xl border border-[#2A2622]/[0.04] bg-[#FFFDF9] shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)]";
const CARD_HEADER = "flex items-center justify-between border-b border-[#2A2622]/[0.05] pb-3";
const SECTION_LABEL = "text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase";
const BADGE_ROW =
  "rounded px-2 py-0.5 text-[11px] font-medium bg-[#F4EFEA] text-on-surface-variant";

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#F4EFEA] text-[#1F4D3D]">
        <Icon name={icon} className="text-[20px]" />
      </div>
      <div>
        <div className={SECTION_LABEL}>{label}</div>
        {children}
      </div>
    </div>
  );
}

function EmptyCardState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2A2622]/15 bg-surface-container-low px-6 py-8 text-center">
      <Icon name={icon} className="text-outline" />
      <p className="font-title text-body-sm text-on-surface">{title}</p>
      <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">{message}</p>
    </div>
  );
}

function TypeBadge({ event }: { event: EventDetailView }) {
  const haldi = event.type === "haldi";
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-medium tracking-wide ${
        haldi
          ? "border border-[#ECD9A8]/50 bg-[#FAF2DE] text-[#8B6B2B]"
          : "bg-[#1F4D3D]/10 text-[#1F4D3D]"
      }`}
    >
      {haldi ? "Haldi Ritual" : event.typeLabel}
    </span>
  );
}

function MapCard({ event }: { event: EventDetailView }) {
  const placeName = event.venueName ?? event.address ?? "Venue";
  return (
    <div className="flex flex-col md:col-span-5">
      <div className="relative flex h-full min-h-[220px] w-full flex-col justify-between overflow-hidden rounded-lg border border-[#2A2622]/[0.08] bg-[#EAE4DC] shadow-inner">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(#2A2622 0.75px, transparent 0.75px), radial-gradient(#2A2622 0.75px, #EAE4DC 0.75px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0, 12px 12px",
            opacity: 0.18,
          }}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-[#2A2622]/[0.09]"
          preserveAspectRatio="none"
          viewBox="0 0 300 200"
        >
          <path
            d="M-10,50 Q100,20 180,80 T320,120"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M-20,110 Q90,130 190,140 T320,190"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path
            d="M40,-10 Q80,90 120,220"
            fill="none"
            stroke="currentColor"
            strokeDasharray="4,4"
            strokeWidth="1.2"
          />
          <circle cx="160" cy="85" fill="#1F4D3D" fillOpacity="0.04" r="42" />
        </svg>
        <div className="relative z-10 m-auto flex flex-col items-center">
          <div className="flex h-10 w-10 -translate-y-2 items-center justify-center rounded-full bg-[#1F4D3D] text-[#FAF6F0] shadow-lg ring-4 ring-[#FFFDF9]/90">
            <Icon name="pin_drop" className="text-[22px]" />
          </div>
          <span className="mt-1 max-w-[220px] truncate rounded border border-[#2A2622]/[0.08] bg-[#FFFDF9]/95 px-2.5 py-0.5 text-[11px] font-semibold text-[#1F4D3D] shadow-sm">
            {placeName}
          </span>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-[#2A2622]/[0.08] bg-[#FFFDF9]/95 p-2.5 text-[11px]">
          {event.mapsUrl ? (
            <a
              href={event.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-medium text-[#1F4D3D] hover:underline"
            >
              <span>Open in Google Maps</span>
              <Icon name="north_east" className="text-[13px]" />
            </a>
          ) : (
            <span />
          )}
          {event.coordinates ? (
            <span className="font-mono text-[10px] text-on-surface-variant">
              {event.coordinates.latitude.toFixed(4)}° N, {event.coordinates.longitude.toFixed(4)}°
              E
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  // A malformed id can't be an event in this wedding: same answer as a missing one.
  if (!/^[a-f0-9]{24}$/i.test(eventId)) notFound();
  const page = await getEventPage(auth, eventId);
  if (!page) redirect("/onboarding");
  if (page === "not_found") notFound();
  const { event } = page;
  const hasVenue = Boolean(event.venueName ?? event.address);

  return (
    <AppShell dashboard={page.dashboard} active="events">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-body-sm text-on-surface-variant"
          >
            <Link
              href="/dashboard/events"
              className="flex items-center gap-1 transition-colors hover:text-[#1F4D3D]"
            >
              <Icon name="arrow_back" className="text-[17px]" />
              <span>Events</span>
            </Link>
            <span className="text-[#2A2622]/30">/</span>
            <span className="font-medium text-[#2A2622]">{event.name}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-[#2A2622]">
                {event.name}
              </h1>
              <div className="flex items-center gap-2 pl-2">
                <TypeBadge event={event} />
                {event.isPublic ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#1F4D3D] px-2.5 py-1 text-[11px] font-medium tracking-wide text-[#FAF6F0] shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Public
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-medium tracking-wide text-on-surface-variant">
                    Private
                  </span>
                )}
              </div>
            </div>
            <EventDetailActions
              weddingId={page.weddingId}
              weddingTimezone={page.weddingTimezone}
              event={event}
            />
          </div>
        </div>

        <div className={`${CARD} p-6 md:p-8`}>
          <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-12">
            <div
              className={`flex flex-col justify-between space-y-6 ${event.mapsUrl ? "md:col-span-7" : "md:col-span-12"}`}
            >
              <InfoRow icon="schedule" label="Date & Time">
                <div className="mt-0.5 text-[16px] font-medium text-[#2A2622]">
                  {event.longDate}
                </div>
                <div className="text-body-sm text-on-surface-variant">
                  {event.detailTimeRange}
                  {event.duration ? ` (${event.duration})` : ""}
                </div>
              </InfoRow>

              {hasVenue ? (
                <InfoRow icon="location_on" label="Venue">
                  <div className="mt-0.5 text-[16px] font-medium text-[#2A2622]">
                    {event.venueName ?? event.address}
                  </div>
                  {event.venueName && event.address ? (
                    <p className="max-w-sm text-body-sm leading-relaxed text-on-surface-variant">
                      {event.address}
                    </p>
                  ) : null}
                </InfoRow>
              ) : null}

              {event.dressCode ? (
                <div className="border-t border-[#2A2622]/[0.05] pt-4">
                  <div className={SECTION_LABEL}>Dress Code</div>
                  <div className="mt-1 flex items-center gap-1.5 text-body-sm font-medium text-[#B5714A]">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E5AB35]" />
                    {event.dressCode}
                  </div>
                </div>
              ) : null}
            </div>
            {event.mapsUrl ? <MapCard event={event} /> : null}
          </div>
        </div>

        {event.description ? (
          <div className={`${CARD} p-6 md:p-7`}>
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <Icon name="auto_stories" className="text-[18px] text-[#B5714A]" />
              <span className={SECTION_LABEL}>About this celebration</span>
            </div>
            <p className="max-w-4xl font-headline-sm text-[19px] leading-[30px] font-normal whitespace-pre-line text-[#2A2622]/90">
              {event.description}
            </p>
          </div>
        ) : null}

        <ScheduleCard weddingId={page.weddingId} event={event} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className={`${CARD} flex flex-col justify-between p-6 md:col-span-5`}>
            <div>
              <div className={CARD_HEADER}>
                <h2 className="font-headline-sm text-headline-sm font-normal text-[#2A2622]">
                  Guest responses
                </h2>
                <span className={BADGE_ROW}>0 Total</span>
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="font-display text-display leading-none font-light tracking-tight text-[#1F4D3D]">
                  0
                </span>
                <div>
                  <div className="text-body-md font-medium text-[#2A2622]">Attending</div>
                  <div className="text-[12px] text-on-surface-variant">out of 0 invited</div>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EAE1DA]" />
                <div className="grid grid-cols-2 gap-y-2 pt-2 text-[12px]">
                  {[
                    ["Attending", "bg-[#1F4D3D]"],
                    ["Declined", "bg-[#B5714A]"],
                    ["Maybe", "bg-[#D9A148]"],
                    ["Pending", "bg-[#C0C8C3]"],
                  ].map(([label, dot]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      <span className="text-[#2A2622]">
                        {label}: <strong className="font-semibold">0</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-lg border border-[#2A2622]/[0.05] bg-[#FAF6F0] p-3 text-[12px] text-on-surface-variant">
                <span>Responses appear here once invitations go out</span>
              </div>
            </div>
            <div className="mt-6 border-t border-[#2A2622]/[0.05] pt-5">
              <ComingSoonButton
                iconAfter="arrow_forward"
                title="Guest management is coming soon"
                message="Build one guest list and invite people to each function."
                className="group flex items-center gap-1.5 text-body-sm font-semibold text-[#1F4D3D] transition-colors hover:text-[#023627]"
              >
                View guest list for {event.name}
              </ComingSoonButton>
            </div>
          </div>

          <EventTasksCard
            weddingId={page.weddingId}
            eventId={event.id}
            tasks={page.tasks}
            events={page.taskForm.events}
            members={page.taskForm.members}
            today={page.taskForm.today}
          />

          <div className={`${CARD} p-6 md:col-span-12 md:p-7`}>
            <div className={`${CARD_HEADER} pb-4`}>
              <div className="flex items-center gap-2.5">
                <Icon name="payments" className="text-[20px] text-[#1F4D3D]" />
                <h2 className="font-headline-sm text-headline-sm font-normal text-[#2A2622]">
                  Linked expenses
                </h2>
              </div>
            </div>
            <EmptyCardState
              icon="account_balance_wallet"
              title="No expenses linked to this event yet"
              message="Expenses you record against this event, and what's been paid, show up here."
            />
          </div>
        </div>
      </div>
      <DashboardFooter />
    </AppShell>
  );
}
