import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { StreamsManager } from "@/components/livestream/streams-manager";
import { getServerSession } from "@/modules/auth/server-session";
import { getLiveStreamsPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Live stream — Make My Marriage" };

// Stitch screens "Live Streams Manager" and "Add Stream (Slide-over)". Every role can manage
// streams (API Design §11): whoever is at the venue can set one live.
export default async function LiveStreamPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getLiveStreamsPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="live">
      <StreamsManager
        weddingId={page.weddingId}
        timezone={page.timezone}
        streams={page.streams}
        events={page.events}
        nowIso={page.nowIso}
      />
      <DashboardFooter />
    </AppShell>
  );
}
