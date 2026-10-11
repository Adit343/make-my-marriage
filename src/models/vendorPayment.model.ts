import { Schema, type InferSchemaType } from "mongoose";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants/enums";
import { MAX_PAYMENT_NOTES, MAX_PAYMENT_REFERENCE } from "@/lib/constants/finance";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { ISO_DATE_PATTERN, wholeNumber } from "@/models/shared/validators";

// DB Design §6.14. A record of money paid (or due) against an expense. The app NEVER moves money
// (Architecture §2): a member types in what they paid. There is no vendorId here: the vendor is
// reached through the expense, so it cannot go stale when an expense changes vendor.

const vendorPaymentSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    expenseId: { type: Schema.Types.ObjectId, ref: "Expense", required: true },
    amountMinor: { type: Number, required: true, min: 1, validate: wholeNumber },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "pending" },
    dueDate: { type: String, default: null, match: ISO_DATE_PATTERN },
    /** Required when status is paid. */
    paidAt: { type: Date, default: null },
    method: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
    /** A UPI reference or cheque number. Private. */
    reference: { type: String, trim: true, maxlength: MAX_PAYMENT_REFERENCE },
    notes: { type: String, trim: true, maxlength: MAX_PAYMENT_NOTES },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "vendorPayments", timestamps: true, optimisticConcurrency: true },
);

vendorPaymentSchema.plugin(softDeletePlugin);

vendorPaymentSchema.pre("validate", function () {
  if (this.status === "paid" && !this.paidAt) {
    this.invalidate("paidAt", "paidAt is required when a payment is paid");
  }
});

// Per-expense payments and totals; upcoming dues (DB Design §8.3).
vendorPaymentSchema.index({ weddingId: 1, expenseId: 1 });
vendorPaymentSchema.index({ weddingId: 1, status: 1, dueDate: 1 });

export type VendorPaymentRecord = InferSchemaType<typeof vendorPaymentSchema>;
export const VendorPayment = defineModel("VendorPayment", vendorPaymentSchema);
