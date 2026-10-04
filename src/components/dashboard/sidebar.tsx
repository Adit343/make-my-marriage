"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

// Left navigation shelf from the Stitch dashboard. Only the Dashboard exists so far; the other
// sections say so instead of leading to a 404.

const NAV: { label: string; icon: IconName; detail: string }[] = [
  {
    label: "Events",
    icon: "calendar_month",
    detail: "Plan Mehendi, Sangeet, the ceremony and more.",
  },
  { label: "Guests", icon: "group", detail: "Build one guest list for every function." },
  { label: "Tasks", icon: "checklist", detail: "Assign to-dos to family and your planner." },
  {
    label: "Vendors",
    icon: "storefront",
    detail: "Track the vendors you're considering or booked.",
  },
  { label: "Invitations", icon: "mail", detail: "Send digital invitations by email or WhatsApp." },
  { label: "Website", icon: "laptop_chromebook", detail: "Publish a simple site for your guests." },
  { label: "Gallery", icon: "photo_library", detail: "Collect everyone's photos in one place." },
  { label: "Live Stream", icon: "videocam", detail: "Share a stream link with remote guests." },
  { label: "Members", icon: "diversity_3", detail: "Invite family and manage roles." },
];

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors duration-150";

export function Sidebar({ pendingTasks }: { pendingTasks: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const comingSoon = (label: string, detail: string) =>
    toast({ type: "info", title: `${label} is coming soon`, message: detail });

  return (
    <aside className="z-40 flex w-full shrink-0 flex-col border-r border-[#2A2622]/[0.06] bg-surface-container-low select-none md:w-64">
      <div className="flex h-20 items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-container" />
          <span className="font-headline-sm text-headline-sm font-medium tracking-tight text-primary">
            Make My Marriage
          </span>
        </Link>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:text-primary md:hidden"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>

      <nav
        className={`custom-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-2 ${open ? "block" : "hidden"} md:block`}
      >
        <Link
          href="/dashboard"
          aria-current="page"
          className={`${ITEM} bg-primary-container font-medium text-on-primary shadow-xs`}
        >
          <Icon name="dashboard" className="text-[19px]" />
          <span className="font-title text-body-sm">Dashboard</span>
        </Link>
        {NAV.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => comingSoon(item.label, item.detail)}
            className={`${ITEM} text-on-surface-variant hover:bg-surface-container hover:text-primary`}
          >
            <Icon name={item.icon} className="text-[19px]" />
            <span className="font-body-sm text-body-sm">{item.label}</span>
            {item.label === "Tasks" && pendingTasks > 0 ? (
              <span className="ml-auto rounded bg-surface-container-high px-1.5 py-0.5 font-label-sm text-[10px] font-semibold text-on-surface-variant">
                {pendingTasks}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div
        className={`space-y-2 border-t border-[#2A2622]/[0.06] p-4 ${open ? "block" : "hidden"} md:block`}
      >
        <button
          type="button"
          onClick={() =>
            comingSoon("Account Settings", "Update your name, password and signed-in devices.")
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container/60 hover:text-primary"
        >
          <Icon name="settings" className="text-[18px]" />
          <span className="font-body-sm">Account Settings</span>
        </button>
        <button
          type="button"
          onClick={() =>
            comingSoon("Concierge Support", "Get help from the Make My Marriage team.")
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container/60 hover:text-primary"
        >
          <Icon name="support_agent" className="text-[18px]" />
          <span className="font-body-sm">Concierge Support</span>
        </button>
        <div className="px-3 pt-2">
          <div className="flex items-center gap-1.5 font-label-sm text-[11px] text-outline">
            <Icon name="lock" className="text-[13px]" />
            <span>End-to-End Encrypted Family Space</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
