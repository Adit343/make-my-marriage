import { apiRequest, apiRequestWithMeta } from "@/lib/client/api-client";
import type {
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  VendorCategory,
  VendorStatus,
} from "@/lib/constants/enums";

// Browser calls to the expenses, payments and vendors API (API Design §9).

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}`;

export interface ExpenseInput {
  title: string;
  category: ExpenseCategory;
  expenseDate: string | null;
  eventId: string | null;
  vendorId: string | null;
  estimatedAmountMinor: number | null;
  agreedAmountMinor: number | null;
  notes: string | null;
}

export function createExpense(weddingId: string, input: ExpenseInput) {
  // The create endpoint takes an absent note rather than null.
  const { notes, ...rest } = input;
  return apiRequest<{ id: string }>(`${base(weddingId)}/expenses`, {
    method: "POST",
    body: { ...rest, ...(notes ? { notes } : {}) },
  });
}

export function updateExpense(
  weddingId: string,
  expenseId: string,
  version: number,
  changes: Partial<ExpenseInput>,
) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/expenses/${expenseId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteExpense(weddingId: string, expenseId: string) {
  return apiRequest<{ id: string; paymentsRemoved: number }>(
    `${base(weddingId)}/expenses/${expenseId}`,
    { method: "DELETE" },
  );
}

export interface PaymentInput {
  amountMinor: number;
  status: PaymentStatus;
  dueDate: string | null;
  /** An ISO instant; only for a paid payment. */
  paidAt: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
}

export interface PaymentResult {
  payment: { id: string };
  exceedsAgreedAmount: boolean;
  scheduledAmountMinor: number;
}

export function createPayment(weddingId: string, expenseId: string, input: PaymentInput) {
  // The create endpoint takes absent optional fields rather than null.
  const body: Record<string, unknown> = { amountMinor: input.amountMinor, status: input.status };
  if (input.dueDate) body.dueDate = input.dueDate;
  if (input.status === "paid" && input.paidAt) body.paidAt = input.paidAt;
  if (input.method) body.method = input.method;
  if (input.reference) body.reference = input.reference;
  if (input.notes) body.notes = input.notes;
  return apiRequest<PaymentResult>(`${base(weddingId)}/expenses/${expenseId}/payments`, {
    method: "POST",
    body,
  });
}

export function updatePayment(
  weddingId: string,
  paymentId: string,
  version: number,
  input: PaymentInput,
) {
  return apiRequest<PaymentResult>(`${base(weddingId)}/payments/${paymentId}`, {
    method: "PATCH",
    body: {
      version,
      amountMinor: input.amountMinor,
      status: input.status,
      dueDate: input.dueDate,
      // A pending or cancelled payment has no paid date; a paid one keeps what the form shows.
      ...(input.status === "paid" && input.paidAt ? { paidAt: input.paidAt } : {}),
      method: input.method,
      reference: input.reference,
      notes: input.notes,
    },
  });
}

export function deletePayment(weddingId: string, paymentId: string) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export interface VendorInput {
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact: { personName?: string; phone?: string; email?: string; website?: string } | null;
  location: {
    label?: string;
    address?: { line1?: string; city?: string; state?: string };
    placeId?: string;
  } | null;
  notes: string | null;
}

export function createVendor(
  weddingId: string,
  input: VendorInput,
  source: "manual" | "google_places",
) {
  const { contact, location, notes, ...rest } = input;
  return apiRequest<{ id: string }>(`${base(weddingId)}/vendors`, {
    method: "POST",
    body: {
      ...rest,
      source,
      ...(contact ? { contact } : {}),
      ...(location ? { location } : {}),
      ...(notes ? { notes } : {}),
    },
  });
}

export function updateVendor(
  weddingId: string,
  vendorId: string,
  version: number,
  changes: Partial<VendorInput>,
) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/vendors/${vendorId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteVendor(weddingId: string, vendorId: string) {
  return apiRequest<{ id: string; expensesUnlinked: number }>(
    `${base(weddingId)}/vendors/${vendorId}`,
    { method: "DELETE" },
  );
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

export async function searchPlaces(weddingId: string, query: string) {
  const { data, meta } = await apiRequestWithMeta<PlaceResult[]>(
    `${base(weddingId)}/vendors/search-places?query=${encodeURIComponent(query)}`,
  );
  return {
    results: data,
    configured: meta?.configured !== false,
    unavailable: meta?.unavailable === true,
  };
}
