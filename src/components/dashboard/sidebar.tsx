"use client";

import Link from "next/link";
import { ROLE_LABEL } from "@/components/dashboard/labels";
import { useShellNav } from "@/components/dashboard/shell-nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { MemberRole } from "@/lib/constants/enums";
import { BrandMark } from "@/components/ui/brand-mark";

// Left navigation shelf, as in the Stitch Team and Settings screens: Overview … Members, with
// Settings pinned at the bottom (showing the viewer's role when it is the active page).

export type NavSection =
  | "dashboard"
  | "events"
  | "guests"
  | "invitations"
  | "tasks"
  | "expenses"
  | "vendors"
  | "website"
  | "gallery"
  | "live"
  | "members"
  | "settings";

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
  {
    label: "Guests",
    icon: "group",
    detail: "Build one guest list for every function.",
    href: "/dashboard/guests",
    section: "guests",
  },
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
    href: "/dashboard/expenses",
    section: "expenses",
  },
  {
    label: "Vendors",
    icon: "storefront",
    detail: "Track the vendors you're considering or booked.",
    href: "/dashboard/vendors",
    section: "vendors",
  },
  {
    label: "Invitations",
    icon: "mark_email_unread",
    detail: "Send digital invitations by email or WhatsApp.",
    href: "/dashboard/invitations",
    section: "invitations",
  },
  {
    label: "Website",
    icon: "laptop_chromebook",
    detail: "Publish a simple site for your guests.",
    href: "/dashboard/website",
    section: "website",
  },
  {
    label: "Gallery",
    icon: "photo_library",
    detail: "Collect everyone's photos in one place.",
    href: "/dashboard/gallery",
    section: "gallery",
  },
  {
    label: "Live Stream",
    icon: "videocam",
    detail: "Share a stream link with remote guests.",
    href: "/dashboard/live",
    section: "live",
  },
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
  guestCount,
  pendingTasks,
  vendorCount,
  active,
  role,
}: {
  eventCount: number;
  guestCount: number;
  pendingTasks: number;
  /** Vendors in the directory; null for a member, who cannot see vendors. */
  vendorCount: number | null;
  active: NavSection;
  role: MemberRole | null;
}) {
  const toast = useToast();
  const { open, setOpen } = useShellNav();

  const comingSoon = (label: string, detail: string) =>
    toast({ type: "info", title: `${label} is coming soon`, message: detail });

  return (
    <>
      {/* Phones and small tablets: the menu slides in over the page, with a dimmed backdrop. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-[#2A2622]/35 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id="app-navigation"
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] shrink-0 flex-col border-r border-[#2A2622]/[0.06] bg-surface-container-low shadow-2xl transition-[transform,visibility] duration-200 select-none lg:static lg:z-40 lg:w-64 lg:translate-x-0 lg:shadow-none lg:visible ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#2A2622]/[0.05] px-5 sm:h-20">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-8 w-8 shrink-0 text-primary" />
            <span className="truncate font-headline-sm text-[20px] leading-7 font-medium tracking-tight text-primary">
              Make My Marriage
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="-mr-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:text-primary lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-5 lg:py-6">
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
                {item.label === "Guests" && guestCount > 0 ? (
                  <span
                    className={`ml-auto rounded px-1.5 py-0.5 font-label-sm text-[10px] font-semibold ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {guestCount}
                  </span>
                ) : null}
                {item.label === "Vendors" && vendorCount ? (
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 font-label-sm text-[10px] font-semibold ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {vendorCount}
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

        <div className="shrink-0 border-t border-[#2A2622]/[0.05] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
    </>
  );
}
