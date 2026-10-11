import { route } from "@/lib/http/route";
import { paymentParams, updatePaymentBody } from "@/modules/expenses/expense.schemas";
import { deletePayment, updatePayment } from "@/modules/expenses/payment.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §9.3. A payment is reached by its own id (no expense in the URL): the wedding in the
// path scopes it, so another wedding's payment id is simply 404.

export const PATCH = route(
  { params: paymentParams, body: updatePaymentBody, auth: requireWeddingAccess("payments:record") },
  async ({ auth, params, body }) => ({ data: await updatePayment(auth, params.paymentId, body) }),
);

export const DELETE = route(
  { params: paymentParams, auth: requireWeddingAccess("payments:record") },
  async ({ auth, params }) => ({ data: await deletePayment(auth, params.paymentId) }),
);
