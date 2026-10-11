import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ROLE_LABEL } from "@/components/dashboard/labels";
import { DashboardFooter } from "@/components/dashboard/sections";
import { InvitationsHub, type InvitationsTab } from "@/components/invitations/invitations-hub";
import { getServerSession } from "@/modules/auth/server-session";
import { getInvitationsPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Invitations — Make My Marriage" };

const TABS: InvitationsTab[] = ["overview", "responses", "log"];

// Stitch screens: "Invitations Hub" (Overview and Delivery log tabs), "RSVP Tracker" (the RSVP
// responses tab) and the "Send Invitations Dialog". `?tab=` opens a tab, `?event=` the tracker's
// event, `?batch=` one send batch in the delivery log.
export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; event?: string; batch?: string }>;
}) {
  const query = await searchParams;
  const auth = await getServerSession();
  if (!auth) redirect("/login");

  const requested = TABS.find((tab) => tab === query.tab) ?? "overview";
  const page = await getInvitationsPage(auth, {
    eventId: query.event,
    wantReplies: requested === "responses",
  });
  if (!page) redirect("/onboarding");

  // The delivery log is for owners and admins; anyone else lands on the overview.
  const tab = requested === "log" && !page.canViewLog ? "overview" : requested;
  const batch = /^[0-9a-f-]{36}$/i.test(query.batch ?? "") ? (query.batch ?? null) : null;

  return (
    <AppShell dashboard={page.dashboard} active="invitations">
      <InvitationsHub
        weddingId={page.weddingId}
        timezone={page.timezone}
        events={page.events}
        initialOverview={page.overview}
        canViewLog={page.canViewLog}
        viewerLabel={`${page.viewer.name} (${ROLE_LABEL[page.viewer.role]})`}
        initialTab={tab}
        initialEventId={page.eventId}
        initialReplies={page.replies}
        initialBatch={batch}
        serverNow={new Date().toISOString()}
      />
      <DashboardFooter />
    </AppShell>
  );
}
