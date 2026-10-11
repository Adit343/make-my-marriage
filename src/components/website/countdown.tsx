"use client";

import { useEffect, useState } from "react";

// The restrained countdown from the Stitch public site: serif number blocks for days, hours,
// minutes and seconds. The first render uses `initialNow` (the server's clock) so the server and
// browser render the same numbers; it then ticks once a second in the browser.

function parts(target: number, now: number) {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  return {
    done: total <= 0,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const two = (value: number) => String(value).padStart(2, "0");

export function Countdown({
  target,
  initialNow,
  compact = false,
}: {
  /** ISO instant the countdown runs to. */
  target: string;
  /** ISO instant of the server's clock when the page was built. */
  initialNow: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date(initialNow).getTime());

  useEffect(() => {
    // Catch up to the browser's real clock at once, then tick.
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = parts(new Date(target).getTime(), now);
  if (left.done) return null;

  const blocks: [string, string][] = [
    [String(left.days), "Days"],
    [two(left.hours), "Hours"],
    [two(left.minutes), "Minutes"],
    [two(left.seconds), "Seconds"],
  ];

  return (
    <div
      role="timer"
      aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes to go`}
      className={`flex items-center justify-center rounded-lg border border-[#2A2622]/5 bg-[#FFFDF9] shadow-sm ${
        compact ? "gap-2 px-3 py-3" : "gap-1 px-3 py-3 @3xl:gap-8 @3xl:px-10 @3xl:py-6"
      }`}
    >
      {blocks.map(([value, label], index) => (
        <div key={label} className="flex items-center gap-1 @3xl:gap-8">
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="-mt-4 font-headline-sm text-2xl font-light text-[#686F6A]/40"
            >
              :
            </span>
          ) : null}
          <div className="flex min-w-9 flex-col items-center @3xl:min-w-10">
            <span
              className={`font-headline-md leading-tight font-light text-(--site-accent) tabular-nums ${
                compact ? "text-[24px]" : "text-[22px] @3xl:text-[40px]"
              }`}
            >
              {value}
            </span>
            <span className="mt-1 font-label-sm text-[10px] tracking-widest text-[#686F6A] uppercase">
              <span className="@3xl:hidden">
                {label.slice(0, 4) === "Minu"
                  ? "Mins"
                  : label.slice(0, 4) === "Seco"
                    ? "Secs"
                    : label}
              </span>
              <span className="hidden @3xl:inline">{label}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
