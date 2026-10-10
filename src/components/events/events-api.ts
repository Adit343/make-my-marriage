import { apiRequest } from "@/lib/client/api-client";
import type { EventType } from "@/lib/constants/enums";

// Browser calls to the events API (API Design §7.1).

const events = (weddingId: string) => `/api/v1/weddings/${weddingId}/events`;

export interface EventLocation {
  label?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  coordinates?: { latitude: number; longitude: number };
  placeId?: string;
}

export interface EventInput {
  name: string;
  type: EventType;
  /** ISO 8601 instants. */
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  location: EventLocation | null;
  dressCode: string | null;
  description: string | null;
  isPublic: boolean;
}

export interface ScheduleItemInput {
  time: string;
  title: string;
  notes?: string;
  isPublic?: boolean;
}

export function createEvent(
  weddingId: string,
  input: EventInput & { schedule?: ScheduleItemInput[] },
) {
  // The create endpoint takes absent fields rather than nulls.
  const { endsAt, location, dressCode, description, ...rest } = input;
  return apiRequest<{ id: string }>(events(weddingId), {
    method: "POST",
    body: {
      ...rest,
      ...(endsAt ? { endsAt } : {}),
      ...(location ? { location } : {}),
      ...(dressCode ? { dressCode } : {}),
      ...(description ? { description } : {}),
    },
  });
}

export function updateEvent(
  weddingId: string,
  eventId: string,
  version: number,
  input: EventInput,
) {
  return apiRequest<{ id: string }>(`${events(weddingId)}/${eventId}`, {
    method: "PATCH",
    body: { version, ...input },
  });
}

export function deleteEvent(weddingId: string, eventId: string) {
  return apiRequest<unknown>(`${events(weddingId)}/${eventId}`, { method: "DELETE" });
}

/** Replaces an event's whole schedule; a line keeps its id by sending it back. */
export function updateSchedule(
  weddingId: string,
  eventId: string,
  version: number,
  schedule: (ScheduleItemInput & { id?: string })[],
) {
  return apiRequest<{ id: string }>(`${events(weddingId)}/${eventId}`, {
    method: "PATCH",
    body: { version, schedule },
  });
}
