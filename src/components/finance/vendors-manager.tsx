"use client";

import Link from "next/link";
import { useState } from "react";
import { EventMenu } from "@/components/events/event-menu";
import { addressLine } from "@/components/finance/vendor-drawer";
import { BUTTON_PRIMARY, Chip, EmptyState, FilterPill } from "@/components/finance/ui";
import { useVendorActions } from "@/components/finance/use-vendor-actions";
import { Icon } from "@/components/ui/icon";
import { VENDOR_CATEGORIES, type VendorStatus } from "@/lib/constants/enums";
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL } from "@/lib/finance/labels";
import { formatMoney } from "@/lib/finance/money";
import { formatPhone } from "@/lib/guests/phone";
import { initialsOf } from "@/lib/text/initials";
import { normalizeName } from "@/lib/text/normalize";
import type { VendorDto } from "@/modules/vendors/vendor.dto";

// Stitch screen "Vendors List". The vendors the wedding is considering or has hired: not a
// marketplace. Owners and admins only (decision D3).

export const VENDOR_STATUS_TONE: Record<VendorStatus, "green" | "terracotta" | "red" | "neutral"> =
  {
    booked: "green",
    contacted: "terracotta",
    shortlisted: "neutral",
    rejected: "red",
  };

export function VendorsManager({
  weddingId,
  currency,
  vendors,
  placesConfigured,
}: {
  weddingId: string;
  currency: string;
  vendors: VendorDto[];
  placesConfigured: boolean;
}) {
  const actions = useVendorActions({ weddingId, placesConfigured });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const count = (value: VendorStatus) => vendors.filter((vendor) => vendor.status === value).length;
  const needle = normalizeName(search);
  const visible = vendors.filter(
    (vendor) =>
      (category === "all" || vendor.category === category) &&
      (status === "all" || vendor.status === status) &&
      (needle === "" || normalizeName(vendor.name).includes(needle)),
  );
  const filtering = search !== "" || category !== "all" || status !== "all";
  const usedCategories = VENDOR_CATEGORIES.filter((value) =>
    vendors.some((vendor) => vendor.category === value),
  );

  function clear() {
    setSearch("");
    setCategory("all");
    setStatus("all");
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
            Vendors
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Everyone you&apos;re considering or have booked.
          </p>
        </div>
        <button
          type="button"
          onClick={() => actions.openDrawer({ kind: "create" })}
          className={BUTTON_PRIMARY}
        >
          <Icon name="add" className="text-[18px]" />
          <span>Add vendor</span>
        </button>
      </div>

      <section aria-label="Vendor numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total directory" value={vendors.length} unit="vendors" />
        <Stat label="Booked" value={count("booked")} unit="booked" tone="green" />
        <Stat label="Shortlisted" value={count("shortlisted")} unit="shortlisted" tone="grey" />
        <Stat
          label="In discussion"
          value={count("contacted") + count("rejected")}
          unit="contacted or rejected"
          tone="terracotta"
        />
      </section>

      {vendors.length === 0 ? (
        <EmptyState
          icon="storefront"
          title="No vendors yet"
          message="Add the photographers, caterers, decorators and venues you're considering or have booked, then link their costs from Expenses."
          action={
            <button
              type="button"
              onClick={() => actions.openDrawer({ kind: "create" })}
              className={BUTTON_PRIMARY}
            >
              <Icon name="add" className="text-[18px]" />
              Add your first vendor
            </button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest p-4">
            <div className="relative min-w-[200px] flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
              />
              <input
                type="search"
                aria-label="Search vendors"
                placeholder="Search vendors..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-[#2A2622]/10 bg-surface px-3.5 py-2 pl-10 font-body-sm text-body-sm outline-none placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D]"
              />
            </div>
            <FilterPill
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "All categories" },
                ...usedCategories.map((value) => ({
                  value,
                  label: VENDOR_CATEGORY_LABEL[value],
                })),
              ]}
            />
            <FilterPill
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All" },
                { value: "booked", label: VENDOR_STATUS_LABEL.booked },
                { value: "shortlisted", label: VENDOR_STATUS_LABEL.shortlisted },
                { value: "contacted", label: VENDOR_STATUS_LABEL.contacted },
                { value: "rejected", label: VENDOR_STATUS_LABEL.rejected },
              ]}
            />
            <button
              type="button"
              onClick={clear}
              disabled={!filtering}
              className="px-2 py-1 font-body-sm text-body-sm font-medium text-secondary underline-offset-2 hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
            >
              Clear filters
            </button>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon="storefront"
              title="No vendors match these filters"
              message="Try a different name, category or status."
              action={
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  currency={currency}
                  menu={
                    <EventMenu
                      eventName={vendor.name}
                      items={actions.menuItems(vendor)}
                      trigger="inline"
                    />
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      {actions.overlays}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone?: "green" | "grey" | "terracotta";
}) {
  const dot = { green: "bg-primary", grey: "bg-outline", terracotta: "bg-secondary" } as const;
  const color = tone === "terracotta" ? "text-secondary" : "text-primary";
  return (
    <div className="rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest p-5">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
          {label}
        </span>
        {tone ? <span className={`h-2 w-2 rounded-full ${dot[tone]}`} /> : null}
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className={`font-headline-md text-headline-md ${color}`}>{value}</span>
        <span
          className={`font-body-md text-body-md ${tone === "terracotta" ? "text-secondary" : "text-on-surface-variant"}`}
        >
          {unit}
        </span>
      </p>
    </div>
  );
}

function VendorCard({
  vendor,
  currency,
  menu,
}: {
  vendor: VendorDto;
  currency: string;
  menu: React.ReactNode;
}) {
  const person = vendor.contact?.personName;
  const phone = vendor.contact?.phone ? formatPhone(vendor.contact.phone) : null;
  const place = vendor.location?.address?.city
    ? [vendor.location.address.line1, vendor.location.address.city].filter(Boolean).join(", ")
    : addressLine(vendor.location);
  const money = (minor: number) => formatMoney(minor, currency);
  return (
    <li className="flex flex-col rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed/50 font-headline-sm text-headline-sm text-primary"
        >
          {initialsOf(vendor.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            <Link
              href={`/dashboard/vendors/${vendor.id}`}
              className="underline-offset-2 hover:text-primary hover:underline"
            >
              {vendor.name}
            </Link>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip>{VENDOR_CATEGORY_LABEL[vendor.category]}</Chip>
            <Chip tone={VENDOR_STATUS_TONE[vendor.status]} dot>
              {VENDOR_STATUS_LABEL[vendor.status]}
            </Chip>
          </div>
        </div>
        <div className="-mt-1 -mr-1">{menu}</div>
      </div>

      <div className="mt-4 min-h-[56px] space-y-2 border-t border-[#2A2622]/[0.06] pt-4 font-body-sm text-body-sm text-on-surface-variant">
        {person || phone ? (
          <p className="flex items-center gap-2">
            <Icon name="person_outline" className="text-[16px]" />
            <span className="truncate">{[person, phone].filter(Boolean).join(" • ")}</span>
          </p>
        ) : null}
        {place ? (
          <p className="flex items-center gap-2">
            <Icon name="location_on" className="text-[16px]" />
            <span className="truncate">{place}</span>
          </p>
        ) : null}
        {!person && !phone && !place ? <p className="italic">No contact details yet</p> : null}
      </div>

      <div className="mt-auto border-t border-[#2A2622]/[0.06] pt-4 font-body-sm text-body-sm">
        {vendor.money.expenseCount === 0 ? (
          <p className="text-on-surface-variant italic">No expenses linked yet</p>
        ) : (
          <p className="flex items-center gap-2 text-on-surface">
            <span>Agreed {money(vendor.money.costMinor)}</span>
            <span aria-hidden="true" className="text-on-surface-variant">
              •
            </span>
            <span className="text-secondary">Paid {money(vendor.money.paidMinor)}</span>
          </p>
        )}
      </div>
    </li>
  );
}
