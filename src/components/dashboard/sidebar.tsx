"use client";

import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/components/dashboard/labels";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { MemberRole } from "@/lib/constants/enums";

// Left navigation shelf, as in the Stitch Team and Settings screens: Overview … Members, with
// Settings pinned at the bottom (showing the viewer's role when it is the active page). Only
// Overview, Events, Tasks, Members and Settings are built so far; the other sections say so instead of leading
// to a 404.

export type NavSection = "dashboard" | "events" | "tasks" | "members" | "settings";

interface NavItem {
  label: string;
  icon: IconName;
  detail: string;
  href?: string;
  section?: NavSection;
}

const NAV: NavItem[] = [
  { label: "Overview", icon: "dashboard", detail: "", href: "/dashboard", section: "dashboard" },
  {
    label: "Events",
    icon: "calendar_month",
    detail: "Plan Mehendi, Sangeet, the ceremony and more.",
    href: "/dashboard/events",
    section: "events",
  },
  { label: "Guests", icon: "group", detail: "Build one guest list for every function." },
  {
    label: "Tasks",
    icon: "checklist",
    detail: "Assign to-dos to family and your planner.",
    href: "/dashboard/tasks",
    section: "tasks",
  },
  {
    label: "Expenses",
    icon: "account_balance_wallet",
    detail: "Track what you spend, by category and event.",
  },
  {
    label: "Vendors",
    icon: "storefront",
    detail: "Track the vendors you're considering or booked.",
  },
  { label: "Invitations", icon: "mail", detail: "Send digital invitations by email or WhatsApp." },
  { label: "Website", icon: "laptop_chromebook", detail: "Publish a simple site for your guests." },
  { label: "Gallery", icon: "photo_library", detail: "Collect everyone's photos in one place." },
  { label: "Live Stream", icon: "videocam", detail: "Share a stream link with remote guests." },
  {
    label: "Members",
    icon: "badge",
    detail: "Invite family and manage roles.",
    href: "/dashboard/team",
    section: "members",
  },
];

const ITEM =
  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150";
const ACTIVE = "bg-primary-fixed/40 font-semibold text-primary";
const IDLE = "text-on-surface-variant hover:bg-surface-container hover:text-primary";

function ActiveBar() {
  return <span className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r bg-primary" />;
}

export function Sidebar({
  eventCount,
  pendingTasks,
  active,
  role,
}: {
  eventCount: number;
  pendingTasks: number;
  active: NavSection;
  role: MemberRole | null;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const comingSoon = (label: string, detail: string) =>
    toast({ type: "info", title: `${label} is coming soon`, message: detail });

  return (
    <aside className="z-40 flex w-full shrink-0 flex-col border-r border-[#2A2622]/[0.06] bg-surface-container-low select-none md:w-64">
      <div className="flex h-20 items-center justify-between border-b border-[#2A2622]/[0.05] px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
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
        className={`custom-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-6 ${open ? "block" : "hidden"} md:block`}
      >
        {NAV.map((item) => {
          const isActive = item.section === active;
          const content = (
            <>
              {isActive ? <ActiveBar /> : null}
              <Icon name={item.icon} className="text-[19px]" />
              <span className="font-body-sm text-body-sm">{item.label}</span>
              {item.label === "Events" && eventCount > 0 ? (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 font-label-sm text-[10px] font-semibold text-on-primary">
                  {eventCount}
                </span>
              ) : null}
              {item.label === "Tasks" && pendingTasks > 0 ? (
                <span className="ml-auto rounded bg-surface-container-high px-1.5 py-0.5 font-label-sm text-[10px] font-semibold text-on-surface-variant">
                  {pendingTasks}
                </span>
              ) : null}
            </>
          );
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`${ITEM} ${isActive ? ACTIVE : IDLE}`}
            >
              {content}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={() => comingSoon(item.label, item.detail)}
              className={`${ITEM} ${IDLE}`}
            >
              {content}
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-[#2A2622]/[0.05] p-4 ${open ? "block" : "hidden"} md:block`}>
        <Link
          href="/dashboard/settings"
          aria-current={active === "settings" ? "page" : undefined}
          className={`${ITEM} ${active === "settings" ? "bg-[#EBF2EE] font-medium text-[#1F4D3D]" : IDLE}`}
        >
          {active === "settings" ? <ActiveBar /> : null}
          <Icon name="settings" className="text-[20px]" />
          <span className="font-body-sm text-body-sm">Settings</span>
          {active === "settings" && role ? (
            <span className="ml-auto rounded bg-[#1F4D3D]/10 px-1.5 py-0.5 font-label-md text-[11px] font-semibold tracking-wide text-[#1F4D3D] uppercase">
              {ROLE_LABEL[role]}
            </span>
          ) : null}
        </Link>
      </div>
    </aside>
  );
}
