import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { EventsManager } from "@/components/events/events-manager";
import { getServerSession } from "@/modules/auth/server-session";
import { getEventsPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Events — Make My Marriage" };

// Stitch screen: "Events Timeline (Owner View)".
export default async function EventsPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getEventsPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="events">
      <EventsManager
        weddingId={page.weddingId}
        weddingTimezone={page.weddingTimezone}
        events={page.events}
        summary={page.summary}
        canCreate={page.canCreate}
      />
      <DashboardFooter />
    </AppShell>
  );
}
