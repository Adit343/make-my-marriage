import { route } from "@/lib/http/route";
import { createGroupBody } from "@/modules/guest-groups/guest-group.schemas";
import { createGroup, listGroups } from "@/modules/guest-groups/guest-group.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §8.1. A wedding has a handful of groups, so the list is not paginated.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await listGroups(auth) }),
);

export const POST = route(
  { params: weddingParams, body: createGroupBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createGroup(auth, body) }),
);
