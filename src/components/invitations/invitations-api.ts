import { apiRequest, apiRequestWithMeta } from "@/lib/client/api-client";
import type { EmailStatus, EmailType, InviteChannel } from "@/lib/constants/enums";
import type { SendKind } from "@/lib/invitations/messages";
import type { GuestLinkDto } from "@/modules/guest-invitations/guest-link.service";
import type { SendSummary } from "@/modules/guest-invitations/guest-invitation.service";
import type {
  EmailLogDto,
  EventReplies,
  InvitationsOverview,
} from "@/modules/guest-invitations/invitation-overview.service";

// Browser calls to the invitations APIs (API Design §8.6 to §8.9, §13).

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}`;

export function sendBatch(
  weddingId: string,
  input: { guestIds: string[]; channel: InviteChannel; kind: SendKind; batchId?: string },
) {
  return apiRequest<SendSummary>(`${base(weddingId)}/guests/invite-batch`, {
    method: "POST",
    body: input,
  });
}

/** One guest. For WhatsApp this is the member's tap: it records the guest as invited. */
export function sendOne(
  weddingId: string,
  guestId: string,
  input: { channel: InviteChannel; kind: SendKind },
) {
  return apiRequest<SendSummary>(`${base(weddingId)}/guests/${guestId}/invite`, {
    method: "POST",
    body: input,
  });
}

/** The guest's link, created if they had none. The same link every time. */
export function ensureGuestLink(weddingId: string, guestId: string) {
  return apiRequest<GuestLinkDto>(`${base(weddingId)}/guests/${guestId}/link`, { method: "POST" });
}

/** The guest's current link, or null if they have none yet. Never creates one. */
export function getGuestLink(weddingId: string, guestId: string) {
  return apiRequest<GuestLinkDto | null>(`${base(weddingId)}/guests/${guestId}/link`);
}

/** A brand-new link; the old one stops working at once. */
export function rotateGuestLink(weddingId: string, guestId: string) {
  return apiRequest<GuestLinkDto>(`${base(weddingId)}/guests/${guestId}/link/rotate`, {
    method: "POST",
  });
}

export function fetchOverview(weddingId: string, signal?: AbortSignal) {
  return apiRequest<InvitationsOverview>(`${base(weddingId)}/guest-invitations/overview`, {
    signal,
  });
}

export function fetchReplies(weddingId: string, eventId: string, signal?: AbortSignal) {
  return apiRequest<EventReplies>(`${base(weddingId)}/rsvps/replies?eventId=${eventId}`, {
    signal,
  });
}

export interface EmailLogQuery {
  status?: EmailStatus;
  type?: EmailType;
  batchId?: string;
  cursor?: string;
  limit?: number;
}

export interface EmailLogPage {
  items: EmailLogDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchEmailLogs(
  weddingId: string,
  query: EmailLogQuery,
  signal?: AbortSignal,
): Promise<EmailLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  const { data, meta } = await apiRequestWithMeta<EmailLogDto[]>(
    `${base(weddingId)}/email-logs${text ? `?${text}` : ""}`,
    { signal },
  );
  return {
    items: data,
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
    hasMore: meta.hasMore === true,
  };
}

export function retryEmailLog(weddingId: string, logId: string) {
  return apiRequest<SendSummary>(`${base(weddingId)}/email-logs/${logId}/retry`, {
    method: "POST",
  });
}
