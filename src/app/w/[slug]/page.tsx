import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { PublicSite } from "@/components/website/public-site";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { getPublicWebsite } from "@/modules/website/website.service";

// The public wedding website (decision D8: /w/<slug>). No account and no token: it is a published
// site's address. The page is built from the whitelisted view only. A draft, a deleted site or
// wedding, a reserved word and an address nobody uses are all the same "not found".

const load = cache(async (slug: string) => {
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim() ||
      "unknown";
    await enforceRateLimit(`site-lookup:${ip}`, RATE_LIMITS.siteLookup);
    return await getPublicWebsite(slug);
  } catch (error) {
    // A rate limit or an unusable address reads the same to the visitor. Anything else is a real fault.
    if (
      error instanceof AppError &&
      (error.code === "NOT_FOUND" || error.code === "RATE_LIMITED")
    ) {
      return null;
    }
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) return { title: "Page not found — Make My Marriage", robots: { index: false } };
  const title = view.seo.title.trim() || `${view.coupleNames}'s Wedding`;
  const description = view.seo.description.trim() || undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function PublicWeddingSitePage({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) notFound();
  return <PublicSite view={view} initialNow={new Date().toISOString()} />;
}
