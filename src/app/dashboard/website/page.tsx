import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { RestrictedPage } from "@/components/finance/restricted-page";
import { WebsiteEditor } from "@/components/website/website-editor";
import { getServerSession } from "@/modules/auth/server-session";
import { getWebsitePage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Website — Make My Marriage" };

// Stitch screens "Wedding Website Editor" (Content) and "Website Design and Settings". Owners and
// admins only (decision D3): a member who opens the link is told so, inside the normal shell.
export default async function WebsitePage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getWebsitePage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="website">
      {page.forbidden ? (
        <RestrictedPage
          title="The website is for owners and admins"
          body="Only owners and admins can write and publish the wedding website. Ask the owner if something on it needs changing."
          href="/dashboard"
          linkLabel="Back to Overview"
        />
      ) : (
        <WebsiteEditor weddingId={page.weddingId} data={page.data} nowIso={page.nowIso} />
      )}
      <DashboardFooter />
    </AppShell>
  );
}
