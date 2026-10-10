"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EventDrawer, type DrawerMode } from "@/components/events/event-drawer";
import type { EventMenuItem } from "@/components/events/event-menu";
import { deleteEvent } from "@/components/events/events-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import type { EventView } from "@/lib/events/view";

/**
 * The add / edit / duplicate slide-over and the delete confirmation, shared by the timeline and
 * the event page. Render `overlays` once; call `openDrawer` / `requestDelete` from buttons.
 * `afterDelete` lets the event page leave itself; the timeline just refreshes.
 */
export function useEventActions({
  weddingId,
  weddingTimezone,
  afterDelete,
}: {
  weddingId: string;
  weddingTimezone: string;
  afterDelete?: () => void;
}): {
  openDrawer: (mode: DrawerMode) => void;
  requestDelete: (event: EventView) => void;
  /** The popover entries for one event; edit and delete only for people allowed to change it. */
  menuItems: (event: EventView) => EventMenuItem[];
  overlays: ReactNode;
} {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventView | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteEvent(weddingId, pendingDelete.id);
      toast({
        type: "success",
        title: "Event deleted",
        message: `${pendingDelete.name} was removed from your timeline.`,
      });
      setPendingDelete(null);
      setDeleting(false);
      if (afterDelete) afterDelete();
      else router.refresh();
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete the event", message: errorMessage(error) });
    }
  }

  const overlays = (
    <>
      {drawer ? (
        <EventDrawer
          weddingId={weddingId}
          weddingTimezone={weddingTimezone}
          mode={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            router.refresh();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this event?"
          confirmLabel="Delete event"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <strong className="font-semibold text-on-surface">{pendingDelete.name}</strong> will be
            removed from your timeline for everyone on your team.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );

  function menuItems(event: EventView): EventMenuItem[] {
    return [
      ...(event.canManage
        ? [
            {
              icon: "edit" as const,
              label: "Edit event",
              onSelect: () => setDrawer({ kind: "edit", event }),
            },
          ]
        : []),
      {
        icon: "group",
        label: "Manage guests",
        onSelect: () =>
          toast({
            type: "info",
            title: "Guest management is coming soon",
            message: "Build one guest list and invite people to each function.",
          }),
      },
      {
        icon: "content_copy",
        label: "Duplicate",
        onSelect: () => setDrawer({ kind: "duplicate", from: event }),
      },
      ...(event.canManage
        ? [
            {
              icon: "delete" as const,
              label: "Delete event",
              danger: true,
              onSelect: () => setPendingDelete(event),
            },
          ]
        : []),
    ];
  }

  return { openDrawer: setDrawer, requestDelete: setPendingDelete, menuItems, overlays };
}
