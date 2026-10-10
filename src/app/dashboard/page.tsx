import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { NoticeBanner } from "@/components/dashboard/notice-banner";
import {
  CountdownHero,
  DashboardFooter,
  FollowUpWidget,
  RsvpWidget,
  StatCards,
  TasksWidget,
  TeamWidget,
} from "@/components/dashboard/sections";
import { getServerSession } from "@/modules/auth/server-session";
import { getDashboard } from "@/modules/dashboard/dashboard.service";

export const metadata: Metadata = { title: "Dashboard — Make My Marriage" };

// Stitch screen: "Make My Marriage — Member Wedding Dashboard (Interactive)", filled with the
// signed-in member's real wedding data (approved 2026-10-04: no sample data in the app).
export default async function DashboardPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const dashboard = await getDashboard(auth);
  const { viewer, workspace } = dashboard;
  // No wedding yet (new signup, Google sign-up, or after leaving one): set one up first.
  if (!workspace) redirect("/onboarding");

  return (
    <AppShell dashboard={{ viewer, workspace }} active="dashboard">
      {workspace.daysUntilWedding === null ? (
        <NoticeBanner noticeId={`${workspace.weddingId}:no-date`}>
          <strong className="font-title font-semibold text-primary">Notice:</strong> Your wedding
          date isn&apos;t set yet. Once it is, everyone in your workspace sees the countdown.
        </NoticeBanner>
      ) : (
        <NoticeBanner noticeId={`${workspace.weddingId}:welcome`}>
          <strong className="font-title font-semibold text-primary">Notice:</strong> Welcome to your
          wedding workspace. Events, guests and tasks appear here as you add them.
        </NoticeBanner>
      )}

      <CountdownHero workspace={workspace} />
      <StatCards counts={workspace.counts} nextEvent={workspace.nextEvent} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <RsvpWidget />
        <TasksWidget
          pendingTasks={workspace.counts.pendingTasks}
          upcoming={workspace.upcomingTasks}
        />
        <FollowUpWidget />
        <TeamWidget team={workspace.team} viewerRole={viewer.role} />
      </section>

      <DashboardFooter />
    </AppShell>
  );
}
