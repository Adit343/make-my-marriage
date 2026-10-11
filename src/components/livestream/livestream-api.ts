import { apiRequest } from "@/lib/client/api-client";
import type { StreamProvider, StreamStatus } from "@/lib/constants/enums";
import type { StreamDto } from "@/modules/livestream/stream.dto";
import type { PublicLive } from "@/modules/livestream/stream.service";

// Browser calls to the live streams API (API Design §11).

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}/livestreams`;

export interface StreamInput {
  eventId: string | null;
  provider: StreamProvider;
  streamUrl: string;
  title: string;
  description: string | null;
  /** An ISO instant. */
  startTime: string;
  status: StreamStatus;
}

export function createStream(weddingId: string, input: StreamInput) {
  // The create endpoint takes an absent description rather than null.
  const { description, ...rest } = input;
  return apiRequest<StreamDto>(base(weddingId), {
    method: "POST",
    body: { ...rest, ...(description ? { description } : {}) },
  });
}

export function updateStream(
  weddingId: string,
  streamId: string,
  version: number,
  changes: Partial<StreamInput>,
) {
  return apiRequest<StreamDto>(`${base(weddingId)}/${streamId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteStream(weddingId: string, streamId: string) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/${streamId}`, { method: "DELETE" });
}

export function rotateStreamLink(weddingId: string, streamId: string) {
  return apiRequest<StreamDto>(`${base(weddingId)}/${streamId}/link/rotate`, { method: "POST" });
}

/** The public watch page's data, polled by the guest page while it waits for the stream to start. */
export function fetchLiveStatus(token: string, signal?: AbortSignal) {
  return apiRequest<PublicLive>(`/api/v1/public/live/${encodeURIComponent(token)}`, { signal });
}
