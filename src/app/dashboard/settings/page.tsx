import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { getServerSession } from "@/modules/auth/server-session";
import { getSettingsPage } from "@/modules/dashboard/workspace-pages.service";
import { SettingsPanel } from "./settings-panel";

export const metadata: Metadata = { title: "Settings — Make My Marriage" };

// Stitch screen: "Settings (Owner View)".
export default async function SettingsPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getSettingsPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="settings" width="narrow">
      <SettingsPanel
        wedding={page.wedding}
        user={page.user}
        sessions={page.sessions}
        viewer={page.viewer}
        canEditWedding={page.canEditWedding}
        activeMemberCount={page.activeMemberCount}
      />
    </AppShell>
  );
}
