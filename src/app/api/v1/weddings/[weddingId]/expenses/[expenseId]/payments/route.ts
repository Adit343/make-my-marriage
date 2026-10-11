import { route } from "@/lib/http/route";
import { createPaymentBody, expenseParams } from "@/modules/expenses/expense.schemas";
import { createPayment, listPayments } from "@/modules/expenses/payment.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §9.3. Every member can read an expense's payments; only owners and admins record
// them. The app never moves money: this only writes down what was paid or is still owed.

export const GET = route(
  { params: expenseParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await listPayments(auth, params.expenseId) }),
);

export const POST = route(
  { params: expenseParams, body: createPaymentBody, auth: requireWeddingAccess("payments:record") },
  async ({ auth, params, body }) => ({
    status: 201,
    data: await createPayment(auth, params.expenseId, body),
  }),
);
