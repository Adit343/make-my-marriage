import { Schema, type InferSchemaType } from "mongoose";
import { EXPENSE_CATEGORIES } from "@/lib/constants/enums";
import { MAX_EXPENSE_NOTES, MAX_EXPENSE_TITLE } from "@/lib/constants/finance";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { ISO_DATE_PATTERN, wholeNumber } from "@/models/shared/validators";

// DB Design §6.12. A cost line in the budget. What has been PAID is never stored here: it is the sum
// of the expense's vendorPayments with status paid (DB Design §9.4), so there is one place to keep right.

const expenseSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_EXPENSE_TITLE },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    /** When it was booked or incurred: a calendar day, like every date without a time (DB Design §3.5). */
    expenseDate: { type: String, default: null, match: ISO_DATE_PATTERN },
    /** null = not tied to one event. The service checks the event belongs to this wedding. */
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    /** Money in paise, never floats (DB Design §3.5). */
    estimatedAmountMinor: { type: Number, default: null, min: 0, validate: wholeNumber },
    agreedAmountMinor: { type: Number, default: null, min: 0, validate: wholeNumber },
    /** Private to the team. */
    notes: { type: String, trim: true, maxlength: MAX_EXPENSE_NOTES },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  // Several members edit the same ledger; stale saves are rejected (DB Design §3.7).
  { collection: "expenses", timestamps: true, optimisticConcurrency: true },
);

expenseSchema.plugin(softDeletePlugin);

// Spend by category / by event / for a vendor (DB Design §8.3).
expenseSchema.index({ weddingId: 1, category: 1 });
expenseSchema.index({ weddingId: 1, eventId: 1 });
expenseSchema.index({ weddingId: 1, vendorId: 1 });
// Newest-first cursor pagination and "every expense of this wedding".
expenseSchema.index({ weddingId: 1, _id: -1 });

export type ExpenseRecord = InferSchemaType<typeof expenseSchema>;
export const Expense = defineModel("Expense", expenseSchema);
