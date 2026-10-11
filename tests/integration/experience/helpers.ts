/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { GET as publicLiveRoute } from "@/app/api/v1/public/live/[token]/route";
import { GET as publicSiteRoute } from "@/app/api/v1/public/websites/[slug]/route";
import { POST as rotateStreamRoute } from "@/app/api/v1/weddings/[weddingId]/livestreams/[streamId]/link/rotate/route";
import {
  DELETE as deleteStreamRoute,
  PATCH as patchStreamRoute,
} from "@/app/api/v1/weddings/[weddingId]/livestreams/[streamId]/route";
import {
  GET as listStreamsRoute,
  POST as createStreamRoute,
} from "@/app/api/v1/weddings/[weddingId]/livestreams/route";
import {
  DELETE as deleteEventRoute,
  PATCH as patchEventRoute,
} from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { POST as publishRoute } from "@/app/api/v1/weddings/[weddingId]/website/publish/route";
import {
  GET as getWebsiteRoute,
  PATCH as patchWebsiteRoute,
  POST as createWebsiteRoute,
} from "@/app/api/v1/weddings/[weddingId]/website/route";
import { GET as slugCheckRoute } from "@/app/api/v1/weddings/[weddingId]/website/slug-check/route";
import { POST as unpublishRoute } from "@/app/api/v1/weddings/[weddingId]/website/unpublish/route";
import {
  DELETE as deleteWeddingRoute,
  GET as getWeddingRoute,
  PATCH as patchWeddingRoute,
} from "@/app/api/v1/weddings/[weddingId]/route";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

export { createEvent } from "../invitations/helpers-events";

// Thin wrappers over the website and live stream route handlers, so each test reads as the request
// it makes.

export const getWebsite = (weddingId: string, who: TestMember) =>
  call(getWebsiteRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });

export const setUpWebsite = (weddingId: string, who: TestMember) =>
  call(createWebsiteRoute, { cookie: who.cookie, params: { weddingId } });

export const patchWebsite = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(patchWebsiteRoute, { method: "PATCH", cookie: who.cookie, params: { weddingId }, body });

export const publish = (weddingId: string, who: TestMember) =>
  call(publishRoute, { cookie: who.cookie, params: { weddingId } });

export const unpublish = (weddingId: string, who: TestMember) =>
  call(unpublishRoute, { cookie: who.cookie, params: { weddingId } });

export const slugCheck = (weddingId: string, who: TestMember, slug: string) =>
  call(slugCheckRoute, {
    method: "GET",
    path: `/api/test?slug=${encodeURIComponent(slug)}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const publicSite = (slug: string, ip?: string) =>
  call(publicSiteRoute, { method: "GET", params: { slug }, ip });

/** The site, set up and fetched: most tests start from a draft. */
export async function makeWebsite(weddingId: string, who: TestMember) {
  const result = await setUpWebsite(weddingId, who);
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as Record<string, any>;
}

/** Gives the wedding its couple, date and city so the site has something real to show. */
export async function describeWedding(weddingId: string, who: TestMember) {
  const current = await call(getWeddingRoute, {
    method: "GET",
    cookie: who.cookie,
    params: { weddingId },
  });
  const result = await call(patchWeddingRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId },
    body: {
      version: current.json.data.wedding.version,
      partners: [{ name: "Aarav" }, { name: "Diya" }],
      weddingDate: "2027-02-14",
      location: { address: { city: "Surat" } },
    },
  });
  if (result.status !== 200) throw new Error(JSON.stringify(result.json));
}

export const deleteWedding = (weddingId: string, who: TestMember, confirm: string) =>
  call(deleteWeddingRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId },
    body: { confirm },
  });

export const patchEvent = (
  weddingId: string,
  eventId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchEventRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, eventId },
    body,
  });

export const removeEvent = (weddingId: string, eventId: string, who: TestMember) =>
  call(deleteEventRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, eventId },
  });

// ---- Live streams ---------------------------------------------------------------------------

export const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
export const VIMEO_URL = "https://vimeo.com/76979871";

export const streamBody = (overrides: Record<string, unknown> = {}) => ({
  provider: "youtube",
  streamUrl: YOUTUBE_URL,
  title: "Wedding ceremony live",
  startTime: "2027-02-14T07:30:00Z",
  ...overrides,
});

export const listStreams = (weddingId: string, who: TestMember) =>
  call(listStreamsRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });

export const addStream = (
  weddingId: string,
  who: TestMember,
  overrides: Record<string, unknown> = {},
) =>
  call(createStreamRoute, {
    cookie: who.cookie,
    params: { weddingId },
    body: streamBody(overrides),
  });

export async function makeStream(
  weddingId: string,
  who: TestMember,
  overrides: Record<string, unknown> = {},
) {
  const result = await addStream(weddingId, who, overrides);
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as Record<string, any>;
}

export const patchStream = (
  weddingId: string,
  streamId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchStreamRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, streamId },
    body,
  });

export const removeStream = (weddingId: string, streamId: string, who: TestMember) =>
  call(deleteStreamRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, streamId },
  });

export const rotateStream = (weddingId: string, streamId: string, who: TestMember) =>
  call(rotateStreamRoute, { cookie: who.cookie, params: { weddingId, streamId } });

export const publicLive = (token: string, ip?: string) =>
  call(publicLiveRoute, { method: "GET", params: { token }, ip });

/** The token at the end of a "http://…/live/<token>" link. */
export const liveTokenOf = (inviteUrl: string) => inviteUrl.split("/live/")[1]!;
