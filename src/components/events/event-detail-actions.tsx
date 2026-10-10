"use client";

import { useRouter } from "next/navigation";
import { EventMenu } from "@/components/events/event-menu";
import { useEventActions } from "@/components/events/use-event-actions";
import { Icon } from "@/components/ui/icon";
import type { EventDetailView } from "@/lib/events/view";

/** The Edit button and "more" menu in the header of the event page. */
export function EventDetailActions({
  weddingId,
  weddingTimezone,
  event,
}: {
  weddingId: string;
  weddingTimezone: string;
  event: EventDetailView;
}) {
  const router = useRouter();
  const actions = useEventActions({
    weddingId,
    weddingTimezone,
    afterDelete: () => router.push("/dashboard/events"),
  });

  return (
    <div className="flex items-center gap-2.5">
      {event.canManage ? (
        <button
          type="button"
          onClick={() => actions.openDrawer({ kind: "edit", event })}
          className="flex items-center gap-1.5 rounded-lg border border-[#D9D1C7] bg-[#FFFDF9] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] shadow-sm transition-all hover:border-[#B5714A]/40 hover:bg-[#F4EFEA]"
        >
          <Icon name="edit" className="text-[18px]" />
          <span>Edit</span>
        </button>
      ) : null}
      <EventMenu eventName={event.name} items={actions.menuItems(event)} trigger="horizontal" />
      {actions.overlays}
    </div>
  );
}
