import "server-only";
import { Types } from "mongoose";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatClock, formatLongDate, timeZoneAbbreviation } from "@/lib/events/format";
import { checkStreamUrl, PROVIDER_LABEL } from "@/lib/livestream/provider";
import { zoneLabel } from "@/lib/livestream/view";
import type { StreamProvider, StreamStatus } from "@/lib/constants/enums";
import { findEvent, listEvents as listEventRows } from "@/modules/events/event.repository";
import { toStreamDto, type StreamDto } from "@/modules/livestream/stream.dto";
import {
  findStream,
  findStreamByTokenHash,
  insertStream,
  listStreams as listStreamRows,
  setStreamLink,
  softDeleteStream,
  updateStream as updateStreamRow,
  type StoredStreamLink,
  type StreamChanges,
} from "@/modules/livestream/stream.repository";
import type { CreateStreamInput, UpdateStreamInput } from "@/modules/livestream/stream.schemas";
import type { WeddingAuth } from "@/modules/members/guards";
import { coupleNamesOf } from "@/modules/website/website.service";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Live streams (API Design §11, DB Design §6.16). The video plays on YouTube or Vimeo; this app
// keeps the link, the schedule, a status a member sets by hand, and a private watch page at
// /live/<token>. The token protects THAT PAGE, not the video itself: a guest who copies the
// YouTube address can still share it (state this in the UI).

type StreamRow = NonNullable<Awaited<ReturnType<typeof findStream>>>;

// ---------------------------------------------------------------------------------------------
// The guest's watch link: hash for lookup, AES-256-GCM copy so the SAME link can be shown again.
// ---------------------------------------------------------------------------------------------

function encryptionKey(): string {
  const env = getEnv();
  return env.TOKEN_ENCRYPTION_KEY ?? env.SESSION_SECRET;
}

export function liveUrlFor(token: string): string {
  return new URL(`/live/${token}`, getEnv().APP_URL).toString();
}

function freshLink(): { token: string; stored: StoredStreamLink } {
  const token = generateToken();
  return {
    token,
    stored: {
      tokenHash: hashToken(token),
      tokenEnc: encryptSecret(token, encryptionKey()),
      createdAt: new Date(),
      expiresAt: null,
      revokedAt: null,
    },
  };
}

function isUsable(link: StreamRow["link"], now = new Date()): boolean {
  if (!link || link.revokedAt) return false;
  return !link.expiresAt || link.expiresAt.getTime() > now.getTime();
}

/** The link as a URL, or null if there is none or it can no longer be decrypted. */
function inviteUrlOf(stream: StreamRow): string | null {
  if (!isUsable(stream.link) || !stream.link?.tokenEnc) return null;
  const token = decryptSecret(stream.link.tokenEnc, encryptionKey());
  return token ? liveUrlFor(token) : null;
}

// ---------------------------------------------------------------------------------------------
// Member side
// ---------------------------------------------------------------------------------------------

async function context(weddingId: string) {
  const [wedding, events] = await Promise.all([findWedding(weddingId), listEventRows(weddingId)]);
  return {
    timezone: wedding?.timezone ?? "Asia/Kolkata",
    events: new Map(events.map((event) => [event._id.toString(), event])),
  };
}

function present(
  stream: StreamRow,
  ctx: Awaited<ReturnType<typeof context>>,
  inviteUrl = inviteUrlOf(stream),
): StreamDto {
  const event = stream.eventId ? ctx.events.get(stream.eventId.toString()) : undefined;
  return toStreamDto(stream, {
    eventName: event?.name ?? null,
    timezone: event?.timezone ?? ctx.timezone,
    inviteUrl,
  });
}

export async function listStreams(auth: WeddingAuth): Promise<StreamDto[]> {
  const [rows, ctx] = await Promise.all([listStreamRows(auth.weddingId), context(auth.weddingId)]);
  return rows.map((row) => present(row, ctx));
}

/** A linked event must belong to this wedding; a stranger's id is the same 404 as a missing one. */
async function requireEvent(weddingId: string, eventId: string): Promise<Types.ObjectId> {
  const event = await findEvent(weddingId, eventId);
  if (!event) throw new AppError("NOT_FOUND");
  return event._id;
}

function validUrl(provider: StreamProvider, raw: string): string {
  const check = checkStreamUrl(provider, raw);
  if (!check.ok) {
    throw new AppError("VALIDATION_ERROR", {
      message: check.message,
      details: [{ path: "streamUrl", message: check.message }],
    });
  }
  return check.url;
}

export async function createStream(
  auth: WeddingAuth,
  input: CreateStreamInput,
): Promise<StreamDto> {
  const eventId = input.eventId ? await requireEvent(auth.weddingId, input.eventId) : null;
  const { token, stored } = freshLink();
  const row = await insertStream(auth.weddingId, {
    eventId,
    provider: input.provider,
    streamUrl: validUrl(input.provider, input.streamUrl),
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    startTime: input.startTime,
    status: input.status ?? "scheduled",
    link: stored,
    createdBy: auth.userId,
  });
  const ctx = await context(auth.weddingId);
  return present(row as unknown as StreamRow, ctx, liveUrlFor(token));
}

export async function updateStream(
  auth: WeddingAuth,
  streamId: string,
  input: UpdateStreamInput,
): Promise<StreamDto> {
  const { version, eventId, ...rest } = input;
  const changes: StreamChanges = { ...rest };

  if (eventId !== undefined) {
    changes.eventId = eventId === null ? null : await requireEvent(auth.weddingId, eventId);
  }
  if (rest.provider !== undefined || rest.streamUrl !== undefined) {
    // The platform and the address must still agree after the change.
    const existing = await findStream(auth.weddingId, streamId);
    if (!existing) throw new AppError("NOT_FOUND");
    const provider = rest.provider ?? existing.provider;
    changes.streamUrl = validUrl(provider, rest.streamUrl ?? existing.streamUrl);
  }

  const result = await updateStreamRow(auth.weddingId, streamId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return present(result, await context(auth.weddingId));
}

/** Soft delete. The guest link stops working at once: a deleted stream is never found by token. */
export async function deleteStream(auth: WeddingAuth, streamId: string) {
  const at = new Date();
  if (!(await softDeleteStream(auth.weddingId, streamId, { by: auth.userId, at }))) {
    throw new AppError("NOT_FOUND");
  }
  return { id: streamId, deletedAt: at.toISOString() };
}

/** A brand-new watch link; the old one stops working immediately (for a link that may have leaked). */
export async function rotateStreamLink(auth: WeddingAuth, streamId: string): Promise<StreamDto> {
  const { token, stored } = freshLink();
  const row = await setStreamLink(auth.weddingId, streamId, stored);
  if (!row) throw new AppError("NOT_FOUND");
  return present(row, await context(auth.weddingId), liveUrlFor(token));
}

// ---------------------------------------------------------------------------------------------
// Guest side
// ---------------------------------------------------------------------------------------------

export interface PublicLive {
  coupleNames: string;
  title: string;
  description: string | null;
  startTime: string;
  /** "Sunday, 14 February 2027" and "1:00 PM IST", in the stream's own timezone. */
  dateLabel: string;
  timeLabel: string;
  /** "IST (UTC+5:30)" */
  zoneLabel: string;
  status: StreamStatus;
  provider: StreamProvider;
  providerLabel: string;
  /**
   * The video address and its embeddable player, only while the stream is LIVE: before it starts
   * there is nothing to watch, and afterwards nothing to hand out.
   */
  watchUrl: string | null;
  embedUrl: string | null;
}

/** One answer for every way a link can be unusable: unknown, replaced, stream or wedding deleted. */
function invalidLink(): AppError {
  return new AppError("INVALID_TOKEN");
}

/**
 * The guest watch page's data (API Design §11). No account: the link is the credential, and the
 * answer is a hand-built whitelist (DB Design §11.2): title, description, time, status, provider
 * and, once live, the video address.
 */
export async function getPublicLive(token: string): Promise<PublicLive> {
  const stream = await findStreamByTokenHash(hashToken(token));
  if (!stream?.link || !isUsable(stream.link as StreamRow["link"])) throw invalidLink();
  // A deleted wedding hides everything under it, public links included (DB Design §10.3).
  const wedding = await findWedding(stream.weddingId);
  if (!wedding) throw invalidLink();

  let timezone = wedding.timezone;
  if (stream.eventId) {
    const event = await findEvent(stream.weddingId, stream.eventId);
    if (event) timezone = event.timezone;
  }

  const live = stream.status === "live";
  const check = live ? checkStreamUrl(stream.provider, stream.streamUrl) : null;
  return {
    coupleNames: coupleNamesOf(wedding),
    title: stream.title,
    description: stream.description ?? null,
    startTime: stream.startTime.toISOString(),
    dateLabel: formatLongDate(stream.startTime, timezone),
    timeLabel: `${formatClock(stream.startTime, timezone, false)} ${timeZoneAbbreviation(timezone, stream.startTime)}`,
    zoneLabel: zoneLabel(timezone, stream.startTime),
    status: stream.status,
    provider: stream.provider,
    providerLabel: PROVIDER_LABEL[stream.provider],
    watchUrl: live ? stream.streamUrl : null,
    embedUrl: check?.ok ? check.embedUrl : null,
  };
}
