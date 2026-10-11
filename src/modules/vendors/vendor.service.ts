import "server-only";
import { z } from "zod";
import { withTransaction } from "@/infrastructure/database/transaction";
import { searchPlaces, type PlaceResult } from "@/infrastructure/places/google-places";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { costOf } from "@/lib/finance/money";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { normalizeName } from "@/lib/text/normalize";
import { objectId } from "@/lib/validation/primitives";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { toExpenseDtos } from "@/modules/expenses/expense.service";
import type { ExpenseDto } from "@/modules/expenses/expense.dto";
import {
  listAllExpenses,
  listExpenseCosts,
  unlinkExpensesFromVendor,
} from "@/modules/expenses/expense.repository";
import {
  listPaymentsForExpenses,
  paidTotalsByExpense,
} from "@/modules/expenses/payment.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { findWedding } from "@/modules/weddings/wedding.repository";
import { toVendorDto, type VendorDto, type VendorMoneyDto } from "@/modules/vendors/vendor.dto";
import {
  findVendor,
  insertVendor,
  listAllVendors,
  listVendorsPage,
  softDeleteVendor,
  updateVendor as updateVendorRow,
  type VendorChanges,
  type VendorFilters,
} from "@/modules/vendors/vendor.repository";
import type {
  CreateVendorInput,
  ListVendorsQuery,
  SearchPlacesQuery,
  UpdateVendorInput,
} from "@/modules/vendors/vendor.schemas";

// Vendors (API Design §9.2): the people the wedding is considering or has hired, NOT a
// marketplace. Everything here needs vendors:manage (owner and admin, decision D3): a vendor's
// contact details, terms and notes are private. Payments are never processed; what is agreed and
// paid comes from the expenses linked to the vendor.

type VendorRow = NonNullable<Awaited<ReturnType<typeof findVendor>>>;

const cursorPosition = z.object({ name: z.string(), id: objectId });
const NO_MONEY: VendorMoneyDto = { expenseCount: 0, costMinor: 0, paidMinor: 0 };

/** What each vendor is owed and has been paid: summed from the expenses linked to it. */
async function moneyByVendor(auth: WeddingAuth): Promise<Map<string, VendorMoneyDto>> {
  const [expenses, paid] = await Promise.all([
    listExpenseCosts(auth.weddingId),
    paidTotalsByExpense(auth.weddingId),
  ]);
  const byVendor = new Map<string, VendorMoneyDto>();
  for (const expense of expenses) {
    if (!expense.vendorId) continue;
    const key = expense.vendorId.toString();
    const money = byVendor.get(key) ?? { ...NO_MONEY };
    money.expenseCount += 1;
    money.costMinor += costOf(expense);
    money.paidMinor += paid.get(expense._id.toString()) ?? 0;
    byVendor.set(key, money);
  }
  return byVendor;
}

function toDtos(rows: VendorRow[], money: Map<string, VendorMoneyDto>): VendorDto[] {
  return rows.map((row) => toVendorDto(row, money.get(row._id.toString()) ?? NO_MONEY));
}

export async function listVendors(
  auth: WeddingAuth,
  query: ListVendorsQuery,
): Promise<{ items: VendorDto[]; meta: CursorMeta }> {
  const { limit, cursor, search, ...rest } = query;
  const filters: VendorFilters = { ...rest };
  if (search) filters.namePrefix = normalizeName(search);
  const after = cursor ? decodeCursor(cursor, cursorPosition) : undefined;
  const rows = await listVendorsPage(auth.weddingId, filters, { limit, after });
  const page = paginateByCursor(rows, limit, (row) => ({
    name: row.nameNormalized,
    id: row._id.toString(),
  }));
  return { items: toDtos(page.items, await moneyByVendor(auth)), meta: page.meta };
}

/** Every vendor A to Z with its money, for the Vendors screen. */
export async function listEveryVendor(auth: WeddingAuth): Promise<VendorDto[]> {
  const [rows, money] = await Promise.all([listAllVendors(auth.weddingId), moneyByVendor(auth)]);
  return toDtos(rows, money);
}

/** One payment against a vendor, with the expense it belongs to (the vendor page's payment milestones). */
export interface VendorMilestoneDto {
  id: string;
  expenseId: string;
  expenseTitle: string;
  amountMinor: number;
  status: "pending" | "paid";
  dueDate: string | null;
  paidAt: string | null;
  isOverdue: boolean;
}

export interface VendorDetailDto {
  vendor: VendorDto;
  /** The expenses booked with this vendor, each with what has been paid. */
  expenses: ExpenseDto[];
  /** Payments still to make first (soonest due first), then the ones already paid. Cancelled ones are left out. */
  milestones: VendorMilestoneDto[];
}

export async function getVendorDetail(
  auth: WeddingAuth,
  vendorId: string,
): Promise<VendorDetailDto> {
  const row = await findVendor(auth.weddingId, vendorId);
  if (!row) throw new AppError("NOT_FOUND");
  const expenseRows = (await listAllExpenses(auth.weddingId)).filter(
    (expense) => expense.vendorId?.toString() === row._id.toString(),
  );
  const expenses = await toExpenseDtos(auth, expenseRows);
  const money: VendorMoneyDto = {
    expenseCount: expenses.length,
    costMinor: expenses.reduce((sum, expense) => sum + expense.costMinor, 0),
    paidMinor: expenses.reduce((sum, expense) => sum + expense.paidAmountMinor, 0),
  };
  const [payments, wedding] = await Promise.all([
    listPaymentsForExpenses(
      auth.weddingId,
      expenseRows.map((expense) => expense._id),
    ),
    findWedding(auth.weddingId),
  ]);
  const today = todayIn(wedding?.timezone ?? "Asia/Kolkata");
  const titleOf = new Map(expenses.map((expense) => [expense.id, expense.title]));
  const milestones: VendorMilestoneDto[] = payments.flatMap((payment) =>
    payment.status === "cancelled"
      ? []
      : [
          {
            id: payment._id.toString(),
            expenseId: payment.expenseId.toString(),
            expenseTitle: titleOf.get(payment.expenseId.toString()) ?? "",
            amountMinor: payment.amountMinor,
            status: payment.status,
            dueDate: payment.dueDate ?? null,
            paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
            isOverdue: payment.status === "pending" && !!payment.dueDate && payment.dueDate < today,
          },
        ],
  );
  milestones.sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    if (a.status === "pending") return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    return (b.paidAt ?? "").localeCompare(a.paidAt ?? "");
  });
  return { vendor: toVendorDto(row, money), expenses, milestones };
}

export async function createVendor(
  auth: WeddingAuth,
  input: CreateVendorInput,
): Promise<VendorDto> {
  const row = await insertVendor(auth.weddingId, { ...input, createdBy: auth.userId });
  return toVendorDto(row, NO_MONEY);
}

export async function updateVendor(
  auth: WeddingAuth,
  vendorId: string,
  input: UpdateVendorInput,
): Promise<VendorDto> {
  const { version, ...changes } = input as UpdateVendorInput & VendorChanges;
  const result = await updateVendorRow(auth.weddingId, vendorId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toVendorDto(result, (await moneyByVendor(auth)).get(vendorId) ?? NO_MONEY);
}

/**
 * Soft delete. The vendor's expenses stay (the money was still spent): they lose the link in the
 * same transaction and the response says how many, so the screen can say so.
 */
export async function deleteVendor(auth: WeddingAuth, vendorId: string) {
  const existing = await findVendor(auth.weddingId, vendorId);
  if (!existing) throw new AppError("NOT_FOUND");

  const at = new Date();
  const expensesUnlinked = await withTransaction(async (session) => {
    if (!(await softDeleteVendor(auth.weddingId, vendorId, { by: auth.userId, at }, session))) {
      throw new AppError("NOT_FOUND");
    }
    return unlinkExpensesFromVendor(auth.weddingId, vendorId, session);
  });
  return { id: vendorId, deletedAt: at.toISOString(), expensesUnlinked };
}

export interface PlaceSearchResult {
  results: PlaceResult[];
  /** False when no Google key is set: the form then asks for the details to be typed. */
  configured: boolean;
  /** True when Google could not be reached; nothing was lost and the vendor can still be typed in. */
  unavailable: boolean;
}

/**
 * Nearby business search through Google (API Design §9.2). Server-mediated, rate limited (each
 * search costs money) and never persisted: nothing is written until a member adds the vendor.
 */
export async function searchVendorPlaces(
  auth: WeddingAuth,
  query: SearchPlacesQuery,
): Promise<PlaceSearchResult> {
  await enforceRateLimit(`places-search:${auth.weddingId}`, RATE_LIMITS.placesSearch);
  const outcome = await searchPlaces(query.query);
  if (outcome.status === "not_configured") {
    return { results: [], configured: false, unavailable: false };
  }
  if (outcome.status === "unavailable") {
    return { results: [], configured: true, unavailable: true };
  }
  return { results: outcome.results, configured: true, unavailable: false };
}
