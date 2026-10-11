import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import {
  GET as listExpensesRoute,
  POST as createExpenseRoute,
} from "@/app/api/v1/weddings/[weddingId]/expenses/route";
import {
  DELETE as deleteExpenseRoute,
  GET as getExpenseRoute,
  PATCH as patchExpenseRoute,
} from "@/app/api/v1/weddings/[weddingId]/expenses/[expenseId]/route";
import {
  GET as listPaymentsRoute,
  POST as createPaymentRoute,
} from "@/app/api/v1/weddings/[weddingId]/expenses/[expenseId]/payments/route";
import { GET as summaryRoute } from "@/app/api/v1/weddings/[weddingId]/expenses/summary/route";
import {
  DELETE as deletePaymentRoute,
  PATCH as patchPaymentRoute,
} from "@/app/api/v1/weddings/[weddingId]/payments/[paymentId]/route";
import {
  GET as listVendorsRoute,
  POST as createVendorRoute,
} from "@/app/api/v1/weddings/[weddingId]/vendors/route";
import { GET as searchPlacesRoute } from "@/app/api/v1/weddings/[weddingId]/vendors/search-places/route";
import {
  DELETE as deleteVendorRoute,
  GET as getVendorRoute,
  PATCH as patchVendorRoute,
} from "@/app/api/v1/weddings/[weddingId]/vendors/[vendorId]/route";
import { PATCH as patchWeddingRoute } from "@/app/api/v1/weddings/[weddingId]/route";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

// Thin wrappers over the route handlers so each test reads as the request it makes.

export async function makeEvent(weddingId: string, who: TestMember, name = "Haldi") {
  const result = await call(createEvent, {
    cookie: who.cookie,
    params: { weddingId },
    body: { name, type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data.id as string;
}

/** Sets the wedding's overall budget (owner or admin). */
export async function setBudget(weddingId: string, who: TestMember, budgetTotalMinor: number) {
  const current = await call(patchWeddingRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId },
    body: { version: 0, budgetTotalMinor },
  });
  if (current.status !== 200) throw new Error(JSON.stringify(current.json));
}

export const createExpense = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(createExpenseRoute, { cookie: who.cookie, params: { weddingId }, body });

export async function makeExpense(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
) {
  const result = await createExpense(weddingId, who, {
    title: "Photography package",
    category: "photography_video",
    ...body,
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number } & Record<string, unknown>;
}

export const listExpenses = (weddingId: string, who: TestMember, query = "") =>
  call(listExpensesRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const getExpense = (weddingId: string, expenseId: string, who: TestMember) =>
  call(getExpenseRoute, {
    method: "GET",
    cookie: who.cookie,
    params: { weddingId, expenseId },
  });

export const patchExpense = (
  weddingId: string,
  expenseId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchExpenseRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, expenseId },
    body,
  });

export const deleteExpense = (weddingId: string, expenseId: string, who: TestMember) =>
  call(deleteExpenseRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, expenseId },
  });

export const expenseSummary = (weddingId: string, who: TestMember) =>
  call(summaryRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });

export const createPayment = (
  weddingId: string,
  expenseId: string,
  who: TestMember,
  body: Record<string, unknown>,
) => call(createPaymentRoute, { cookie: who.cookie, params: { weddingId, expenseId }, body });

export async function makePayment(
  weddingId: string,
  expenseId: string,
  who: TestMember,
  body: Record<string, unknown>,
) {
  const result = await createPayment(weddingId, expenseId, who, body);
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as {
    payment: { id: string; version: number } & Record<string, unknown>;
    exceedsAgreedAmount: boolean;
    scheduledAmountMinor: number;
  };
}

export const listPayments = (weddingId: string, expenseId: string, who: TestMember) =>
  call(listPaymentsRoute, {
    method: "GET",
    cookie: who.cookie,
    params: { weddingId, expenseId },
  });

export const patchPayment = (
  weddingId: string,
  paymentId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchPaymentRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, paymentId },
    body,
  });

export const deletePayment = (weddingId: string, paymentId: string, who: TestMember) =>
  call(deletePaymentRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, paymentId },
  });

export const createVendor = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(createVendorRoute, { cookie: who.cookie, params: { weddingId }, body });

export async function makeVendor(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
) {
  const result = await createVendor(weddingId, who, {
    name: "Lens & Light Studio",
    category: "photographer",
    ...body,
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number } & Record<string, unknown>;
}

export const listVendors = (weddingId: string, who: TestMember, query = "") =>
  call(listVendorsRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const getVendor = (weddingId: string, vendorId: string, who: TestMember) =>
  call(getVendorRoute, { method: "GET", cookie: who.cookie, params: { weddingId, vendorId } });

export const patchVendor = (
  weddingId: string,
  vendorId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchVendorRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, vendorId },
    body,
  });

export const deleteVendor = (weddingId: string, vendorId: string, who: TestMember) =>
  call(deleteVendorRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, vendorId },
  });

export const searchPlaces = (weddingId: string, who: TestMember, query: string) =>
  call(searchPlacesRoute, {
    method: "GET",
    path: `/api/test?query=${encodeURIComponent(query)}`,
    cookie: who.cookie,
    params: { weddingId },
  });
