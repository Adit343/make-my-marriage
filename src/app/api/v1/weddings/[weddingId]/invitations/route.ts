import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { createInvitationBody, listInvitationsQuery } from "@/modules/members/invitation.schemas";
import { createInvitation, listInvitations } from "@/modules/members/invitation.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §6.9–§6.11. Inviting people is team management, so admin and above.

export const GET = route(
  {
    params: weddingParams,
    query: listInvitationsQuery,
    auth: requireWeddingAccess("members:manage"),
  },
  async ({ auth, query }) => {
    const { items, meta } = await listInvitations(auth, query);
    return { data: items, meta };
  },
);

export const POST = route(
  {
    params: weddingParams,
    body: createInvitationBody,
    auth: requireWeddingAccess("members:manage"),
  },
  async ({ auth, body }) => ({ status: 201, data: await createInvitation(auth, body) }),
);
