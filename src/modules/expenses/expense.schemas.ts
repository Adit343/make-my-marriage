import { z } from "zod";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants/enums";
import {
  MAX_EXPENSE_NOTES,
  MAX_EXPENSE_TITLE,
  MAX_PAYMENT_NOTES,
  MAX_PAYMENT_REFERENCE,
} from "@/lib/constants/finance";
import { cursorPageQuery } from "@/lib/http/pagination";
import { isoDate, minorAmount, objectId } from "@/lib/validation/primitives";

// API Design §9.1 and §9.3. Amounts are whole paise on the wire (DB Design §3.5); calendar days are
// "YYYY-MM-DD". Ids that point at other wedding-owned documents (eventId, vendorId, expenseId)
// are checked against the wedding in the service, not here.

export const expenseParams = z.object({ weddingId: objectId, expenseId: objectId });
export const paymentParams = z.object({ weddingId: objectId, paymentId: objectId });

const title = z.string().trim().min(1).max(MAX_EXPENSE_TITLE);
const notes = z.string().trim().max(MAX_EXPENSE_NOTES);

export const createExpenseBody = z.strictObject({
  title,
  category: z.enum(EXPENSE_CATEGORIES),
  /** When it was booked or incurred. */
  expenseDate: isoDate.nullable().optional(),
  /** null or absent = not tied to one event. */
  eventId: objectId.nullable().optional(),
  vendorId: objectId.nullable().optional(),
  estimatedAmountMinor: minorAmount.nullable().optional(),
  agreedAmountMinor: minorAmount.nullable().optional(),
  notes: notes.optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseBody>;

// Any subset plus the `version` the client last read (decision C5).
export const updateExpenseBody = z
  .strictObject({
    version: z.number().int().min(0),
    title,
    category: z.enum(EXPENSE_CATEGORIES),
    expenseDate: isoDate.nullable(),
    eventId: objectId.nullable(),
    vendorId: objectId.nullable(),
    estimatedAmountMinor: minorAmount.nullable(),
    agreedAmountMinor: minorAmount.nullable(),
    notes: notes.nullable(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateExpenseInput = z.infer<typeof updateExpenseBody>;

// Allow-listed filters, each served by an index in DB Design §8.2 (API Design §2.7).
export const listExpensesQuery = z
  .strictObject({
    ...cursorPageQuery,
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    eventId: objectId.optional(),
    vendorId: objectId.optional(),
    /** Expense date from this day (inclusive). */
    from: isoDate.optional(),
    /** Expense date up to this day (inclusive). */
    to: isoDate.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "The end date is before the start date",
  });
export type ListExpensesQuery = z.infer<typeof listExpensesQuery>;

// ---- Payments (API Design §9.3) ----

const paymentFields = {
  amountMinor: minorAmount.min(1, "A payment must be more than zero"),
  status: z.enum(PAYMENT_STATUSES),
  dueDate: isoDate.nullable(),
  /** When it was paid (an instant). Only a paid payment has one; defaults to now when paid. */
  paidAt: z.iso.datetime().nullable(),
  method: z.enum(PAYMENT_METHODS).nullable(),
  reference: z.string().trim().max(MAX_PAYMENT_REFERENCE).nullable(),
  notes: z.string().trim().max(MAX_PAYMENT_NOTES).nullable(),
};

export const createPaymentBody = z
  .strictObject({
    amountMinor: paymentFields.amountMinor,
    status: paymentFields.status.optional(),
    dueDate: paymentFields.dueDate.optional(),
    paidAt: paymentFields.paidAt.optional(),
    method: paymentFields.method.optional(),
    reference: z.string().trim().max(MAX_PAYMENT_REFERENCE).optional(),
    notes: z.string().trim().max(MAX_PAYMENT_NOTES).optional(),
  })
  .refine((body) => !body.paidAt || (body.status ?? "pending") === "paid", {
    path: ["paidAt"],
    message: "Only a paid payment has a paid date",
  });
export type CreatePaymentInput = z.infer<typeof createPaymentBody>;

export const updatePaymentBody = z
  .strictObject({ version: z.number().int().min(0), ...paymentFields })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdatePaymentInput = z.infer<typeof updatePaymentBody>;
