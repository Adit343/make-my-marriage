import type { ReactNode } from "react";
import { Sidebar, type NavSection } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import type { Dashboard } from "@/modules/dashboard/dashboard.service";

/**
 * The signed-in chrome from the Stitch dashboard (sidebar + top bar + scrolling main area),
 * shared by every workspace page.
 */
export function AppShell({
  dashboard,
  active,
  width = "wide",
  children,
}: {
  dashboard: Dashboard & { workspace: NonNullable<Dashboard["workspace"]> };
  active: NavSection;
  /** "narrow" is the Settings screen's reading width. */
  width?: "wide" | "narrow";
  children: ReactNode;
}) {
  const { viewer, workspace } = dashboard;
  return (
    <div className="dashboard-icons relative flex h-dvh flex-col overflow-hidden bg-surface text-body-md text-on-surface selection:bg-primary-fixed selection:text-primary md:flex-row">
      <Sidebar pendingTasks={workspace.counts.pendingTasks} active={active} role={viewer.role} />

      <div className="flex h-full flex-1 flex-col overflow-hidden bg-surface">
        <TopBar viewer={viewer} workspace={workspace} />

        <main
          className={`custom-scrollbar mx-auto w-full flex-1 overflow-y-auto px-6 py-8 md:px-12 ${
            width === "narrow" ? "max-w-5xl space-y-10 md:py-12" : "max-w-7xl space-y-8"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
