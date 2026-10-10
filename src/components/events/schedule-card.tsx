"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScheduleDrawer } from "@/components/events/schedule-drawer";
import { Icon } from "@/components/ui/icon";
import { timeZoneAbbreviation } from "@/lib/events/format";
import type { EventDetailView } from "@/lib/events/view";

/**
 * The event's run-of-show on its page. No Stitch design exists for it: built in the same card,
 * type and spacing language as the other cards on the Event Detail screen (owner approved,
 * 2026-10-10). Only people who may change the event see the edit button.
 */
export function ScheduleCard({ weddingId, event }: { weddingId: string; event: EventDetailView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const lines = event.scheduleLines;
  const zone = timeZoneAbbreviation(event.timezone, new Date(event.startsAt));

  return (
    <div className="rounded-xl border border-[#2A2622]/[0.04] bg-[#FFFDF9] p-6 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)] md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2622]/[0.05] pb-4">
        <div className="flex items-center gap-2.5">
          <Icon name="schedule" className="text-[20px] text-[#1F4D3D]" />
          <h2 className="font-headline-sm text-headline-sm font-normal text-[#2A2622]">Schedule</h2>
          {lines.length > 0 ? (
            <span className="rounded bg-[#1F4D3D]/10 px-2 py-0.5 text-[11px] font-medium text-[#1F4D3D]">
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
          ) : null}
        </div>
        {event.canManage ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-body-sm font-semibold text-[#1F4D3D] hover:underline"
          >
            <Icon name={lines.length > 0 ? "edit" : "add"} className="text-[16px]" />
            {lines.length > 0 ? "Edit schedule" : "Add schedule"}
          </button>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2A2622]/15 bg-surface-container-low px-6 py-8 text-center">
          <Icon name="schedule" className="text-outline" />
          <p className="font-title text-body-sm text-on-surface">No schedule yet</p>
          <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">
            Timed lines for the day, like 7:00 AM Makeup or 11:00 AM Family photos, show up here in
            order.
          </p>
        </div>
      ) : (
        <ol className="mt-2 divide-y divide-[#2A2622]/[0.05]">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start gap-4 py-3.5">
              <div className="w-24 shrink-0 pt-0.5">
                <div className="font-title text-body-sm font-semibold text-[#1F4D3D] tabular-nums">
                  {line.timeLabel}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-sm text-body-sm font-medium text-[#2A2622]">{line.title}</p>
                {line.notes ? (
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">{line.notes}</p>
                ) : null}
              </div>
              {line.isPublic ? (
                <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                  Public
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {lines.length > 0 ? (
        <p className="mt-2 border-t border-[#2A2622]/[0.05] pt-3 text-[12px] text-on-surface-variant">
          All times in {zone}.
        </p>
      ) : null}

      {editing ? (
        <ScheduleDrawer
          weddingId={weddingId}
          event={event}
          timeZoneLabel={zone}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
