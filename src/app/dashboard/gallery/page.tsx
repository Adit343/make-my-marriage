import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { GalleryManager, type GalleryTab } from "@/components/gallery/gallery-manager";
import { getServerSession } from "@/modules/auth/server-session";
import { getGalleryPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Gallery — Make My Marriage" };

const TABS: GalleryTab[] = ["photos", "approval", "sharing"];

// Stitch screens "Gallery Home & Empty State", "Gallery Upload Slide-over", "Photo Viewer
// Lightbox", "Album Page & Edit/Delete Modals", "Gallery Approval Queue", "Gallery Sharing &
// Settings" and "QR Dialog & Printable Wedding Card". Every role sees and adds photos; the
// approval queue and shared links are for owners and admins. `?tab=` and `?album=<id>` deep-link.
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; album?: string }>;
}) {
  const { tab, album } = await searchParams;
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getGalleryPage(auth);
  if (!page) redirect("/onboarding");

  return (
    <AppShell dashboard={page.dashboard} active="gallery">
      <GalleryManager
        weddingId={page.weddingId}
        canManage={page.canManage}
        settings={page.settings}
        albums={page.albums}
        links={page.links}
        events={page.events}
        coupleNames={page.coupleNames}
        dateLabel={page.dateLabel}
        timezone={page.timezone}
        nowIso={page.nowIso}
        initialTab={TABS.find((candidate) => candidate === tab) ?? "photos"}
        initialAlbumId={/^[a-f0-9]{24}$/i.test(album ?? "") ? (album ?? null) : null}
      />
      <DashboardFooter />
    </AppShell>
  );
}
