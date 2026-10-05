import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { getServerSession } from "@/modules/auth/server-session";
import { getDashboard } from "@/modules/dashboard/dashboard.service";

export const metadata: Metadata = { title: "Dashboard — Make My Marriage" };

// Stitch screen: "Make My Marriage — Member Wedding Dashboard (Interactive)", filled with the
// signed-in member's real wedding data (approved 2026-10-04: no sample data in the app).
export default async function DashboardPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const { viewer, workspace } = await getDashboard(auth);
  // No wedding yet (new signup, Google sign-up, or after leaving one): set one up first.
  if (!workspace) redirect("/onboarding");

  return (
    <div className="dashboard-icons relative flex h-dvh flex-col overflow-hidden bg-surface text-body-md text-on-surface selection:bg-primary-fixed selection:text-primary md:flex-row">
      <Sidebar pendingTasks={workspace.counts.pendingTasks} />

      <div className="flex h-full flex-1 flex-col overflow-hidden bg-surface">
        <TopBar viewer={viewer} workspace={workspace} />

        <main className="custom-scrollbar mx-auto w-full max-w-7xl flex-1 space-y-8 overflow-y-auto px-6 py-8 md:px-12">
          {workspace.daysUntilWedding === null ? (
            <NoticeBanner noticeId={`${workspace.weddingId}:no-date`}>
              <strong className="font-title font-semibold text-primary">Notice:</strong> Your
              wedding date isn&apos;t set yet. Once it is, everyone in your workspace sees the
              countdown.
            </NoticeBanner>
          ) : (
            <NoticeBanner noticeId={`${workspace.weddingId}:welcome`}>
              <strong className="font-title font-semibold text-primary">Notice:</strong> Welcome to
              your wedding workspace. Events, guests and tasks appear here as you add them.
            </NoticeBanner>
          )}

          <CountdownHero workspace={workspace} />
          <StatCards counts={workspace.counts} />

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <RsvpWidget />
            <TasksWidget pendingTasks={workspace.counts.pendingTasks} />
            <FollowUpWidget />
            <TeamWidget team={workspace.team} viewerRole={viewer.role} />
          </section>

          <DashboardFooter />
        </main>
      </div>
    </div>
  );
}
