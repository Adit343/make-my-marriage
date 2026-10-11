import { apiRequest, apiRequestWithMeta } from "@/lib/client/api-client";
import type {
  AgeCategory,
  DietaryPreference,
  GuestInviteStatus,
  GuestSide,
  RsvpStatus,
} from "@/lib/constants/enums";
import type { AddressInput } from "@/lib/validation/location";
import type { GuestDetailDto, GuestListItemDto, RsvpDto } from "@/modules/guests/guest.dto";
import type { GuestSummary } from "@/modules/guests/guest.service";
import type { GuestGroupDto } from "@/modules/guest-groups/guest-group.dto";

// Browser calls to the guests, groups and RSVP APIs (API Design §8).

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}`;

export interface GuestListQuery {
  search?: string;
  /** A group id, or "none" for ungrouped guests. */
  groupId?: string;
  side?: GuestSide;
  inviteStatus?: GuestInviteStatus;
  dietaryPreference?: DietaryPreference;
  eventId?: string;
  rsvpStatus?: RsvpStatus;
  cursor?: string;
  limit?: number;
}

export interface GuestPage {
  items: GuestListItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function fetchGuests(
  weddingId: string,
  query: GuestListQuery,
  signal?: AbortSignal,
): Promise<GuestPage> {
  const { data, meta } = await apiRequestWithMeta<GuestListItemDto[]>(
    `${base(weddingId)}/guests${queryString({ ...query })}`,
    { signal },
  );
  return {
    items: data,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
    hasMore: meta.hasMore === true,
  };
}

export function fetchGuestSummary(weddingId: string, eventId?: string, signal?: AbortSignal) {
  return apiRequest<GuestSummary>(`${base(weddingId)}/guests/summary${queryString({ eventId })}`, {
    signal,
  });
}

export function fetchGuest(weddingId: string, guestId: string) {
  return apiRequest<GuestDetailDto>(`${base(weddingId)}/guests/${guestId}`);
}

/** What the add/edit form sends. `null` clears an optional field. */
export interface GuestInput {
  name: string;
  groupId: string | null;
  email: string | null;
  phone: string | null;
  address: AddressInput | null;
  side: GuestSide;
  relationLabel: string | null;
  ageCategory: AgeCategory;
  plusOnesAllowed: number;
  dietaryPreference: DietaryPreference | null;
  notes: string | null;
  eventIds: string[];
}

export function createGuest(weddingId: string, input: GuestInput) {
  // The create endpoint takes absent optional fields rather than nulls for empty ones.
  const body = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null),
  ) as Partial<GuestInput>;
  return apiRequest<GuestDetailDto>(`${base(weddingId)}/guests`, { method: "POST", body });
}

export function updateGuest(
  weddingId: string,
  guestId: string,
  version: number,
  input: GuestInput,
) {
  return apiRequest<GuestDetailDto>(`${base(weddingId)}/guests/${guestId}`, {
    method: "PATCH",
    body: { version, ...input },
  });
}

export function deleteGuest(weddingId: string, guestId: string) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/guests/${guestId}`, { method: "DELETE" });
}

export function bulkDeleteGuests(weddingId: string, guestIds: string[]) {
  return apiRequest<{ affected: number }>(`${base(weddingId)}/guests/bulk`, {
    method: "POST",
    body: { action: "delete", guestIds },
  });
}

export function bulkSetGroup(weddingId: string, guestIds: string[], groupId: string | null) {
  return apiRequest<{ affected: number }>(`${base(weddingId)}/guests/bulk`, {
    method: "POST",
    body: { action: "set-group", guestIds, groupId },
  });
}

export function assignEvent(weddingId: string, guestId: string, eventId: string) {
  return apiRequest<RsvpDto>(`${base(weddingId)}/guests/${guestId}/rsvps`, {
    method: "POST",
    body: { eventId },
  });
}

export function removeFromEvent(weddingId: string, guestId: string, eventId: string) {
  return apiRequest<unknown>(`${base(weddingId)}/guests/${guestId}/rsvps/${eventId}`, {
    method: "DELETE",
  });
}

export function recordReply(
  weddingId: string,
  guestId: string,
  eventId: string,
  reply: { status: RsvpStatus; attendingCount?: number; note?: string | null },
) {
  return apiRequest<RsvpDto>(`${base(weddingId)}/guests/${guestId}/rsvps/${eventId}`, {
    method: "PATCH",
    body: reply,
  });
}

// ---- groups ----------------------------------------------------------------------------------

export function fetchGroups(weddingId: string) {
  return apiRequest<GuestGroupDto[]>(`${base(weddingId)}/guest-groups`);
}

export function createGroup(weddingId: string, input: { name: string; side: GuestSide }) {
  return apiRequest<GuestGroupDto>(`${base(weddingId)}/guest-groups`, {
    method: "POST",
    body: input,
  });
}

export function updateGroup(
  weddingId: string,
  groupId: string,
  version: number,
  changes: { name?: string; side?: GuestSide },
) {
  return apiRequest<GuestGroupDto>(`${base(weddingId)}/guest-groups/${groupId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteGroup(weddingId: string, groupId: string, reassignTo: string | null) {
  return apiRequest<{ guestsMoved: number }>(`${base(weddingId)}/guest-groups/${groupId}`, {
    method: "DELETE",
    body: { reassignTo },
  });
}
