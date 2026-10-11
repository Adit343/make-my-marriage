"use client";

import { useEffect, useState } from "react";
import { fetchLiveStatus } from "@/components/livestream/livestream-api";
import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/client/api-client";
import { startsInLabel } from "@/lib/livestream/view";
import type { PublicLive } from "@/modules/livestream/stream.service";

// The guest's watch page (Stitch "Guest Live Page (Four States)": scheduled, live now, ended and
// "link not working"). Mobile first, large touch targets, no account. The video plays on YouTube
// or Vimeo: this page embeds the player (or links to it) and re-checks the status about once a
// minute while it is open, because the team sets the status by hand and there are no WebSockets.

const POLL_MS = 60_000;

function Band({ names, icon }: { names: string; icon: IconName }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between bg-primary-container px-6 pt-6 pb-4 text-on-primary shadow-sm">
      <div>
        <h2 className="font-headline-sm text-[20px] leading-tight font-normal text-[#FAF6F0]">
          {names}
        </h2>
        <p className="mt-0.5 font-label-sm text-label-sm tracking-wider text-tertiary-fixed-dim uppercase">
          Live celebration
        </p>
      </div>
      <Icon name={icon} className="text-[28px] text-tertiary-fixed-dim" />
    </div>
  );
}

function Branding() {
  return (
    <footer className="shrink-0 border-t border-[#2A2622]/[0.04] bg-[#FAF6F0] px-6 py-3 text-center">
      <p className="font-label-sm text-label-sm text-outline">Made with Make My Marriage</p>
    </footer>
  );
}

export function InvalidLiveLink() {
  return (
    <>
      <Band names="Wedding celebration" icon="link_off" />
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full border border-secondary/20 bg-surface-container text-secondary shadow-sm">
          <Icon name="link_off" className="text-[36px]" />
        </div>
        <h1 className="font-headline-md text-[30px] leading-tight font-normal text-primary">
          This link isn&apos;t working
        </h1>
        <p className="mt-4 max-w-[280px] font-body-md text-body-md leading-relaxed text-on-surface-variant">
          It may have been replaced by a newer one. Please ask the couple to share it again.
        </p>
        <div className="mt-8 flex max-w-[280px] items-center gap-2.5 rounded-xl border border-[#2A2622]/[0.06] bg-[#FFFDF9] px-5 py-3.5 text-left shadow-sm">
          <Icon name="info" className="shrink-0 text-secondary" />
          <p className="font-body-sm text-body-sm text-on-surface">No account or login required.</p>
        </div>
      </div>
      <Branding />
    </>
  );
}

export function WatchPage({
  token,
  initial,
  nowIso,
}: {
  token: string;
  initial: PublicLive;
  nowIso: string;
}) {
  const [data, setData] = useState<PublicLive | null>(initial);
  const [now, setNow] = useState(() => new Date(nowIso).getTime());

  // Keep the countdown honest, and ask again whether the stream has started.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, []);

  const status = data?.status;
  useEffect(() => {
    if (status !== "scheduled" && status !== "live") return;
    let controller: AbortController | null = null;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      try {
        setData(await fetchLiveStatus(token, controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // The link was replaced or removed while the page was open.
        if (error instanceof ApiError && error.status === 403) setData(null);
        // Any other failure (offline, busy): keep showing what we have and try again next time.
      }
    };
    const timer = window.setInterval(() => void check(), POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [token, status]);

  if (!data) return <InvalidLiveLink />;

  const weekday = data.dateLabel.split(",")[0] ?? data.dateLabel;
  const shortDay = data.dateLabel.replace(/^\w+, /, "").replace(/ \d{4}$/, "");

  if (data.status === "scheduled") {
    return (
      <>
        <Band names={data.coupleNames} icon="schedule" />
        <div className="flex flex-1 flex-col px-6 py-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-secondary/20 bg-secondary-fixed/50 px-3.5 py-1.5 text-on-secondary-fixed">
            <span className="size-2 animate-pulse rounded-full bg-secondary" />
            <span className="font-label-md text-label-md">
              Starts {weekday}, {data.timeLabel}
            </span>
          </div>
          <div className="mt-5">
            <h1 className="font-headline-md text-headline-md leading-tight font-normal text-primary">
              {data.title}
            </h1>
            <p className="mt-1.5 font-body-md text-body-md text-on-surface-variant">
              {data.dateLabel}
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-[#2A2622]/[0.06] bg-[#FFFDF9] p-5 shadow-sm">
            <span className="mb-1 block font-label-sm text-label-sm tracking-wider text-outline uppercase">
              Countdown
            </span>
            <p
              aria-live="polite"
              className="font-headline-md text-[30px] leading-tight font-normal text-[#1F4D3D]"
            >
              {startsInLabel(data.startTime, new Date(now))}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#2A2622]/[0.06] pt-3 font-body-sm text-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Icon name="calendar_today" className="text-[16px]" />
                {shortDay} • {data.timeLabel}
              </span>
              <span className="rounded bg-secondary-fixed/40 px-2 py-0.5 font-label-sm text-label-sm text-secondary">
                {data.zoneLabel}
              </span>
            </div>
          </div>
          {data.description ? (
            <p className="mt-6 font-body-md text-body-md leading-relaxed whitespace-pre-line text-on-surface-variant">
              {data.description}
            </p>
          ) : null}
          <div className="mt-auto pt-6">
            <button
              type="button"
              disabled
              className="flex min-h-[52px] w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-[#2A2622]/[0.18] px-4 py-3 font-label-md text-label-md text-outline select-none"
            >
              <Icon name="lock_clock" />
              <span>Watch will open when the stream starts</span>
            </button>
          </div>
        </div>
        <Branding />
      </>
    );
  }

  if (data.status === "live") {
    return (
      <>
        <Band names={data.coupleNames} icon="videocam" />
        <div className="flex flex-1 flex-col px-6 py-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary-container px-3.5 py-1.5 text-[#FAF6F0] shadow-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-label-md text-label-md tracking-wider">LIVE NOW</span>
          </div>
          <div className="mt-3.5 mb-4">
            <h1 className="font-headline-md text-headline-md leading-tight font-normal text-primary">
              {data.title}
            </h1>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Streaming live on {data.providerLabel}
            </p>
          </div>

          {data.embedUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#2A2622] shadow-md">
              <iframe
                src={data.embedUrl}
                title={data.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full border-0"
              />
            </div>
          ) : data.watchUrl ? (
            <a
              href={data.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex aspect-video w-full items-center justify-center rounded-2xl bg-[#2A2622] shadow-md"
              aria-label={`Watch on ${data.providerLabel}`}
            >
              <span className="flex size-14 items-center justify-center rounded-full border border-[#FAF6F0]/20 bg-[#FAF6F0]/15 text-[#FAF6F0] backdrop-blur-sm">
                <Icon name="play_arrow" className="text-[32px]" />
              </span>
            </a>
          ) : null}

          <div className="mt-4">
            <p className="font-body-md text-body-md leading-relaxed whitespace-pre-line text-on-surface-variant">
              {data.description ??
                `The celebration is live now. If the video doesn't play or keeps buffering, open it directly on ${data.providerLabel}.`}
            </p>
          </div>
          {data.watchUrl ? (
            <div className="mt-auto pt-4">
              <a
                href={data.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1F4D3D] px-6 py-3.5 font-title text-title text-[#FAF6F0] shadow-sm transition-all hover:bg-[#163A2E] active:scale-[0.99]"
              >
                <span>
                  {data.provider === "other" ? "Open the stream" : `Open on ${data.providerLabel}`}
                </span>
                <Icon name="north_east" />
              </a>
            </div>
          ) : null}
        </div>
        <Branding />
      </>
    );
  }

  if (data.status === "cancelled") {
    return (
      <>
        <Band names={data.coupleNames} icon="info" />
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#2A2622]/[0.08] bg-[#EFE7E0] px-3.5 py-1.5 text-on-surface-variant">
            <span className="size-2 rounded-full bg-outline" />
            <span className="font-label-md text-label-md tracking-wider uppercase">Cancelled</span>
          </div>
          <h1 className="font-headline-md text-[30px] leading-tight font-normal text-primary">
            This stream has been cancelled
          </h1>
          <p className="mt-4 max-w-[290px] font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
            {data.title} won&apos;t be broadcast. Please check with the family for any new plans.
          </p>
        </div>
        <Branding />
      </>
    );
  }

  return (
    <>
      <Band names={data.coupleNames} icon="favorite" />
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#2A2622]/[0.08] bg-[#EFE7E0] px-3.5 py-1.5 text-on-surface-variant">
          <span className="size-2 rounded-full bg-outline" />
          <span className="font-label-md text-label-md tracking-wider uppercase">Ended</span>
        </div>
        <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-secondary/15 bg-surface-container text-secondary">
          <Icon name="volunteer_activism" className="text-[30px]" />
        </div>
        <h1 className="font-headline-md text-[32px] leading-[40px] font-normal text-primary">
          Thank you for celebrating with us.
        </h1>
        <p className="mt-4 max-w-[280px] font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
          The stream has concluded. Thank you for blessing {data.coupleNames} from across the world.
        </p>
        <div className="mt-8 w-full max-w-[240px] border-t border-[#2A2622]/[0.08] pt-8">
          <p className="font-headline-sm text-lg text-secondary italic">
            With gratitude &amp; love
          </p>
        </div>
      </div>
      <Branding />
    </>
  );
}
