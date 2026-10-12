import type { Metadata } from "next";
import { InvalidGalleryLink } from "@/components/gallery/guest-gallery";
import { GuestUpload, UploadsClosed } from "@/components/gallery/guest-upload";
import { loadGuestGallery } from "@/modules/gallery/public-page";

export const metadata: Metadata = {
  title: "Add your photos — Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Stitch "Guest Upload Four-State Flow". Reached from the gallery's "Add your photos" button or a
// QR code; works only when the link allows uploads and the couple have guest uploads switched on.
export default async function AddPhotosPage({ params }: PageProps<"/gallery/[token]/add">) {
  const { token } = await params;
  const loaded = await loadGuestGallery(token, 1);
  if (!loaded) return <InvalidGalleryLink />;
  const { gallery } = loaded;
  if (!gallery.canUpload) {
    return (
      <UploadsClosed coupleNames={gallery.coupleNames} token={token} canView={gallery.canView} />
    );
  }
  return (
    <GuestUpload
      token={token}
      coupleNames={gallery.coupleNames}
      albumTitle={gallery.albumTitle}
      canView={gallery.canView}
    />
  );
}
