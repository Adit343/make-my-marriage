"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logOut } from "@/components/auth/auth-api";
import {
  RELATIONSHIP_LABEL,
  ROLE_LABEL,
  WEDDING_STATUS_LABEL,
} from "@/components/dashboard/labels";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import type { Dashboard } from "@/modules/dashboard/dashboard.service";

type Viewer = Dashboard["viewer"];
type Workspace = NonNullable<Dashboard["workspace"]>;

/** Closes a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function TopBar({ viewer, workspace }: { viewer: Viewer; workspace: Workspace | null }) {
  const router = useRouter();
  const toast = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const notificationsRef = useDismiss(notificationsOpen, () => setNotificationsOpen(false));
  const profileRef = useDismiss(profileOpen, () => setProfileOpen(false));

  const subtitle = [
    workspace?.dateLabel ?? "Date not set",
    workspace?.locationLabel ?? "Location not set",
  ].join(" • ");
  const relationship = viewer.relationship ? RELATIONSHIP_LABEL[viewer.relationship] : null;

  async function signOut() {
    setSigningOut(true);
    try {
      await logOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      setSigningOut(false);
      toast({ type: "error", title: "Couldn't sign out", message: errorMessage(error) });
    }
  }

  return (
    <header className="relative z-30 flex h-20 shrink-0 items-center justify-between border-b border-[#2A2622]/[0.06] bg-surface/90 px-6 backdrop-blur-md md:px-12">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-headline-sm text-headline-sm font-medium tracking-tight text-primary">
            {workspace?.title ?? "Your wedding workspace"}
          </h2>
          {workspace ? (
            <span className="hidden items-center rounded bg-surface-container px-2 py-0.5 font-label-sm text-[11px] text-on-surface-variant sm:inline-flex">
              {WEDDING_STATUS_LABEL[workspace.status] ?? workspace.status}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="pin_drop" className="text-[15px] text-secondary" />
          {workspace ? subtitle : "Not created yet"}
        </p>
      </div>

      <div className="relative flex items-center gap-4">
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((value) => !value)}
            className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
          >
            <Icon name="notifications" />
          </button>
          {notificationsOpen ? (
            <div className="elevation-2 absolute right-0 z-50 mt-3 w-80 rounded-xl border border-[#2A2622]/[0.08] bg-surface-container-lowest p-4 sm:w-96">
              <div className="flex items-center justify-between border-b border-[#2A2622]/[0.06] pb-3">
                <span className="font-title text-body-sm font-semibold text-primary">
                  Alerts &amp; Updates
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Icon name="check_circle" className="text-primary" />
                <p className="font-title text-[13px] text-on-surface">You&apos;re all caught up</p>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  RSVPs, schedule changes and new tasks will show up here.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="h-6 w-px bg-[#2A2622]/[0.08]" />

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((value) => !value)}
            className="flex items-center gap-3 rounded-lg p-1.5 pl-1 text-left transition-colors hover:bg-surface-container/60 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2A2622]/[0.08] bg-[#E5DCD3] font-title text-body-md font-medium text-primary select-none">
              {viewer.initials}
            </div>
            <div className="hidden text-left sm:block">
              <div className="flex items-center gap-2">
                <span className="font-title text-body-sm text-on-surface">{viewer.name}</span>
                {viewer.role ? (
                  <span className="rounded-full border border-[#2A2622]/[0.08] bg-surface-container-high px-2 py-0.5 font-label-sm text-[10px] tracking-wider text-on-surface-variant uppercase">
                    {ROLE_LABEL[viewer.role]}
                  </span>
                ) : null}
              </div>
              {relationship ? (
                <p className="font-body-sm text-[12px] text-outline">{relationship}</p>
              ) : null}
            </div>
            <Icon
              name="expand_more"
              className={`text-[18px] text-on-surface-variant transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen ? (
            <div className="elevation-2 absolute right-0 z-50 mt-3 w-64 rounded-xl border border-[#2A2622]/[0.08] bg-surface-container-lowest py-2 shadow-lg">
              <div className="border-b border-[#2A2622]/[0.06] px-4 py-2">
                <p className="font-label-sm text-[11px] font-semibold tracking-wider text-outline uppercase">
                  Signed in as
                </p>
                <p className="font-title text-body-sm font-medium text-primary">
                  {viewer.name}
                  {viewer.role ? ` (${ROLE_LABEL[viewer.role]})` : ""}
                </p>
                <p className="truncate text-[12px] text-on-surface-variant">{viewer.email}</p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    toast({
                      type: "info",
                      title: "Account Settings is coming soon",
                      message: "Update your name, password and signed-in devices.",
                    });
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-body-sm text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <Icon name="settings" className="text-[17px] text-outline" />
                  <span>Account Settings</span>
                </button>
              </div>
              <div className="border-t border-[#2A2622]/[0.06] pt-1">
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-body-sm text-error transition-colors hover:bg-error-container/20 disabled:opacity-60"
                >
                  <Icon name="logout" className="text-[17px] text-error" />
                  <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
