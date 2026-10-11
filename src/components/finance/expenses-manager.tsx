"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventMenu } from "@/components/events/event-menu";
import { BudgetDialog } from "@/components/finance/budget-dialog";
import { BUTTON_PRIMARY, Chip, EmptyState, FilterPill, ProgressBar } from "@/components/finance/ui";
import { useExpenseActions } from "@/components/finance/use-expense-actions";
import { Icon } from "@/components/ui/icon";
import type { ExpenseCategory } from "@/lib/constants/enums";
import { formatShortDate } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/labels";
import {
  applyLedgerFilters,
  hasLedgerFilters,
  ledgerTotals,
  NO_LEDGER_FILTERS,
  type LedgerFilters,
} from "@/lib/finance/ledger";
import { formatMoney, paidPercent } from "@/lib/finance/money";
import type { ExpenseDto, ExpenseSummaryDto } from "@/modules/expenses/expense.dto";

// Stitch screens "Expenses & Budget Overview" and "All Expenses & Ledger": one page, two tabs.
// Everyone in the wedding sees every expense (owner decision 2026-10-10); only owners and admins
// see the overall budget and record payments; a member edits only what they recorded.

export type ExpensesTab = "overview" | "all";

const PAGE_SIZE = 10;
const CARD = "rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest";

export function ExpensesManager({
  weddingId,
  weddingVersion,
  currency,
  timezone,
  summary,
  expenses,
  events,
  vendors,
  canRecordPayments,
  canSeeVendors,
  canSetBudget,
  initialTab,
  initialFilters,
}: {
  weddingId: string;
  weddingVersion: number;
  currency: string;
  timezone: string;
  summary: ExpenseSummaryDto;
  expenses: ExpenseDto[];
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  canRecordPayments: boolean;
  canSeeVendors: boolean;
  canSetBudget: boolean;
  initialTab: ExpensesTab;
  initialFilters: Partial<LedgerFilters>;
}) {
  const actions = useExpenseActions({
    weddingId,
    currency,
    timezone,
    events,
    vendors,
    canRecordPayments,
  });
  const [tab, setTab] = useState<ExpensesTab>(initialTab);
  const [filters, setFilters] = useState<LedgerFilters>({
    ...NO_LEDGER_FILTERS,
    ...initialFilters,
  });
  const [shown, setShown] = useState(PAGE_SIZE);
  const [budgetOpen, setBudgetOpen] = useState(false);

  // The chosen tab lives in the address (?tab=all) so it survives a reload and can be shared.
  function chooseTab(next: ExpensesTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.set("tab", "all");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-10">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
                Expenses
              </h1>
              <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-[11px] text-on-surface-variant">
                {canSeeVendors ? "Full access" : "Member view"}
              </span>
            </div>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              Your budget, what&apos;s agreed, and what&apos;s been paid.
            </p>
          </div>
          <button
            type="button"
            onClick={() => actions.openDrawer({ kind: "create" })}
            className={BUTTON_PRIMARY}
          >
            <Icon name="add" className="text-[18px]" />
            <span>Add expense</span>
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Expenses views"
          className="flex gap-8 border-b border-[#2A2622]/[0.08]"
        >
          {(
            [
              ["overview", "Overview"],
              ["all", "All expenses"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`expenses-tab-${value}`}
              aria-selected={tab === value}
              aria-controls={`expenses-panel-${value}`}
              onClick={() => chooseTab(value)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 font-body-md text-body-md transition-colors ${
                tab === value
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              {label}
              {value === "all" ? (
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-[11px] text-on-surface-variant">
                  {summary.expenseCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div role="tabpanel" id="expenses-panel-overview" aria-labelledby="expenses-tab-overview">
          <Overview
            summary={summary}
            currency={currency}
            canSetBudget={canSetBudget}
            onSetBudget={() => setBudgetOpen(true)}
            onAdd={() => actions.openDrawer({ kind: "create" })}
          />
        </div>
      ) : (
        <div role="tabpanel" id="expenses-panel-all" aria-labelledby="expenses-tab-all">
          <Ledger
            expenses={expenses}
            events={events}
            vendors={vendors}
            currency={currency}
            filters={filters}
            onFilters={(next) => {
              setFilters(next);
              setShown(PAGE_SIZE);
            }}
            shown={shown}
            onShowMore={() => setShown((count) => count + PAGE_SIZE)}
            menuItems={actions.menuItems}
            onAdd={() => actions.openDrawer({ kind: "create" })}
          />
        </div>
      )}

      {actions.overlays}
      {budgetOpen ? (
        <BudgetDialog
          weddingId={weddingId}
          weddingVersion={weddingVersion}
          currency={currency}
          currentMinor={summary.budgetTotalMinor}
          onClose={() => setBudgetOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Overview

function Overview({
  summary,
  currency,
  canSetBudget,
  onSetBudget,
  onAdd,
}: {
  summary: ExpenseSummaryDto;
  currency: string;
  canSetBudget: boolean;
  onSetBudget: () => void;
  onAdd: () => void;
}) {
  const money = (minor: number) => formatMoney(minor, currency);
  const budget = summary.budgetTotalMinor;
  // The bar is drawn against the budget when there is one, else against the total cost.
  const scale = Math.max(budget ?? 0, summary.totalCostMinor, 1);
  const paidWidth = Math.min(100, (summary.totalPaidMinor / scale) * 100);
  const toPayWidth = Math.min(100 - paidWidth, (summary.stillToPayMinor / scale) * 100);
  const maxCategory = Math.max(...summary.byCategory.map((row) => row.costMinor), 1);

  if (summary.expenseCount === 0) {
    return (
      <div className="space-y-6">
        <BudgetHero
          summary={summary}
          currency={currency}
          paidWidth={0}
          toPayWidth={0}
          canSetBudget={canSetBudget}
          onSetBudget={onSetBudget}
        />
        <EmptyState
          icon="receipt_long"
          title="No expenses yet"
          message="Record what you spend as you book: venue, catering, decor and more. Totals and what is still to pay fill in as you go."
          action={
            <button type="button" onClick={onAdd} className={BUTTON_PRIMARY}>
              <Icon name="add" className="text-[18px]" />
              Add your first expense
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BudgetHero
        summary={summary}
        currency={currency}
        paidWidth={paidWidth}
        toPayWidth={toPayWidth}
        canSetBudget={canSetBudget}
        onSetBudget={onSetBudget}
      />

      <section aria-label="At a glance" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="font-headline-md text-headline-md text-primary">{summary.expenseCount}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">expenses tracked</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
            <Icon name="receipt_long" />
          </span>
        </div>
        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="font-headline-md text-headline-md text-primary">
              {summary.dueSoon.count}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              payments due in next {summary.dueSoon.windowDays} days
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-fixed/40 text-secondary">
            <Icon name="schedule" />
          </span>
        </div>
        <div className={`${CARD} flex items-center justify-between p-5`}>
          <div>
            <p className="flex items-center gap-2 font-headline-md text-headline-md text-secondary">
              {summary.overdue.count}
              {summary.overdue.count > 0 ? <Chip tone="terracotta">Overdue</Chip> : null}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {summary.overdue.count > 0
                ? `payment${summary.overdue.count === 1 ? "" : "s"} overdue (${money(summary.overdue.totalMinor)})`
                : "payments overdue"}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-fixed/40 text-secondary">
            <Icon name="error" />
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section aria-labelledby="by-category" className={`${CARD} p-6 lg:col-span-3`}>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 id="by-category" className="font-headline-sm text-headline-sm text-primary">
              Spending by category
            </h2>
            <span className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
              {summary.byCategory.length}{" "}
              {summary.byCategory.length === 1 ? "category" : "categories"}
            </span>
          </div>
          <ul className="space-y-4">
            {summary.byCategory.map((row) => (
              <li key={row.category}>
                <div className="mb-1.5 flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface">{EXPENSE_CATEGORY_LABEL[row.category]}</span>
                  <span className="text-on-surface">{money(row.costMinor)}</span>
                </div>
                <ProgressBar
                  percent={Math.round((row.costMinor / maxCategory) * 100)}
                  label={`${EXPENSE_CATEGORY_LABEL[row.category]} spend compared with the largest category`}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="upcoming" className={`${CARD} p-6 lg:col-span-2`}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="upcoming" className="font-headline-sm text-headline-sm text-primary">
              Upcoming payments
            </h2>
            <span className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
              Next {summary.dueSoon.windowDays} days
            </span>
          </div>
          {summary.dueSoon.items.length === 0 ? (
            <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">
              Nothing is due. Add a payment with a due date and it will show up here.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[#2A2622]/[0.06]">
                {summary.dueSoon.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/dashboard/expenses/${item.expenseId}`}
                      className="flex items-start justify-between gap-4 rounded-lg py-3 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-title text-body-sm font-semibold text-on-surface">
                          {item.vendorName ?? item.expenseTitle}
                        </p>
                        <p className="truncate font-body-sm text-[12px] text-on-surface-variant">
                          {item.vendorName ? item.expenseTitle : "No vendor linked"}
                        </p>
                        <p
                          className={`mt-1 flex items-center gap-1 font-body-sm text-[12px] ${item.isOverdue ? "text-secondary" : "text-on-surface-variant"}`}
                        >
                          {item.isOverdue ? <Icon name="schedule" className="text-[13px]" /> : null}
                          Due {formatShortDate(item.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`font-title text-body-md font-semibold ${item.isOverdue ? "text-secondary" : "text-on-surface"}`}
                        >
                          {money(item.amountMinor)}
                        </p>
                        <Chip tone={item.isOverdue ? "terracotta" : "neutral"} dot>
                          {item.isOverdue ? "Overdue" : "Pending"}
                        </Chip>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-[#2A2622]/[0.08] pt-4 font-body-sm text-body-sm">
                <span className="text-on-surface-variant">Subtotal due in period</span>
                <span className="font-title text-body-md font-semibold text-on-surface">
                  {money(summary.dueSoon.totalMinor)}
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="by-event" className={`${CARD} p-6`}>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 id="by-event" className="font-headline-sm text-headline-sm text-primary">
            Spending by event
          </h2>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Total {money(summary.totalCostMinor)}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {summary.byEvent.map((row) => (
            <li
              key={row.eventId ?? "unlinked"}
              className="rounded-xl border border-[#2A2622]/[0.05] bg-surface-container-low p-4"
            >
              <p className="truncate font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
                {row.name}
              </p>
              <p className="mt-1 font-headline-sm text-headline-sm text-on-surface">
                {money(row.costMinor)}
              </p>
              <p className="mt-0.5 font-body-sm text-[12px] text-on-surface-variant">
                {row.sharePercent}% of spend
              </p>
            </li>
          ))}
        </ul>
      </section>

      {!canSetBudget ? (
        <p className="flex items-center gap-2 rounded-lg bg-surface-container px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="lock" className="text-[16px]" />
          The overall wedding budget is visible to owners and admins only.
        </p>
      ) : null}
    </div>
  );
}

function BudgetHero({
  summary,
  currency,
  paidWidth,
  toPayWidth,
  canSetBudget,
  onSetBudget,
}: {
  summary: ExpenseSummaryDto;
  currency: string;
  paidWidth: number;
  toPayWidth: number;
  canSetBudget: boolean;
  onSetBudget: () => void;
}) {
  const money = (minor: number) => formatMoney(minor, currency);
  const budget = summary.budgetTotalMinor;
  return (
    <section aria-labelledby="budget-hero" className={`${CARD} p-6 md:p-8`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="budget-hero" className="sr-only">
            Budget summary
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-[40px] leading-tight font-normal text-primary md:text-[48px]">
              {money(summary.totalCostMinor)}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant">
              planned spend
              {budget !== null ? ` of ${money(budget)} total budget` : ""}
            </span>
          </p>
        </div>
        {summary.committedPercent !== null ? (
          <span
            className={`rounded px-3 py-1 font-label-md text-[11px] font-semibold tracking-wider uppercase ${
              summary.committedPercent > 100
                ? "bg-error-container text-on-error-container"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {summary.committedPercent}% committed
          </span>
        ) : null}
      </div>

      <div
        role="img"
        aria-label={`Paid ${money(summary.totalPaidMinor)}, still to pay ${money(summary.stillToPayMinor)}`}
        className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
      >
        <div className="h-full bg-primary" style={{ width: `${paidWidth}%` }} />
        <div className="h-full bg-secondary" style={{ width: `${toPayWidth}%` }} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-[#2A2622]/[0.06] pt-6 md:grid-cols-4">
        <div>
          <dt className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
            Total budget
          </dt>
          <dd className="mt-1 font-headline-sm text-headline-sm text-on-surface">
            {budget !== null ? (
              money(budget)
            ) : canSetBudget ? (
              <span className="text-on-surface-variant">Not set</span>
            ) : (
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <Icon name="lock" className="text-[16px]" />
                Owners only
              </span>
            )}
            {canSetBudget ? (
              <button
                type="button"
                onClick={onSetBudget}
                className="mt-1 block font-body-sm text-[12px] font-medium text-secondary underline-offset-2 hover:underline"
              >
                {budget !== null ? "Change budget" : "Set budget"}
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
            Total cost
          </dt>
          <dd className="mt-1 font-headline-sm text-headline-sm text-on-surface">
            {money(summary.totalCostMinor)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Paid
          </dt>
          <dd className="mt-1 font-headline-sm text-headline-sm text-on-surface">
            {money(summary.totalPaidMinor)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            Still to pay
          </dt>
          <dd className="mt-1 font-headline-sm text-headline-sm text-secondary">
            {money(summary.stillToPayMinor)}
          </dd>
        </div>
      </dl>
      <p className="mt-5 flex items-center gap-2 font-body-sm text-[12px] text-on-surface-variant italic">
        <Icon name="info" className="text-[14px]" />
        Where an amount isn&apos;t agreed yet, your estimate is used.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ Ledger

function Ledger({
  expenses,
  events,
  vendors,
  currency,
  filters,
  onFilters,
  shown,
  onShowMore,
  menuItems,
  onAdd,
}: {
  expenses: ExpenseDto[];
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  currency: string;
  filters: LedgerFilters;
  onFilters: (filters: LedgerFilters) => void;
  shown: number;
  onShowMore: () => void;
  menuItems: ReturnType<typeof useExpenseActions>["menuItems"];
  onAdd: () => void;
}) {
  const money = (minor: number) => formatMoney(minor, currency);
  const visible = applyLedgerFilters(expenses, filters);
  const totals = ledgerTotals(visible);
  const categories = [...new Set(expenses.map((expense) => expense.category))];

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="receipt_long"
        title="No expenses yet"
        message="Record what you spend as you book. Everyone on your team can add an expense and see the whole list in one place."
        action={
          <button type="button" onClick={onAdd} className={BUTTON_PRIMARY}>
            <Icon name="add" className="text-[18px]" />
            Add your first expense
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterPill
            label="Category"
            value={filters.category}
            onChange={(category) =>
              onFilters({ ...filters, category: category as LedgerFilters["category"] })
            }
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((value: ExpenseCategory) => ({
                value,
                label: EXPENSE_CATEGORY_LABEL[value],
              })),
            ]}
          />
          <FilterPill
            label="Event"
            value={filters.event}
            onChange={(event) => onFilters({ ...filters, event })}
            options={[
              { value: "all", label: "All events" },
              ...events.map((event) => ({ value: event.id, label: event.name })),
              { value: "none", label: "No event" },
            ]}
          />
          <FilterPill
            label="Vendor"
            value={filters.vendor}
            onChange={(vendor) => onFilters({ ...filters, vendor })}
            options={[
              { value: "all", label: "All vendors" },
              ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
              { value: "none", label: "No vendor" },
            ]}
          />
          <DateRangePill filters={filters} onChange={onFilters} />
        </div>
        <button
          type="button"
          onClick={() => onFilters(NO_LEDGER_FILTERS)}
          disabled={!hasLedgerFilters(filters)}
          className="px-2 py-1 font-body-sm text-body-sm font-medium text-secondary underline-offset-2 transition-colors hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
        >
          Clear filters
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="No expenses match these filters"
          message="Try a different category, event, vendor or date range."
          action={
            <button
              type="button"
              onClick={() => onFilters(NO_LEDGER_FILTERS)}
              className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <caption className="sr-only">
                Every expense, with what is agreed, paid and still to pay
              </caption>
              <thead>
                <tr className="bg-surface-container-low">
                  {["Expense", "Date", "Vendor", "Event"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3.5 font-label-md text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                  {["Estimated", "Agreed", "Paid", "Remaining"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3.5 text-right font-label-md text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-4 py-3.5 font-label-md text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase"
                  >
                    Progress
                  </th>
                  <th scope="col" className="px-3 py-3.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2622]/[0.06]">
                {visible.slice(0, shown).map((expense) => {
                  const settled = expense.costMinor > 0 && expense.remainingAmountMinor === 0;
                  return (
                    <tr
                      key={expense.id}
                      className="transition-colors hover:bg-surface-container-low/60"
                    >
                      <td className="max-w-[220px] px-4 py-4">
                        <Link
                          href={`/dashboard/expenses/${expense.id}`}
                          className="font-title text-body-sm font-semibold text-on-surface underline-offset-2 hover:text-primary hover:underline"
                        >
                          {expense.title}
                        </Link>
                        <div className="mt-1.5">
                          <Chip>{EXPENSE_CATEGORY_LABEL[expense.category]}</Chip>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-body-sm text-body-sm whitespace-nowrap text-on-surface-variant">
                        {expense.expenseDate ? formatShortDate(expense.expenseDate) : "–"}
                      </td>
                      <td className="px-4 py-4 font-body-sm text-body-sm text-on-surface-variant">
                        {expense.vendorName ?? "–"}
                      </td>
                      <td className="px-4 py-4">
                        <Chip>{expense.eventName ?? "All events"}</Chip>
                      </td>
                      <td className="px-4 py-4 text-right font-body-sm text-body-sm whitespace-nowrap text-on-surface-variant">
                        {expense.estimatedAmountMinor !== null
                          ? money(expense.estimatedAmountMinor)
                          : "–"}
                      </td>
                      <td className="px-4 py-4 text-right font-body-sm text-body-sm whitespace-nowrap text-on-surface">
                        {expense.agreedAmountMinor !== null
                          ? money(expense.agreedAmountMinor)
                          : "–"}
                      </td>
                      <td className="px-4 py-4 text-right font-body-sm text-body-sm whitespace-nowrap text-primary">
                        <span className="inline-flex items-center gap-1.5">
                          {money(expense.paidAmountMinor)}
                          {settled ? <Icon name="check_circle" className="text-[15px]" /> : null}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-body-sm text-body-sm whitespace-nowrap ${
                          expense.remainingAmountMinor > 0
                            ? "text-secondary"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {money(expense.remainingAmountMinor)}
                      </td>
                      <td className="w-32 px-4 py-4">
                        <ProgressBar
                          percent={paidPercent(expense.costMinor, expense.paidAmountMinor)}
                          label={`${expense.title} paid so far`}
                          tone={settled ? "green" : "terracotta"}
                        />
                      </td>
                      <td className="px-3 py-4 text-right">
                        <EventMenu
                          eventName={expense.title}
                          items={menuItems(expense)}
                          trigger="inline"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2A2622]/[0.08] bg-surface-container-low px-4 py-4">
            <p className="font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Cumulative ledger balance
            </p>
            <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 font-body-sm text-body-sm">
              <TotalItem label="Estimated" value={money(totals.estimatedMinor)} />
              <TotalItem label="Agreed" value={money(totals.agreedMinor)} />
              <TotalItem label="Paid" value={money(totals.paidMinor)} tone="green" />
              <TotalItem label="Remaining" value={money(totals.remainingMinor)} tone="terracotta" />
            </dl>
          </div>

          <div className="flex items-center justify-between border-t border-[#2A2622]/[0.06] px-4 py-4 font-body-sm text-body-sm text-on-surface-variant">
            <span>
              Showing {Math.min(shown, visible.length)} of {visible.length} expenses
            </span>
            {shown < visible.length ? (
              <button
                type="button"
                onClick={onShowMore}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Load more
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function TotalItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "terracotta";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd
        className={`font-title font-semibold ${tone === "green" ? "text-primary" : tone === "terracotta" ? "text-secondary" : "text-on-surface"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** "Date: All dates": a pill that opens a small popover with a From and a To day. */
function DateRangePill({
  filters,
  onChange,
}: {
  filters: LedgerFilters;
  onChange: (filters: LedgerFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    filters.from && filters.to
      ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
      : filters.from
        ? `From ${formatShortDate(filters.from)}`
        : filters.to
          ? `Until ${formatShortDate(filters.to)}`
          : "All dates";
  const invalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-on-background/10 bg-surface-container-lowest px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface transition-all hover:border-on-background/20 focus:border-primary/50 focus:outline-hidden"
      >
        <span className="text-on-surface-variant">Date:</span>
        <span className="font-medium text-primary">{label}</span>
        <Icon name="calendar_today" className="text-[16px]" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Filter by expense date"
          className="elevation-2 absolute left-0 z-30 mt-2 w-72 space-y-3 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] p-4"
        >
          <label className="block">
            <span className="mb-1 block font-label-md text-label-md font-semibold text-[#2A2622]">
              From
            </span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => onChange({ ...filters, from: event.target.value })}
              className="w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3 py-2 font-body-sm text-body-sm outline-none focus:border-[#1F4D3D]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-label-md text-label-md font-semibold text-[#2A2622]">
              To
            </span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => onChange({ ...filters, to: event.target.value })}
              className="w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3 py-2 font-body-sm text-body-sm outline-none focus:border-[#1F4D3D]"
            />
          </label>
          {invalid ? (
            <p role="alert" className="text-[12px] text-error">
              The end date is before the start date.
            </p>
          ) : null}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => onChange({ ...filters, from: "", to: "" })}
              className="font-body-sm text-body-sm font-medium text-secondary hover:underline"
            >
              Clear dates
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-body-sm text-body-sm font-medium text-primary hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
