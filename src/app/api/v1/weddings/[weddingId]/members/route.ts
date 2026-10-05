import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { listMembersQuery } from "@/modules/members/member.schemas";
import { listTeam } from "@/modules/members/member.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// GET /api/v1/weddings/:weddingId/members — API Design §6.5 (page-number pagination).
export const GET = route(
  { params: weddingParams, query: listMembersQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => {
    const { items, meta } = await listTeam(auth, query);
    return { data: items, meta };
  },
);
