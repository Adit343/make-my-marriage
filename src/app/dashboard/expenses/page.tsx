import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { ExpensesManager } from "@/components/finance/expenses-manager";
import { EXPENSE_CATEGORIES } from "@/lib/constants/enums";
import type { LedgerFilters } from "@/lib/finance/ledger";
import { getServerSession } from "@/modules/auth/server-session";
import { getExpensesPage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Expenses — Make My Marriage" };

// Stitch screens: "Expenses & Budget Overview" and "All Expenses & Ledger". `?tab=all` opens the
// ledger; `?event=`, `?vendor=` and `?category=` start it filtered (the vendor page's "View expenses").
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; event?: string; vendor?: string; category?: string }>;
}) {
  const query = await searchParams;
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getExpensesPage(auth);
  if (!page) redirect("/onboarding");

  // An id or category in the address that isn't (or is no longer) this wedding's is ignored.
  const initialFilters: Partial<LedgerFilters> = {};
  if (page.events.some((event) => event.id === query.event)) initialFilters.event = query.event;
  if (page.vendors.some((vendor) => vendor.id === query.vendor))
    initialFilters.vendor = query.vendor;
  const category = EXPENSE_CATEGORIES.find((value) => value === query.category);
  if (category) initialFilters.category = category;
  const filtered = Object.keys(initialFilters).length > 0;

  return (
    <AppShell dashboard={page.dashboard} active="expenses">
      <ExpensesManager
        weddingId={page.weddingId}
        weddingVersion={page.weddingVersion}
        currency={page.currency}
        timezone={page.timezone}
        summary={page.summary}
        expenses={page.expenses}
        events={page.events}
        vendors={page.vendors}
        canRecordPayments={page.canRecordPayments}
        canSeeVendors={page.canSeeVendors}
        canSetBudget={page.canSetBudget}
        initialTab={query.tab === "all" || filtered ? "all" : "overview"}
        initialFilters={initialFilters}
      />
      <DashboardFooter />
    </AppShell>
  );
}
