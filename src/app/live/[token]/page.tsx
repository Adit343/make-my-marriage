import type { Metadata } from "next";
import { headers } from "next/headers";
import { InvalidLiveLink, WatchPage } from "@/components/livestream/watch-page";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { getPublicLive } from "@/modules/livestream/stream.service";

export const metadata: Metadata = {
  title: "Live celebration — Make My Marriage",
  // The URL is the guest's credential: keep it out of search indexes.
  robots: { index: false, follow: false },
  // Not "no-referrer" like the RSVP page: YouTube refuses to play an embed that sends no referrer.
  // "origin" sends only the site's address, never the path that holds the token.
  referrer: "origin",
};

// The guest watch page (decision D8: /live/<token>). Stitch "Guest Live Page (Four States)". No
// account: the link is the credential, and every unusable link gets the same answer.
export default async function LivePage({ params }: PageProps<"/live/[token]">) {
  const { token } = await params;

  let initial = null;
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim() ||
      "unknown";
    await enforceRateLimit(`live-lookup:${ip}`, RATE_LIMITS.liveLookup);
    initial = await getPublicLive(token);
  } catch (error) {
    // A rate limit or an unusable link reads the same to the visitor. Anything else is a real fault.
    if (
      !(error instanceof AppError) ||
      (error.code !== "INVALID_TOKEN" && error.code !== "RATE_LIMITED")
    ) {
      throw error;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background text-body-md text-on-surface shadow-[0_0_60px_-20px_rgba(42,38,34,0.18)] selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {initial ? (
        <WatchPage token={token} initial={initial} nowIso={new Date().toISOString()} />
      ) : (
        <InvalidLiveLink />
      )}
    </main>
  );
}
