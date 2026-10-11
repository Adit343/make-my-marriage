import type { Metadata } from "next";
import { headers } from "next/headers";
import { Icon } from "@/components/ui/icon";
import { RsvpForm } from "@/components/invitations/rsvp-form";
import { AppError } from "@/lib/errors";
import { toRsvpPageView } from "@/lib/invitations/rsvp-view";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { getPublicRsvp } from "@/modules/guest-invitations/public-rsvp.service";

export const metadata: Metadata = {
  title: "Your invitation — Make My Marriage",
  // The URL is the guest's credential: keep it out of referrers and search indexes.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The guest's personal link (decision D8: /i/<token>). Stitch "Guest-Facing RSVP Page": the active
// form, the confirmation, and the "link isn't working" state. No account, no password: the link is
// the credential, and every unusable link gets the same answer.
export default async function GuestRsvpPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;

  let view = null;
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim() ||
      "unknown";
    await enforceRateLimit(`rsvp-lookup:${ip}`, RATE_LIMITS.rsvpLookup);
    view = toRsvpPageView(await getPublicRsvp(token));
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
      {view ? (
        <RsvpForm token={token} initial={view} />
      ) : (
        <>
          <div className="bg-primary-container px-6 pt-5 pb-5 text-center text-on-primary shadow-sm">
            <div className="mx-auto mb-2.5 h-0.5 w-10 rounded-full bg-secondary-fixed/50" />
            <p className="font-headline-sm text-headline-sm font-normal tracking-tight text-[#FAF6F0]">
              Wedding celebration
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-between px-6 py-12 text-center">
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-high text-outline">
                <Icon name="link_off" className="text-[40px]" />
              </div>
              <div className="space-y-2">
                <h1 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
                  This link isn&apos;t working
                </h1>
                <p className="mx-auto max-w-[300px] font-body-md text-body-md text-on-surface-variant">
                  It may have been replaced by a newer one. Please ask the couple or coordinator to
                  share your link again.
                </p>
              </div>
              <div className="flex w-full max-w-[320px] items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]">
                <Icon name="info" className="mt-0.5 text-secondary" />
                <div>
                  <p className="font-title text-[14px] font-semibold text-on-surface">
                    Need help right away?
                  </p>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                    Check your WhatsApp or text messages for the most recent wedding invitation
                    update.
                  </p>
                </div>
              </div>
            </div>
            <p className="pt-10 font-headline-sm text-headline-sm font-normal text-outline-variant italic">
              Make My Marriage
            </p>
          </div>
        </>
      )}
    </main>
  );
}
