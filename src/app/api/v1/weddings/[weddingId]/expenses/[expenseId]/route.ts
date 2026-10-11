import { route } from "@/lib/http/route";
import { expenseParams, updateExpenseBody } from "@/modules/expenses/expense.schemas";
import { deleteExpense, getExpenseDetail, updateExpense } from "@/modules/expenses/expense.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §9.1. Every role may read one; the service lets a member edit or delete only the
// expenses they recorded (admin and owner: any).

export const GET = route(
  { params: expenseParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await getExpenseDetail(auth, params.expenseId) }),
);

export const PATCH = route(
  { params: expenseParams, body: updateExpenseBody, auth: requireWeddingAccess("expenses:edit") },
  async ({ auth, params, body }) => ({ data: await updateExpense(auth, params.expenseId, body) }),
);

export const DELETE = route(
  { params: expenseParams, auth: requireWeddingAccess("expenses:edit") },
  async ({ auth, params }) => ({ data: await deleteExpense(auth, params.expenseId) }),
);
