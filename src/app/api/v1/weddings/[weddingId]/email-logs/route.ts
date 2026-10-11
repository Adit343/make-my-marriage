import { route } from "@/lib/http/route";
import { emailLogsQuery } from "@/modules/guest-invitations/guest-invitation.schemas";
import { listEmailLogs } from "@/modules/guest-invitations/invitation-overview.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §13: the delivery log of guest emails (invitations and reminders), newest first. It
// holds only status, recipient and a sanitised error, never a body or a link. Owners and admins only
// (API Design §13; the Stitch screen says so too).

export const GET = route(
  { params: weddingParams, query: emailLogsQuery, auth: requireWeddingAccess("invitations:logs") },
  async ({ auth, query }) => {
    const { items, meta } = await listEmailLogs(auth, query);
    return { data: items, meta };
  },
);
