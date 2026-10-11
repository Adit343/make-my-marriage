"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventMenu } from "@/components/events/event-menu";
import { Chip, EmptyState } from "@/components/finance/ui";
import { useExpenseActions } from "@/components/finance/use-expense-actions";
import { useVendorActions } from "@/components/finance/use-vendor-actions";
import { VENDOR_STATUS_TONE } from "@/components/finance/vendors-manager";
import { addressLine } from "@/components/finance/vendor-drawer";
import { Icon } from "@/components/ui/icon";
import { formatShortDate } from "@/lib/dates";
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL } from "@/lib/finance/labels";
import { formatMoney, remainingOf } from "@/lib/finance/money";
import { formatPhone } from "@/lib/guests/phone";
import { instantToWallClock } from "@/lib/zoned-time";
import type { VendorDetailDto } from "@/modules/vendors/vendor.service";

// Stitch screen "Vendor Detail". Contact details, what is agreed and paid across the vendor's
// expenses, and the payments still to make. Owners and admins only (decision D3).

const CARD = "rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest";

export function VendorDetail({
  weddingId,
  currency,
  timezone,
  detail,
  events,
  vendorChoices,
  placesConfigured,
}: {
  weddingId: string;
  currency: string;
  timezone: string;
  detail: VendorDetailDto;
  events: { id: string; name: string }[];
  vendorChoices: { id: string; name: string }[];
  placesConfigured: boolean;
}) {
  const router = useRouter();
  const { vendor, expenses, milestones } = detail;
  const money = (minor: number) => formatMoney(minor, currency);
  const actions = useVendorActions({
    weddingId,
    placesConfigured,
    afterDelete: () => router.push("/dashboard/vendors"),
  });
  const expenseActions = useExpenseActions({
    weddingId,
    currency,
    timezone,
    events,
    vendors: vendorChoices,
    canRecordPayments: true,
  });

  const contact = vendor.contact;
  const address = addressLine(vendor.location);
  const mapsHref =
    address || vendor.location?.placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || vendor.name)}${
          vendor.location?.placeId
            ? `&query_place_id=${encodeURIComponent(vendor.location.placeId)}`
            : ""
        }`
      : null;

  const { costMinor, paidMinor } = vendor.money;
  const remaining = remainingOf(costMinor, paidMinor);
  const paidShare = costMinor > 0 ? Math.min(100, Math.round((paidMinor / costMinor) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-10">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant"
      >
        <Link href="/dashboard/vendors" className="hover:text-primary hover:underline">
          Vendors
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-medium text-on-surface">
          {vendor.name}
        </span>
      </nav>

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
            {vendor.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip>{VENDOR_CATEGORY_LABEL[vendor.category]}</Chip>
            <Chip tone={VENDOR_STATUS_TONE[vendor.status]} dot>
              {VENDOR_STATUS_LABEL[vendor.status]}
            </Chip>
            {vendor.source === "google_places" ? (
              <Chip tone="grey">Found on Google Maps</Chip>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => actions.openDrawer({ kind: "edit", vendor })}
            className="flex items-center gap-2 rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
          >
            <Icon name="edit" className="text-[17px]" />
            Edit
          </button>
          <EventMenu
            eventName={vendor.name}
            items={actions.menuItems(vendor, { includeView: false })}
            trigger="horizontal"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section
          aria-labelledby="contact-heading"
          className={`${CARD} space-y-5 p-6 lg:col-span-2`}
        >
          <h2
            id="contact-heading"
            className="font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
          >
            Contact
          </h2>
          <dl className="space-y-4 font-body-sm text-body-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Contact person
              </dt>
              <dd className="mt-1 text-on-surface">{contact?.personName ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Phone
              </dt>
              <dd className="mt-1 flex items-center gap-3 text-on-surface">
                {contact?.phone ? (
                  <>
                    {formatPhone(contact.phone)}
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Call
                      <Icon name="north_east" className="text-[14px]" />
                    </a>
                  </>
                ) : (
                  "–"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Email
              </dt>
              <dd className="mt-1 break-all text-on-surface">
                {contact?.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : (
                  "–"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Website
              </dt>
              <dd className="mt-1 break-all text-on-surface">
                {contact?.website ? (
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                  >
                    <Icon name="link" className="text-[15px]" />
                    {contact.website}
                  </a>
                ) : (
                  "–"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Address
              </dt>
              <dd className="mt-1 text-on-surface">{address || "–"}</dd>
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <Icon name="location_on" className="text-[16px]" />
                  Open in Maps
                  <Icon name="north_east" className="text-[14px]" />
                </a>
              ) : null}
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="financial-heading"
          className={`${CARD} space-y-6 p-6 lg:col-span-3`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="financial-heading" className="font-headline-sm text-headline-sm text-primary">
              Financial summary
            </h2>
            <button
              type="button"
              onClick={() => expenseActions.openDrawer({ kind: "create", vendorId: vendor.id })}
              className="flex items-center gap-1.5 rounded-lg border border-[#D5CCC0] px-3.5 py-1.5 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
            >
              <Icon name="add" className="text-[16px]" />
              Add expense for this vendor
            </button>
          </div>

          <dl className="grid grid-cols-3 gap-4 rounded-xl bg-surface-container-low p-4">
            <div>
              <dt className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
                Total agreed
              </dt>
              <dd className="mt-1 font-headline-sm text-headline-sm text-on-surface">
                {money(costMinor)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Paid to date
              </dt>
              <dd className="mt-1 font-headline-sm text-headline-sm text-on-surface">
                {money(paidMinor)}
              </dd>
            </div>
            <div>
              <dt className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
                Remaining balance
              </dt>
              <dd className="mt-1 font-headline-sm text-headline-sm text-secondary">
                {money(remaining)}
              </dd>
            </div>
          </dl>

          {costMinor > 0 ? (
            <div>
              <div
                role="progressbar"
                aria-label="Paid to this vendor"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={paidShare}
                className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/25"
              >
                <div className="h-full bg-primary" style={{ width: `${paidShare}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-body-sm text-[11px] text-on-surface-variant">
                <span>{paidShare}% paid</span>
                <span>{100 - paidShare}% still to pay</span>
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Linked expenses
            </h3>
            {expenses.length === 0 ? (
              <p className="rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant italic">
                No expenses linked yet. Add one to track what you owe this vendor.
              </p>
            ) : (
              <ul className="space-y-2">
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A2622]/[0.06] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon name="receipt_long" className="text-[18px] text-on-surface-variant" />
                      <p className="min-w-0 truncate font-title text-body-sm font-semibold text-on-surface">
                        {expense.title}
                        {expense.eventName ? (
                          <span className="font-normal text-on-surface-variant">
                            {" "}
                            • {expense.eventName}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 font-body-sm text-body-sm">
                      <span className="text-on-surface-variant">
                        Agreed: <span className="text-on-surface">{money(expense.costMinor)}</span>
                      </span>
                      <span className="text-on-surface-variant">
                        Paid: <span className="text-primary">{money(expense.paidAmountMinor)}</span>
                      </span>
                      <Link
                        href={`/dashboard/expenses/${expense.id}`}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        View expense
                        <Icon name="north_east" className="text-[14px]" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
              <Icon name="schedule" className="text-[15px]" />
              Payment milestones
            </h3>
            {milestones.length === 0 ? (
              <p className="rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant italic">
                No payments recorded for this vendor yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {milestones.map((milestone) => (
                  <li key={milestone.id}>
                    <Link
                      href={`/dashboard/expenses/${milestone.expenseId}`}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-surface-container-low ${
                        milestone.isOverdue
                          ? "border-secondary/30 bg-secondary-fixed/20"
                          : "border-[#2A2622]/[0.06]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 font-body-sm text-body-sm">
                        {milestone.status === "paid" ? (
                          <Chip tone="green" dot>
                            Paid
                          </Chip>
                        ) : milestone.isOverdue ? (
                          <Chip tone="terracotta" dot>
                            Overdue
                          </Chip>
                        ) : (
                          <Chip tone="neutral" dot>
                            Pending
                          </Chip>
                        )}
                        <span className="text-on-surface">
                          {milestone.status === "paid" && milestone.paidAt
                            ? formatShortDate(
                                instantToWallClock(new Date(milestone.paidAt), timezone).slice(
                                  0,
                                  10,
                                ),
                              )
                            : milestone.dueDate
                              ? `Due ${formatShortDate(milestone.dueDate)}`
                              : "No due date"}
                        </span>
                        <span className="text-on-surface-variant">• {milestone.expenseTitle}</span>
                      </div>
                      <span className="font-title text-body-sm font-semibold text-on-surface">
                        {money(milestone.amountMinor)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="vendor-notes-heading" className={`${CARD} p-6`}>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="lock" className="text-[18px] text-on-surface-variant" />
          <h2 id="vendor-notes-heading" className="font-headline-sm text-headline-sm text-primary">
            Private notes
          </h2>
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Terms, quotes and reminders. Never share bank or card details here.
          </span>
        </div>
        {vendor.notes ? (
          <p className="font-body-md text-body-md whitespace-pre-line text-on-surface">
            {vendor.notes}
          </p>
        ) : (
          <EmptyState
            icon="sticky_note_2"
            title="No notes yet"
            message="Use Edit to add the terms, quotes or reminders for this vendor."
          />
        )}
      </section>

      {actions.overlays}
      {expenseActions.overlays}
    </div>
  );
}
