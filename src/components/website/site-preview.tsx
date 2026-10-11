"use client";

import { useState } from "react";
import { PublicSite } from "@/components/website/public-site";
import { Icon } from "@/components/ui/icon";
import type { PublicSiteView } from "@/lib/website/site";

// The live preview column of the editor (Stitch: "Live Preview", Desktop / Phone switch, a phone
// frame, "Updates as you type"). It renders the real public-site component with the draft, so it
// is not a mock-up: it cannot drift from what guests will see.

const DESKTOP_WIDTH = 1200;
const FRAME_INNER = 316;

export function SitePreview({ view, initialNow }: { view: PublicSiteView; initialNow: string }) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const zoom = FRAME_INNER / DESKTOP_WIDTH;

  return (
    <aside aria-label="Live preview" className="flex w-full flex-col items-center">
      <div className="flex w-full items-center justify-between px-2 pb-3">
        <span className="font-label-md text-label-md font-semibold tracking-wider text-outline uppercase">
          Live Preview
        </span>
        <div className="inline-flex rounded-lg bg-surface-container p-1 shadow-inner">
          {(["desktop", "phone"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={device === option}
              onClick={() => setDevice(option)}
              className={`rounded px-3 py-1 font-label-md text-label-md transition-colors ${
                device === option
                  ? "bg-surface-container-lowest font-semibold text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              }`}
            >
              {option === "desktop" ? "Desktop" : "Phone"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex h-[640px] w-[340px] max-w-full flex-col rounded-[36px] bg-surface-container-lowest p-3 shadow-2xl">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-surface">
          <div
            aria-hidden="true"
            className="flex h-6 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold text-outline"
          >
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <Icon name="signal_cellular_alt" className="text-[13px]" />
              <Icon name="wifi" className="text-[13px]" />
              <Icon name="battery_full" className="text-[13px]" />
            </span>
          </div>
          <div className="custom-scrollbar h-full overflow-x-hidden overflow-y-auto">
            {device === "phone" ? (
              <PublicSite view={view} initialNow={initialNow} />
            ) : (
              <div style={{ width: DESKTOP_WIDTH, zoom }}>
                <PublicSite view={view} initialNow={initialNow} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-body-sm text-body-sm text-outline">
        <Icon name="sync" className="text-[15px]" />
        <span>Updates as you type</span>
      </div>
    </aside>
  );
}
