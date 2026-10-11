import type { Types } from "mongoose";
import type { StreamProvider, StreamStatus } from "@/lib/constants/enums";

// Member-facing stream shape (API Design §11). `inviteUrl` is the guest watch link /live/<token>,
// re-shown from the encrypted copy so the SAME link can be copied again (DB Design §5.3).

export interface StreamDto {
  id: string;
  eventId: string | null;
  eventName: string | null;
  provider: StreamProvider;
  streamUrl: string;
  title: string;
  description: string | null;
  startTime: string;
  /** The timezone the stream's time is shown in: its event's, else the wedding's. */
  timezone: string;
  status: StreamStatus;
  inviteUrl: string | null;
  version: number;
  createdAt: string;
}

interface StreamLike {
  _id: Types.ObjectId;
  eventId?: Types.ObjectId | null;
  provider: StreamProvider;
  streamUrl: string;
  title: string;
  description?: string | null;
  startTime: Date;
  status: StreamStatus;
  __v?: number;
  createdAt?: Date;
}

export function toStreamDto(
  stream: StreamLike,
  extra: { eventName: string | null; timezone: string; inviteUrl: string | null },
): StreamDto {
  return {
    id: stream._id.toString(),
    eventId: stream.eventId ? stream.eventId.toString() : null,
    eventName: extra.eventName,
    provider: stream.provider,
    streamUrl: stream.streamUrl,
    title: stream.title,
    description: stream.description ?? null,
    startTime: stream.startTime.toISOString(),
    timezone: extra.timezone,
    status: stream.status,
    inviteUrl: extra.inviteUrl,
    version: stream.__v ?? 0,
    createdAt: (stream.createdAt ?? new Date(0)).toISOString(),
  };
}
