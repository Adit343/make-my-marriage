import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { RestrictedPage } from "@/components/finance/restricted-page";
import { VendorDetail } from "@/components/finance/vendor-detail";
import { objectId } from "@/lib/validation/primitives";
import { getServerSession } from "@/modules/auth/server-session";
import { getVendorPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Vendor — Make My Marriage" };

// Stitch screen "Vendor Detail". Owners and admins only (decision D3).
export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  if (!objectId.safeParse(vendorId).success) notFound();
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getVendorPage(auth, vendorId);
  if (!page) redirect("/onboarding");
  if (page === "not_found") notFound();

  return (
    <AppShell dashboard={page.dashboard} active="vendors">
      {page.forbidden ? (
        <RestrictedPage />
      ) : (
        <VendorDetail
          weddingId={page.weddingId}
          currency={page.currency}
          timezone={page.timezone}
          detail={page.detail}
          events={page.events}
          vendorChoices={page.vendorChoices}
          placesConfigured={page.placesConfigured}
        />
      )}
      <DashboardFooter />
    </AppShell>
  );
}
