import { route } from "@/lib/http/route";
import { createExpenseBody, listExpensesQuery } from "@/modules/expenses/expense.schemas";
import { createExpense, listExpenses } from "@/modules/expenses/expense.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §9.1. Every member sees every expense and can record one (owner decision 2026-10-10).
// Cursor-paginated, newest first; filters are an allow-list.

export const GET = route(
  { params: weddingParams, query: listExpensesQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => {
    const { items, meta } = await listExpenses(auth, query);
    return { data: items, meta };
  },
);

export const POST = route(
  { params: weddingParams, body: createExpenseBody, auth: requireWeddingAccess("expenses:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createExpense(auth, body) }),
);
