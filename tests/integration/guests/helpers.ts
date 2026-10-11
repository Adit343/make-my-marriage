import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import {
  GET as listGroupsRoute,
  POST as createGroupRoute,
} from "@/app/api/v1/weddings/[weddingId]/guest-groups/route";
import {
  DELETE as deleteGroupRoute,
  PATCH as patchGroupRoute,
} from "@/app/api/v1/weddings/[weddingId]/guest-groups/[groupId]/route";
import { POST as bulkRoute } from "@/app/api/v1/weddings/[weddingId]/guests/bulk/route";
import {
  GET as listGuestsRoute,
  POST as createGuestRoute,
} from "@/app/api/v1/weddings/[weddingId]/guests/route";
import {
  DELETE as deleteGuestRoute,
  GET as getGuestRoute,
  PATCH as patchGuestRoute,
} from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/route";
import {
  GET as listRsvpsRoute,
  POST as assignRoute,
} from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/rsvps/route";
import {
  DELETE as unassignRoute,
  PATCH as recordRoute,
} from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/rsvps/[eventId]/route";
import { GET as summaryRoute } from "@/app/api/v1/weddings/[weddingId]/guests/summary/route";
import { GET as headcountRoute } from "@/app/api/v1/weddings/[weddingId]/rsvps/route";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

// Thin wrappers over the route handlers so each test reads as the request it makes.

export async function makeEvent(weddingId: string, who: TestMember, name = "Haldi") {
  const result = await call(createEvent, {
    cookie: who.cookie,
    params: { weddingId },
    body: { name, type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data.id as string;
}

export const createGroup = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(createGroupRoute, { cookie: who.cookie, params: { weddingId }, body });

export const listGroups = (weddingId: string, who: TestMember) =>
  call(listGroupsRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });

export const patchGroup = (
  weddingId: string,
  groupId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchGroupRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, groupId },
    body,
  });

export const deleteGroup = (
  weddingId: string,
  groupId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(deleteGroupRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, groupId },
    body,
  });

export const createGuest = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(createGuestRoute, { cookie: who.cookie, params: { weddingId }, body });

export async function makeGuest(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
) {
  const result = await createGuest(weddingId, who, {
    name: "Rahul Sharma",
    side: "partnerOne",
    ...body,
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number } & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const listGuests = (weddingId: string, who: TestMember, query = "") =>
  call(listGuestsRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const getGuest = (weddingId: string, guestId: string, who: TestMember) =>
  call(getGuestRoute, { method: "GET", cookie: who.cookie, params: { weddingId, guestId } });

export const patchGuest = (
  weddingId: string,
  guestId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchGuestRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, guestId },
    body,
  });

export const deleteGuest = (weddingId: string, guestId: string, who: TestMember) =>
  call(deleteGuestRoute, { method: "DELETE", cookie: who.cookie, params: { weddingId, guestId } });

export const bulk = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(bulkRoute, { cookie: who.cookie, params: { weddingId }, body });

export const assign = (weddingId: string, guestId: string, who: TestMember, eventId: string) =>
  call(assignRoute, { cookie: who.cookie, params: { weddingId, guestId }, body: { eventId } });

export const listGuestRsvps = (weddingId: string, guestId: string, who: TestMember) =>
  call(listRsvpsRoute, { method: "GET", cookie: who.cookie, params: { weddingId, guestId } });

export const unassign = (weddingId: string, guestId: string, eventId: string, who: TestMember) =>
  call(unassignRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, guestId, eventId },
  });

export const record = (
  weddingId: string,
  guestId: string,
  eventId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(recordRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, guestId, eventId },
    body,
  });

export const summary = (weddingId: string, who: TestMember, query = "") =>
  call(summaryRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const headcount = (weddingId: string, who: TestMember, query = "") =>
  call(headcountRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });
