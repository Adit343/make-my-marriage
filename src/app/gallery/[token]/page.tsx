import type { Metadata } from "next";
import { GuestGallery, InvalidGalleryLink } from "@/components/gallery/guest-gallery";
import { loadGuestGallery } from "@/modules/gallery/public-page";

export const metadata: Metadata = {
  title: "Wedding photos — Make My Marriage",
  // The URL is the guest's credential: keep it out of search indexes and out of referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The guest gallery (decision D8: /gallery/<token>). Stitch "Guest Gallery Page & Mobile Viewer".
// No account: the link is the credential, and every unusable link gets the same answer.
export default async function GalleryPage({ params }: PageProps<"/gallery/[token]">) {
  const { token } = await params;
  const loaded = await loadGuestGallery(token, 30);
  if (!loaded) return <InvalidGalleryLink />;
  return <GuestGallery token={token} initial={loaded.gallery} initialCursor={loaded.nextCursor} />;
}
