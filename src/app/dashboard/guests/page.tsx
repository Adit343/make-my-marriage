import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { GuestsManager } from "@/components/guests/guests-manager";
import { RSVP_STATUSES, type RsvpStatus } from "@/lib/constants/enums";
import { getServerSession } from "@/modules/auth/server-session";
import { getGuestsPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Guests — Make My Marriage" };

// Stitch screens: "Guests List (Owner View)", "Add / Edit Guest (Slide-over)" and "Guest Detail
// (Slide-over)". `?event=<id>` starts on one event's replies (the Events screen's "Manage guests"); `?rsvp=pending` starts filtered to guests who owe an answer (the dashboard's follow-up widget).
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; rsvp?: string }>;
}) {
  const { event, rsvp } = await searchParams;
  const initialRsvp = RSVP_STATUSES.find((status) => status === rsvp);
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getGuestsPage(auth, { eventId: event });
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="guests">
      <GuestsManager
        weddingId={page.weddingId}
        timezone={page.timezone}
        partners={page.partners}
        events={page.events}
        initialGroups={page.groups}
        initialPage={page.page}
        initialSummary={page.summary}
        initialEvent={page.eventId}
        initialRsvp={initialRsvp satisfies RsvpStatus | undefined}
      />
      <DashboardFooter />
    </AppShell>
  );
}
