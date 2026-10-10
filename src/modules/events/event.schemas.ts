import { z } from "zod";
import { EVENT_TYPES } from "@/lib/constants/enums";
import { MAX_SCHEDULE_ITEMS, SCHEDULE_TIME_PATTERN } from "@/lib/constants/events";
import { locationInput } from "@/lib/validation/location";
import { objectId, timezone } from "@/lib/validation/primitives";

// API Design §7.1. Instants arrive as ISO 8601 with an offset ("2027-02-13T10:00:00+05:30" or Z)
// and become Dates; the event's `timezone` says how to display them.

export const eventParams = z.object({ weddingId: objectId, eventId: objectId });

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const scheduleItem = z.strictObject({
  /** Present when keeping an existing line (so its id stays stable); omit for a new one. */
  id: objectId.optional(),
  time: z.string().regex(SCHEDULE_TIME_PATTERN, "Use 24-hour HH:mm, e.g. 07:00"),
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional(),
});

/** The whole schedule is replaced on each save: it is a small, bounded list. */
const schedule = z
  .array(scheduleItem)
  .max(MAX_SCHEDULE_ITEMS)
  .refine(
    (items) => {
      const ids = items.flatMap((item) => (item.id ? [item.id.toLowerCase()] : []));
      return new Set(ids).size === ids.length;
    },
    { message: "Schedule item ids must be unique" },
  );

const endsAfterStart = {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
};

export const createEventBody = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    type: z.enum(EVENT_TYPES),
    startsAt: instant,
    endsAt: instant.nullable().optional(),
    /** Defaults to the wedding's timezone. */
    timezone: timezone.optional(),
    location: locationInput.optional(),
    description: z.string().trim().max(2000).optional(),
    dressCode: z.string().trim().max(200).optional(),
    sortOrder: z.number().int().min(-1000).max(1000).optional(),
    isPublic: z.boolean().optional(),
    schedule: schedule.optional(),
  })
  .refine((body) => !body.endsAt || body.endsAt > body.startsAt, endsAfterStart);

export type CreateEventInput = z.infer<typeof createEventBody>;

// Any subset of the editable fields plus the `version` the client last read (decision C5), so a
// stale write is rejected with 409 VERSION_CONFLICT. Optional text can be cleared with null.
export const updateEventBody = z
  .strictObject({
    version: z.number().int().min(0),
    name: z.string().trim().min(1).max(120),
    type: z.enum(EVENT_TYPES),
    startsAt: instant,
    endsAt: instant.nullable(),
    timezone,
    location: locationInput.nullable(),
    description: z.string().trim().max(2000).nullable(),
    dressCode: z.string().trim().max(200).nullable(),
    sortOrder: z.number().int().min(-1000).max(1000),
    isPublic: z.boolean(),
    schedule,
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" })
  // Only checkable here when both arrive together; the service checks the rest against the stored event.
  .refine((body) => !body.startsAt || !body.endsAt || body.endsAt > body.startsAt, endsAfterStart);

export type UpdateEventInput = z.infer<typeof updateEventBody>;
