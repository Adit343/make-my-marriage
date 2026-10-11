import { route } from "@/lib/http/route";
import { getExpenseSummary } from "@/modules/expenses/expense.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §9.1: the budget overview in one call. The wedding's overall budget is returned to
// owners and admins only; every other number is open to every member.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await getExpenseSummary(auth) }),
);
