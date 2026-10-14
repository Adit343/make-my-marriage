"use client";

import { useState } from "react";
import { joinDateTime, splitDateTime } from "@/lib/calendar";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";

/**
 * A moment as two linked pickers, a date and a time, side by side (stacked on a very narrow
 * screen). The value is "YYYY-MM-DDTHH:mm", the same wall-clock string the forms already keep.
 * Picking a date alone gives it `defaultTime`; a time chosen before any date is remembered until
 * a date arrives.
 */
export function DateTimeField({
  id,
  value,
  onChange,
  defaultTime = "09:00",
  clearable = false,
  disabled,
  invalid,
  describedBy,
  size = "md",
  title = "Choose a date",
  timeLabel = "Time",
  className = "",
}: {
  /** Id of the date control (a <label for> can point at it); the time control gets `${id}-time`. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  defaultTime?: string;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  size?: "md" | "sm";
  title?: string;
  timeLabel?: string;
  className?: string;
}) {
  const { date, time } = splitDateTime(value);
  const [pendingTime, setPendingTime] = useState("");
  const shownTime = time || pendingTime;

  return (
    <div
      className={`grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] ${className}`}
    >
      <DateField
        id={id}
        value={date}
        clearable={clearable}
        disabled={disabled}
        invalid={invalid}
        describedBy={describedBy}
        size={size}
        title={title}
        onChange={(nextDate) => {
          if (!nextDate) {
            setPendingTime(time);
            onChange("");
            return;
          }
          onChange(joinDateTime(nextDate, shownTime || defaultTime));
        }}
      />
      <TimeField
        id={`${id}-time`}
        value={shownTime}
        defaultTime={defaultTime}
        disabled={disabled}
        invalid={invalid}
        size={size}
        ariaLabel={timeLabel}
        title="Choose a time"
        onChange={(nextTime) => {
          if (date) onChange(joinDateTime(date, nextTime));
          else setPendingTime(nextTime);
        }}
      />
    </div>
  );
}
