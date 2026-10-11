"use client";

import { useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/components/finance/drawer-shell";
import {
  createVendor,
  searchPlaces,
  updateVendor,
  type PlaceResult,
  type VendorInput,
} from "@/components/finance/finance-api";
import { Field, FIELD, SelectField } from "@/components/finance/ui";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  type VendorCategory,
  type VendorStatus,
} from "@/lib/constants/enums";
import { MAX_VENDOR_NAME, MAX_VENDOR_NOTES, MAX_VENDOR_PERSON } from "@/lib/constants/finance";
import { VENDOR_CATEGORY_LABEL, VENDOR_STATUS_LABEL } from "@/lib/finance/labels";
import { phoneForInput, toE164 } from "@/lib/guests/phone";
import type { VendorDto, VendorLocationDto } from "@/modules/vendors/vendor.dto";

// The "Add vendor" slide-over from the Stitch design: an optional Google Places search on top of an
// ordinary form. Nothing is saved until "Save vendor" (DB Design §6.13): search results are only
// suggestions. Only the place id and what the member confirms are stored (DB Design §15 item 8).

export type VendorDrawerMode = { kind: "create" } | { kind: "edit"; vendor: VendorDto };

/** One line for the address box: the street line, then city and state. */
export function addressLine(location: VendorLocationDto | null): string {
  const address = location?.address;
  if (!address) return "";
  return [address.line1, address.line2, address.city, address.state].filter(Boolean).join(", ");
}

/** What the API takes back from a stored location: the same fields without the nulls. */
function locationToInput(location: VendorLocationDto): NonNullable<VendorInput["location"]> {
  const address = location.address;
  return {
    ...(location.label ? { label: location.label } : {}),
    ...(address
      ? {
          address: {
            ...(address.line1 ? { line1: address.line1 } : {}),
            ...(address.city ? { city: address.city } : {}),
            ...(address.state ? { state: address.state } : {}),
          },
        }
      : {}),
    ...(location.placeId ? { placeId: location.placeId } : {}),
  };
}

const SEARCH_DELAY_MS = 400;

export function VendorDrawer({
  weddingId,
  mode,
  placesConfigured,
  onClose,
  onSaved,
}: {
  weddingId: string;
  mode: VendorDrawerMode;
  placesConfigured: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = mode.kind === "edit";
  const initial = mode.kind === "edit" ? mode.vendor : null;
  const initialAddress = addressLine(initial?.location ?? null);

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<VendorCategory>(initial?.category ?? "photographer");
  const [status, setStatus] = useState<VendorStatus>(initial?.status ?? "shortlisted");
  const [person, setPerson] = useState(initial?.contact?.personName ?? "");
  const [phone, setPhone] = useState(phoneForInput(initial?.contact?.phone ?? null));
  const [email, setEmail] = useState(initial?.contact?.email ?? "");
  const [website, setWebsite] = useState(initial?.contact?.website ?? "");
  const [address, setAddress] = useState(initialAddress);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [placeId, setPlaceId] = useState<string | null>(initial?.location?.placeId ?? null);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  // ---- Places search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!placesConfigured) return;
    const text = query.trim();
    if (text.length < 2) return;
    const timer = setTimeout(async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setSearching(true);
      try {
        const found = await searchPlaces(weddingId, text);
        if (controller.signal.aborted) return;
        setResults(found.results);
        setSearchNote(
          found.unavailable
            ? "Business search is unavailable right now. You can type the details instead."
            : found.results.length === 0
              ? "No businesses found. Try another search or type the details below."
              : null,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchNote(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, weddingId, placesConfigured]);

  // Results of an earlier, longer search are not shown once the box is nearly empty again.
  const searchActive = query.trim().length >= 2;
  const shownResults = searchActive ? results : [];
  const shownNote = searchActive ? searchNote : null;

  function pick(place: PlaceResult) {
    setChosen(place.placeId);
    setPlaceId(place.placeId);
    setName(place.name);
    setAddress(place.address);
    setErrors((current) => ({ ...current, name: undefined }));
  }

  async function save() {
    const next: typeof errors = {};
    const cleanName = name.trim();
    if (!cleanName) next.name = "Name required";
    const phoneE164 = phone.trim() ? toE164(phone) : null;
    if (phone.trim() && !phoneE164) next.phone = "Enter a valid phone number";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email";
    const cleanWebsite = website.trim();
    if (cleanWebsite && !/^https:\/\/\S+\.\S+/i.test(cleanWebsite)) {
      next.website = "Must start with https://";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const contact: NonNullable<VendorInput["contact"]> = {
      ...(person.trim() ? { personName: person.trim() } : {}),
      ...(phoneE164 ? { phone: phoneE164 } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(cleanWebsite ? { website: cleanWebsite } : {}),
    };
    const cleanAddress = address.trim();
    // An address left as it was keeps everything stored with it (city, state, place id); one that
    // was changed or typed becomes a single line, carrying the place id only if a place was picked.
    const location: VendorInput["location"] =
      initial?.location && cleanAddress === initialAddress
        ? locationToInput(initial.location)
        : cleanAddress || placeId
          ? {
              label: cleanName,
              ...(cleanAddress ? { address: { line1: cleanAddress } } : {}),
              ...(chosen ? { placeId: chosen } : {}),
            }
          : null;

    const input: VendorInput = {
      name: cleanName,
      category,
      status,
      contact: Object.keys(contact).length > 0 ? contact : null,
      location,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await updateVendor(weddingId, mode.vendor.id, mode.vendor.version, input);
      } else {
        await createVendor(weddingId, input, chosen ? "google_places" : "manual");
      }
      toast({
        type: "success",
        title: editing ? "Vendor updated" : "Vendor added",
        message: cleanName,
      });
      onSaved();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this vendor"
            : "Couldn't save the vendor",
        message: errorMessage(error),
      });
    }
  }

  return (
    <DrawerShell
      id="vendor-drawer"
      title={editing ? "Edit vendor" : "Add vendor"}
      note="Owners and admins only"
      saveLabel="Save vendor"
      saving={saving}
      onClose={onClose}
      onSubmit={save}
    >
      {!editing ? (
        <div className="space-y-2">
          <label
            htmlFor="vendor-search"
            className="block font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
          >
            Search for a business
          </label>
          {placesConfigured ? (
            <>
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
                <input
                  id="vendor-search"
                  type="search"
                  autoComplete="off"
                  placeholder="e.g., photographers in Surat"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${FIELD} pl-10`}
                />
                {searching ? (
                  <Icon
                    name="progress_activity"
                    className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-[18px] text-on-surface-variant"
                  />
                ) : null}
              </div>
              {shownResults.length > 0 ? (
                <ul
                  aria-label="Search results"
                  className="elevation-2 overflow-hidden rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9]"
                >
                  {shownResults.map((place) => (
                    <li
                      key={place.placeId}
                      className="border-b border-[#2A2622]/[0.05] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => pick(place)}
                        aria-pressed={chosen === place.placeId}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low"
                      >
                        <Icon name="storefront" className="text-[18px] text-on-surface-variant" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-title text-body-sm font-medium text-on-surface">
                            {place.name}
                          </span>
                          <span className="block truncate font-body-sm text-[12px] text-on-surface-variant">
                            {place.address}
                          </span>
                        </span>
                        {chosen === place.placeId ? (
                          <Icon name="check" className="text-[18px] text-primary" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {shownNote ? (
                <p role="status" className="font-body-sm text-[12px] text-on-surface-variant">
                  {shownNote}
                </p>
              ) : null}
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Results come from Google Maps. Nothing is saved until you add the vendor. Powered by
                Google Places.
              </p>
            </>
          ) : (
            <p
              id="vendor-search"
              className="rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant"
            >
              Business search isn&apos;t set up yet, so type the vendor&apos;s details below.
            </p>
          )}
        </div>
      ) : null}

      <Field label="Vendor name" htmlFor="vendor-name" required error={errors.name}>
        <input
          id="vendor-name"
          type="text"
          autoComplete="off"
          maxLength={MAX_VENDOR_NAME}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (event.target.value.trim())
              setErrors((current) => ({ ...current, name: undefined }));
          }}
          aria-invalid={Boolean(errors.name)}
          className={`${FIELD} ${errors.name ? "border-error" : ""}`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="vendor-category">
          <SelectField
            id="vendor-category"
            value={category}
            onChange={(value) => setCategory(value as VendorCategory)}
          >
            {VENDOR_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {VENDOR_CATEGORY_LABEL[value]}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Status" htmlFor="vendor-status">
          <SelectField
            id="vendor-status"
            value={status}
            onChange={(value) => setStatus(value as VendorStatus)}
          >
            {VENDOR_STATUSES.map((value) => (
              <option key={value} value={value}>
                {VENDOR_STATUS_LABEL[value]}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <Field label="Contact person" htmlFor="vendor-person" optional>
        <input
          id="vendor-person"
          type="text"
          autoComplete="off"
          maxLength={MAX_VENDOR_PERSON}
          value={person}
          onChange={(event) => setPerson(event.target.value)}
          className={FIELD}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="vendor-phone" error={errors.phone}>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-body-sm text-body-sm text-on-surface-variant"
            >
              +91
            </span>
            <input
              id="vendor-phone"
              type="tel"
              autoComplete="off"
              placeholder="98250 14820"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              className={`${FIELD} pl-12 ${errors.phone ? "border-error" : ""}`}
            />
          </div>
        </Field>
        <Field label="Email" htmlFor="vendor-email" error={errors.email}>
          <input
            id="vendor-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            className={`${FIELD} ${errors.email ? "border-error" : ""}`}
          />
        </Field>
      </div>

      <Field
        label="Website"
        htmlFor="vendor-website"
        error={errors.website}
        hint="Must start with https://"
      >
        <input
          id="vendor-website"
          type="url"
          autoComplete="off"
          placeholder="https://"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          aria-invalid={Boolean(errors.website)}
          className={`${FIELD} ${errors.website ? "border-error" : ""}`}
        />
      </Field>

      <Field label="Address" htmlFor="vendor-address" hint="Type the full address">
        <div className="relative">
          <Icon
            name="location_on"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
          <input
            id="vendor-address"
            type="text"
            autoComplete="off"
            maxLength={200}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={`${FIELD} pl-10`}
          />
        </div>
      </Field>

      <Field
        label="Notes"
        htmlFor="vendor-notes"
        optional
        hint="Terms, quotes and reminders. Never share bank or card details here."
      >
        <textarea
          id="vendor-notes"
          rows={4}
          maxLength={MAX_VENDOR_NOTES}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`${FIELD} resize-none font-body-sm text-body-sm`}
        />
      </Field>
    </DrawerShell>
  );
}
