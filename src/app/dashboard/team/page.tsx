import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { getServerSession } from "@/modules/auth/server-session";
import { getTeamPage } from "@/modules/dashboard/workspace-pages.service";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team — Make My Marriage" };

// Stitch screen: "Team & Member Management (Owner View)".
export default async function TeamPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getTeamPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="members">
      <h1 className="sr-only">Members</h1>
      <TeamManager
        weddingId={page.dashboard.workspace.weddingId}
        weddingTitle={page.weddingTitle}
        members={page.members}
        invitations={page.invitations}
        viewer={page.viewer}
      />
      <DashboardFooter />
    </AppShell>
  );
}
