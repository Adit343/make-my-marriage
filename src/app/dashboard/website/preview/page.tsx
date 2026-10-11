import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicSite } from "@/components/website/public-site";
import { getServerSession } from "@/modules/auth/server-session";
import { getWebsitePreviewPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = {
  title: "Website preview — Make My Marriage",
  robots: { index: false, follow: false },
};

// The member's own preview of the site, exactly as guests will see it, even while it is a draft.
// It uses the last SAVED version and is only for the team.
export default async function WebsitePreviewPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getWebsitePreviewPage(auth);
  if (!page) redirect("/onboarding");

  if (page === "forbidden" || page === "none") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="font-headline-md text-headline-md text-primary">
          {page === "forbidden" ? "Only owners and admins can preview" : "Nothing to preview yet"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {page === "forbidden"
            ? "Ask the owner to share the published address with you."
            : "Set up your website first, then come back to preview it."}
        </p>
        <Link href="/dashboard/website" className="font-medium text-primary underline">
          Go to Website
        </Link>
      </main>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-primary-container px-4 py-2 text-center font-body-sm text-body-sm text-on-primary">
        <span>Preview: only your team can see this page.</span>
        <Link href="/dashboard/website" className="font-semibold underline underline-offset-2">
          Back to editor
        </Link>
      </div>
      <PublicSite view={page.view} initialNow={page.nowIso} />
    </>
  );
}
