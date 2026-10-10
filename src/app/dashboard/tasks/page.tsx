import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { TasksManager } from "@/components/tasks/tasks-manager";
import { getServerSession } from "@/modules/auth/server-session";
import { getTasksPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Tasks — Make My Marriage" };

// Stitch screens: "Tasks (List View Grouped by Event)" and "Tasks (Board View)".
// `?view=board|list` picks the view; `?event=<id>` starts filtered to one event (the event
// page's "View all tasks" link).
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; event?: string }>;
}) {
  const { view, event } = await searchParams;
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getTasksPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="tasks">
      <TasksManager
        weddingId={page.weddingId}
        tasks={page.tasks}
        events={page.events}
        members={page.members}
        today={page.today}
        initialEvent={event}
        initialView={view === "board" ? "board" : "list"}
      />
      <DashboardFooter />
    </AppShell>
  );
}
