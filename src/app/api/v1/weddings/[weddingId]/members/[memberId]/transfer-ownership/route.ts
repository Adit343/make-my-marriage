import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { memberParams } from "@/modules/members/member.schemas";
import { transferOwnership } from "@/modules/members/member.service";

// POST /api/v1/weddings/:weddingId/members/:memberId/transfer-ownership — API Design §6.8.
export const POST = route(
  { params: memberParams, auth: requireWeddingAccess("ownership:transfer") },
  async ({ auth, params }) => ({ data: await transferOwnership(auth, params.memberId) }),
);
