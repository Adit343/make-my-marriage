import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { RestrictedPage } from "@/components/finance/restricted-page";
import { VendorsManager } from "@/components/finance/vendors-manager";
import { getServerSession } from "@/modules/auth/server-session";
import { getVendorsPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Vendors — Make My Marriage" };

// Stitch screen "Vendors List". Owners and admins only (decision D3): a member who opens the link
// is told so, inside the normal shell, rather than meeting a bare error.
export default async function VendorsPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getVendorsPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="vendors">
      {page.forbidden ? (
        <RestrictedPage />
      ) : (
        <VendorsManager
          weddingId={page.weddingId}
          currency={page.currency}
          vendors={page.vendors}
          placesConfigured={page.placesConfigured}
        />
      )}
      <DashboardFooter />
    </AppShell>
  );
}
