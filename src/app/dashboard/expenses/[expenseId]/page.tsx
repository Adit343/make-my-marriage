import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardFooter } from "@/components/dashboard/sections";
import { ExpenseDetail } from "@/components/finance/expense-detail";
import { objectId } from "@/lib/validation/primitives";
import { getServerSession } from "@/modules/auth/server-session";
import { getExpensePage } from "@/modules/dashboard/workspace-pages.service";

export const metadata: Metadata = { title: "Expense — Make My Marriage" };

// Stitch screen "Expense Detail & Payment Recording".
export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  if (!objectId.safeParse(expenseId).success) notFound();
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const page = await getExpensePage(auth, expenseId);
  if (!page) redirect("/onboarding");
  if (page === "not_found") notFound();

  return (
    <AppShell dashboard={page.dashboard} active="expenses">
      <ExpenseDetail
        weddingId={page.weddingId}
        currency={page.currency}
        timezone={page.timezone}
        today={page.today}
        detail={page.detail}
        events={page.events}
        vendors={page.vendors}
        canRecordPayments={page.canRecordPayments}
        canSeeVendors={page.canSeeVendors}
      />
      <DashboardFooter />
    </AppShell>
  );
}
