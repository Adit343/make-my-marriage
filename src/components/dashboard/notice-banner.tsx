"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Dismissible notice from the dashboard design. Dismissal is remembered per notice in this
 * browser only (a convenience, not shared state), so a new notice shows up again.
 */
export function NoticeBanner({
  noticeId,
  children,
}: {
  noticeId: string;
  children: React.ReactNode;
}) {
  const storageKey = `mmm:notice-dismissed:${noticeId}`;
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      // Reading storage must wait for the browser; the banner renders visible on the server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(storageKey)) setVisible(false);
    } catch {
      // Storage can be unavailable (private mode); keep the banner.
    }
  }, [storageKey]);

  function dismiss() {
    setLeaving(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore: it just shows again next time.
    }
    setTimeout(() => setVisible(false), 400);
  }

  if (!visible) return null;

  return (
    <section
      className={`elevation-1 flex max-h-40 items-start justify-between gap-4 overflow-hidden rounded-xl border border-primary/10 bg-[#F1F7F4] p-4 transition-all duration-300 md:items-center md:p-5 ${leaving ? "scale-[0.98] opacity-0" : ""}`}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary">
          <Icon name="info" className="text-[18px]" />
        </div>
        <p className="font-body-md text-body-md text-primary">{children}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notice"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-black/[0.04] hover:text-primary focus:outline-hidden"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
    </section>
  );
}
