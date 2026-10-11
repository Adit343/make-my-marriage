import { setEmailProviderForTests, EmailProviderError } from "@/infrastructure/email";
import type { EmailMessage } from "@/infrastructure/email";
import { GET as overviewRoute } from "@/app/api/v1/weddings/[weddingId]/guest-invitations/overview/route";
import { GET as listLogsRoute } from "@/app/api/v1/weddings/[weddingId]/email-logs/route";
import { POST as retryLogRoute } from "@/app/api/v1/weddings/[weddingId]/email-logs/[logId]/retry/route";
import { POST as inviteBatchRoute } from "@/app/api/v1/weddings/[weddingId]/guests/invite-batch/route";
import { POST as inviteRoute } from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/invite/route";
import {
  GET as getLinkRoute,
  POST as createLinkRoute,
} from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/link/route";
import { POST as rotateLinkRoute } from "@/app/api/v1/weddings/[weddingId]/guests/[guestId]/link/rotate/route";
import { GET as repliesRoute } from "@/app/api/v1/weddings/[weddingId]/rsvps/replies/route";
import { GET as publicGet, PATCH as publicPatch } from "@/app/api/v1/public/rsvp/[token]/route";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

export { makeEvent, makeGuest, record } from "../guests/helpers";

export const invite = (
  weddingId: string,
  guestId: string,
  who: TestMember,
  body: Record<string, unknown>,
) => call(inviteRoute, { cookie: who.cookie, params: { weddingId, guestId }, body });

export const inviteBatch = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(inviteBatchRoute, { cookie: who.cookie, params: { weddingId }, body });

export const getLink = (weddingId: string, guestId: string, who: TestMember) =>
  call(getLinkRoute, { method: "GET", cookie: who.cookie, params: { weddingId, guestId } });

export const createLink = (weddingId: string, guestId: string, who: TestMember) =>
  call(createLinkRoute, { cookie: who.cookie, params: { weddingId, guestId } });

export const rotateLink = (weddingId: string, guestId: string, who: TestMember) =>
  call(rotateLinkRoute, { cookie: who.cookie, params: { weddingId, guestId } });

export const overview = (weddingId: string, who: TestMember) =>
  call(overviewRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });

export const emailLogs = (weddingId: string, who: TestMember, query = "") =>
  call(listLogsRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const retryLog = (weddingId: string, logId: string, who: TestMember) =>
  call(retryLogRoute, { cookie: who.cookie, params: { weddingId, logId } });

export const replies = (weddingId: string, who: TestMember, eventId: string) =>
  call(repliesRoute, {
    method: "GET",
    path: `/api/test?eventId=${eventId}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const publicRsvp = (token: string, ip?: string) =>
  call(publicGet, { method: "GET", params: { token }, ip });

export const submitRsvp = (token: string, body: unknown, ip?: string) =>
  call(publicPatch, { method: "PATCH", params: { token }, body, ip });

/** The token at the end of a "http://…/i/<token>" link. */
export function tokenOf(inviteUrl: string): string {
  return inviteUrl.split("/i/")[1]!;
}

/**
 * Captures outgoing guest email. `failFor` lists recipients whose send fails with a provider
 * error (e.g. a full mailbox), the rest succeed. Returns the live list of delivered messages and a
 * way to stop failing.
 */
export function captureGuestEmails(failFor: string[] = []) {
  const sent: EmailMessage[] = [];
  const failing = new Set(failFor);
  setEmailProviderForTests({
    name: "test",
    async send(message) {
      if (failing.has(message.to)) {
        throw new EmailProviderError("mailbox_full", "Mailbox full (552)");
      }
      sent.push(message);
      return { providerMessageId: `test-${sent.length}` };
    },
  });
  return { sent, failing };
}
