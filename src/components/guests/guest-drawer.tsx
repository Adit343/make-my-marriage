"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createGroup,
  createGuest,
  updateGuest,
  type GuestInput,
} from "@/components/guests/guests-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import {
  AGE_CATEGORIES,
  type AgeCategory,
  type DietaryPreference,
  type GuestSide,
} from "@/lib/constants/enums";
import {
  MAX_GUEST_NAME,
  MAX_GUEST_NOTES,
  MAX_GUEST_RELATION,
  MAX_PLUS_ONES,
} from "@/lib/constants/guests";
import { phoneForInput, toE164 } from "@/lib/guests/phone";
import type { GuestEventInfo, GuestGroupInfo } from "@/lib/guests/types";
import {
  AGE_LABEL,
  DIETARY_LABEL,
  DIETARY_ORDER,
  sideLabel,
  type Partners,
} from "@/lib/guests/view";
import type { GuestDetailDto } from "@/modules/guests/guest.dto";

// The "Add / Edit Guest" slide-over from the Stitch design. One form adds a guest, edits one, or
// (with "Save and add another") adds several in a row. The events a guest is invited to are saved
// with the guest.

export type GuestDrawerMode = { kind: "create" } | { kind: "edit"; guest: GuestDetailDto };

const NEW_GROUP = "__new__";
const FIELD =
  "w-full rounded-lg border border-on-surface/15 bg-[#FFFDF9] px-3.5 py-2.5 font-body-sm text-body-sm text-on-surface shadow-[0_1px_3px_0_rgba(42,38,34,0.02)] transition-all placeholder:text-on-surface/40 focus:border-primary-container focus:ring-2 focus:ring-primary-container/10 focus:outline-none";
const LABEL = "mb-2 block font-label-md text-label-md text-on-surface";
const SELECT = `${FIELD} cursor-pointer appearance-none pr-8`;

interface FormState {
  name: string;
  phone: string;
  email: string;
  group: string;
  newGroupName: string;
  side: GuestSide;
  relation: string;
  age: AgeCategory;
  plusOnes: number;
  dietary: DietaryPreference | "";
  line1: string;
  city: string;
  postalCode: string;
  notes: string;
  eventIds: string[];
}

function initialState(
  mode: GuestDrawerMode,
  events: GuestEventInfo[],
  groups: GuestGroupInfo[],
): FormState {
  if (mode.kind === "edit") {
    const guest = mode.guest;
    return {
      name: guest.name,
      phone: phoneForInput(guest.phone),
      email: guest.email ?? "",
      group: guest.groupId && groups.some((g) => g.id === guest.groupId) ? guest.groupId : "",
      newGroupName: "",
      side: guest.side,
      relation: guest.relationLabel ?? "",
      age: guest.ageCategory,
      plusOnes: guest.plusOnesAllowed,
      dietary: guest.dietaryPreference ?? "",
      line1: guest.address?.line1 ?? "",
      city: guest.address?.city ?? "",
      postalCode: guest.address?.postalCode ?? "",
      notes: guest.notes ?? "",
      eventIds: guest.responses.map((response) => response.eventId),
    };
  }
  return {
    name: "",
    phone: "",
    email: "",
    group: "",
    newGroupName: "",
    side: "partnerOne",
    relation: "",
    age: "adult",
    plusOnes: 0,
    dietary: "no_preference",
    line1: "",
    city: "",
    postalCode: "",
    notes: "",
    // Everyone is usually invited to everything: start with every event ticked, as in the design.
    eventIds: events.map((event) => event.id),
  };
}

type Errors = Partial<Record<"name" | "phone" | "email" | "postalCode" | "newGroupName", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GuestDrawer({
  weddingId,
  partners,
  groups,
  events,
  mode,
  onClose,
  onChanged,
  onSaved,
}: {
  weddingId: string;
  partners: Partners;
  groups: GuestGroupInfo[];
  events: GuestEventInfo[];
  mode: GuestDrawerMode;
  onClose: () => void;
  /** After any save: the list and numbers behind the drawer should be refreshed. */
  onChanged: () => void;
  /** After saving an edit (or a "Save guest"): the drawer is done. */
  onSaved: (guest: GuestDetailDto) => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const editing = mode.kind === "edit";
  const [form, setForm] = useState<FormState>(() => initialState(mode, events, groups));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState(0);
  const nameField = useRef<HTMLInputElement>(null);
  const hasAddress = editing && Boolean(form.line1 || form.city || form.postalCode);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const removedWithReply =
    mode.kind === "edit"
      ? mode.guest.responses.filter(
          (response) => response.status !== "pending" && !form.eventIds.includes(response.eventId),
        )
      : [];

  function validate(): { errors: Errors; phone: string | null } {
    const found: Errors = {};
    if (!form.name.trim()) found.name = "Name is required";
    let phone: string | null = null;
    if (form.phone.trim()) {
      phone = toE164(form.phone);
      if (!phone) found.phone = "Enter a valid phone number";
    }
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      found.email = "Enter a valid email address";
    }
    if (form.postalCode.trim() && !/^\d{6}$/.test(form.postalCode.trim())) {
      found.postalCode = "PIN codes are 6 digits";
    }
    if (form.group === NEW_GROUP && !form.newGroupName.trim()) {
      found.newGroupName = "Give the group a name";
    }
    return { errors: found, phone };
  }

  async function save(another: boolean) {
    const { errors: found, phone } = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      let groupId: string | null = form.group || null;
      if (form.group === NEW_GROUP) {
        const created = await createGroup(weddingId, {
          name: form.newGroupName.trim(),
          side: form.side,
        });
        groupId = created.id;
      }

      const previous = mode.kind === "edit" ? mode.guest.address : null;
      const address = Object.fromEntries(
        Object.entries({
          ...previous,
          line1: form.line1.trim(),
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
        }).filter(([, value]) => typeof value === "string" && value !== ""),
      );
      const input: GuestInput = {
        name: form.name.trim(),
        groupId,
        email: form.email.trim() || null,
        phone,
        address: Object.keys(address).length > 0 ? address : null,
        side: form.side,
        relationLabel: form.relation.trim() || null,
        ageCategory: form.age,
        plusOnesAllowed: form.plusOnes,
        dietaryPreference: form.dietary || null,
        notes: form.notes.trim() || null,
        eventIds: form.eventIds,
      };

      const saved =
        mode.kind === "edit"
          ? await updateGuest(weddingId, mode.guest.id, mode.guest.version, input)
          : await createGuest(weddingId, input);
      toast({
        type: "success",
        title: editing ? "Guest updated" : "Guest added",
        message: saved.name,
      });
      onChanged();

      if (another && !editing) {
        // Keep the drawer open for the next person; carry over what is usually shared.
        setForm((current) => ({
          ...initialState({ kind: "create" }, events, groups),
          group: groupId ?? "",
          side: current.side,
          eventIds: current.eventIds,
        }));
        setErrors({});
        setSaving(false);
        setRound((value) => value + 1);
        requestAnimationFrame(() => nameField.current?.focus());
        return;
      }
      onSaved(saved);
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.code === "CONFLICT" && form.group === NEW_GROUP) {
        setErrors({ newGroupName: "You already have a group with that name" });
        return;
      }
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this guest"
            : "Couldn't save the guest",
        message: errorMessage(error),
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  const allSelected = events.length > 0 && form.eventIds.length === events.length;
  const phoneHasCountry = form.phone.trim().startsWith("+") || form.phone.trim().startsWith("00");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-inverse-surface/35 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!saving) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-drawer-title"
        className="fixed inset-y-0 right-0 flex h-full w-full max-w-[488px] flex-col border-l border-on-surface/5 bg-[#FAF6F0] shadow-[-16px_0_48px_-8px_rgba(42,38,34,0.14)]"
      >
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-on-surface/5 bg-[#FAF6F0] px-7 pt-7 pb-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-label-sm text-label-sm font-semibold tracking-widest text-secondary uppercase">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary" />
                  <span>GUEST DIRECTORY</span>
                  <span className="font-normal text-outline-variant">•</span>
                  <span>WEDDING SUITE</span>
                </div>
                <h2
                  id="guest-drawer-title"
                  className="mt-1 font-headline-md text-headline-md text-primary"
                >
                  {editing ? "Edit guest" : "Add guest"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors duration-150 hover:bg-surface-variant hover:text-on-surface focus:ring-2 focus:ring-primary-container focus:outline-none"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {editing
                ? "Update this person's details, group and the events they are invited to."
                : "Add a person to your guest list and assign events, group, and contact details."}
            </p>
          </header>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-7 py-6" key={round}>
            <div>
              <div className="flex items-center justify-between">
                <label className={LABEL} htmlFor="guest-fullname">
                  Full name <span className="text-secondary">*</span>
                </label>
                {errors.name ? (
                  <span className="mb-2 text-[11px] text-error">{errors.name}</span>
                ) : null}
              </div>
              <div className="relative">
                <input
                  ref={nameField}
                  id="guest-fullname"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  maxLength={MAX_GUEST_NAME}
                  placeholder="e.g., Rahul Sharma"
                  value={form.name}
                  aria-invalid={Boolean(errors.name)}
                  onChange={(event) => {
                    set("name", event.target.value);
                    if (event.target.value.trim()) setErrors((e) => ({ ...e, name: undefined }));
                  }}
                  className={`w-full rounded-lg border bg-[#FFFDF9] px-4 py-2.5 pr-10 font-body-md text-body-md text-on-surface transition-all focus:outline-none ${
                    errors.name
                      ? "border-error"
                      : "border-primary-container ring-4 shadow-[0_2px_8px_-2px_rgba(31,77,61,0.08)] ring-primary-container/10 focus:ring-primary-container/15"
                  }`}
                />
                {form.name.trim() && !errors.name ? (
                  <span className="pointer-events-none absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center text-primary-container">
                    <Icon name="check_circle" className="text-lg" />
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={LABEL} htmlFor="guest-phone">
                  Phone
                </label>
                <div
                  className={`flex items-center rounded-lg border bg-[#FFFDF9] shadow-[0_1px_3px_0_rgba(42,38,34,0.02)] transition-all focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/10 ${
                    errors.phone ? "border-error" : "border-on-surface/15"
                  }`}
                >
                  <span className="flex items-center gap-1 border-r border-on-surface/10 pr-1 pl-3 font-label-md text-label-md text-on-surface-variant">
                    <Icon name="call" className="text-sm text-outline" />
                    {phoneHasCountry ? null : <span>+91</span>}
                  </span>
                  <input
                    id="guest-phone"
                    type="tel"
                    autoComplete="off"
                    placeholder="98765 43210"
                    value={form.phone}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(event) => {
                      set("phone", event.target.value);
                      setErrors((e) => ({ ...e, phone: undefined }));
                    }}
                    className="w-full min-w-0 border-0 bg-transparent px-2.5 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:ring-0 focus:outline-none"
                  />
                </div>
                {errors.phone ? (
                  <p className="mt-1 text-[11px] text-error">{errors.phone}</p>
                ) : null}
              </div>
              <div>
                <label className={LABEL} htmlFor="guest-email">
                  Email <span className="text-label-sm font-normal text-outline">(optional)</span>
                </label>
                <div
                  className={`flex items-center rounded-lg border bg-[#FFFDF9] shadow-[0_1px_3px_0_rgba(42,38,34,0.02)] transition-all focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/10 ${
                    errors.email ? "border-error" : "border-on-surface/15"
                  }`}
                >
                  <span className="pointer-events-none flex items-center pl-3 text-outline">
                    <Icon name="mail" className="text-sm" />
                  </span>
                  <input
                    id="guest-email"
                    type="email"
                    autoComplete="off"
                    placeholder="rahul@example.com"
                    value={form.email}
                    aria-invalid={Boolean(errors.email)}
                    onChange={(event) => {
                      set("email", event.target.value);
                      setErrors((e) => ({ ...e, email: undefined }));
                    }}
                    className="w-full min-w-0 border-0 bg-transparent py-2 pr-3 pl-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:ring-0 focus:outline-none"
                  />
                </div>
                {errors.email ? (
                  <p className="mt-1 text-[11px] text-error">{errors.email}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={LABEL} htmlFor="guest-group">
                  Group
                </label>
                <div className="relative">
                  <select
                    id="guest-group"
                    value={form.group}
                    onChange={(event) => set("group", event.target.value)}
                    className={SELECT}
                  >
                    <option value="">No group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                    <option value={NEW_GROUP}>+ Create new group</option>
                  </select>
                  <Icon
                    name="expand_more"
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-base text-outline"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="guest-side">
                  Side
                </label>
                <div className="relative">
                  <select
                    id="guest-side"
                    value={form.side}
                    onChange={(event) => set("side", event.target.value as GuestSide)}
                    className={SELECT}
                  >
                    {(["partnerOne", "partnerTwo", "both"] as const).map((side) => (
                      <option key={side} value={side}>
                        {sideLabel(side, partners)}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-base text-outline"
                  />
                </div>
              </div>
            </div>

            {form.group === NEW_GROUP ? (
              <div className="-mt-3">
                <label className={LABEL} htmlFor="guest-new-group">
                  New group name
                </label>
                <input
                  id="guest-new-group"
                  type="text"
                  autoFocus
                  maxLength={100}
                  placeholder="e.g., College Friends"
                  value={form.newGroupName}
                  aria-invalid={Boolean(errors.newGroupName)}
                  onChange={(event) => {
                    set("newGroupName", event.target.value);
                    setErrors((e) => ({ ...e, newGroupName: undefined }));
                  }}
                  className={`${FIELD} ${errors.newGroupName ? "border-error" : ""}`}
                />
                {errors.newGroupName ? (
                  <p className="mt-1 text-[11px] text-error">{errors.newGroupName}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-outline">
                    It will sit on {sideLabel(form.side, partners)}.
                  </p>
                )}
              </div>
            ) : null}

            <div>
              <label className={LABEL} htmlFor="guest-relation">
                Relation <span className="text-label-sm font-normal text-outline">(optional)</span>
              </label>
              <input
                id="guest-relation"
                type="text"
                autoComplete="off"
                maxLength={MAX_GUEST_RELATION}
                placeholder="e.g., College friend"
                value={form.relation}
                onChange={(event) => set("relation", event.target.value)}
                className={FIELD}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <span className={LABEL} id="guest-age-label">
                  Age group
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="guest-age-label"
                  className="flex items-center rounded-lg border border-on-surface/5 bg-[#F4EFEA] p-1"
                >
                  {AGE_CATEGORIES.map((age) => (
                    <button
                      key={age}
                      type="button"
                      role="radio"
                      aria-checked={form.age === age}
                      onClick={() => set("age", age)}
                      className={`flex-1 rounded px-2 py-1.5 text-center font-label-sm text-label-sm transition-all ${
                        form.age === age
                          ? "bg-[#FFFDF9] font-semibold text-primary shadow-[0_1px_3px_rgba(42,38,34,0.06)]"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {AGE_LABEL[age]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={LABEL} id="guest-plusones-label">
                  Plus-ones allowed
                </span>
                <div
                  role="group"
                  aria-labelledby="guest-plusones-label"
                  className="flex items-center justify-between rounded-lg border border-on-surface/15 bg-[#FFFDF9] px-2 py-1.5 shadow-[0_1px_3px_0_rgba(42,38,34,0.02)]"
                >
                  <button
                    type="button"
                    aria-label="Decrease plus-ones"
                    disabled={form.plusOnes <= 0}
                    onClick={() => set("plusOnes", Math.max(0, form.plusOnes - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[#F4EFEA] text-on-surface transition-colors hover:bg-surface-variant focus:outline-none disabled:opacity-40"
                  >
                    <Icon name="remove" className="text-sm" />
                  </button>
                  <span
                    aria-live="polite"
                    className="px-3 font-body-sm text-body-sm font-semibold text-primary"
                  >
                    {form.plusOnes}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase plus-ones"
                    disabled={form.plusOnes >= MAX_PLUS_ONES}
                    onClick={() => set("plusOnes", Math.min(MAX_PLUS_ONES, form.plusOnes + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[#F4EFEA] text-on-surface transition-colors hover:bg-surface-variant focus:outline-none disabled:opacity-40"
                  >
                    <Icon name="add" className="text-sm" />
                  </button>
                </div>
                <span className="mt-1.5 block text-[11px] leading-3 text-outline">
                  Allows bringing guests
                </span>
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="guest-diet">
                Dietary preference
              </label>
              <div className="relative">
                <select
                  id="guest-diet"
                  value={form.dietary}
                  onChange={(event) => set("dietary", event.target.value as DietaryPreference | "")}
                  className={SELECT}
                >
                  {DIETARY_ORDER.map((diet) => (
                    <option key={diet} value={diet}>
                      {DIETARY_LABEL[diet]}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-base text-outline"
                />
              </div>
            </div>

            <details
              className="group rounded-lg border border-on-surface/10 bg-[#FFFDF9] p-3.5 transition-all"
              open={hasAddress}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <Icon name="pin_drop" className="text-base text-secondary" />
                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                    Postal address
                  </span>
                  <span className="ml-1 text-[11px] font-normal text-outline">
                    For printed invitations (Click to expand)
                  </span>
                </div>
                <Icon
                  name="expand_more"
                  className="text-base text-outline transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 space-y-3 border-t border-on-surface/5 pt-3.5">
                <input
                  type="text"
                  aria-label="Address line 1"
                  maxLength={200}
                  placeholder="Address Line 1 (House/Flat, Building)"
                  value={form.line1}
                  onChange={(event) => set("line1", event.target.value)}
                  className="w-full rounded border border-on-surface/10 bg-[#FAF6F0] px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:border-primary-container focus:ring-0 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    aria-label="City"
                    maxLength={100}
                    placeholder="City (e.g., Jaipur)"
                    value={form.city}
                    onChange={(event) => set("city", event.target.value)}
                    className="w-full rounded border border-on-surface/10 bg-[#FAF6F0] px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:border-primary-container focus:ring-0 focus:outline-none"
                  />
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="PIN code"
                      aria-invalid={Boolean(errors.postalCode)}
                      maxLength={6}
                      placeholder="PIN Code"
                      value={form.postalCode}
                      onChange={(event) => {
                        set("postalCode", event.target.value);
                        setErrors((e) => ({ ...e, postalCode: undefined }));
                      }}
                      className={`w-full rounded border bg-[#FAF6F0] px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:border-primary-container focus:ring-0 focus:outline-none ${
                        errors.postalCode ? "border-error" : "border-on-surface/10"
                      }`}
                    />
                    {errors.postalCode ? (
                      <p className="mt-1 text-[11px] text-error">{errors.postalCode}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </details>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block font-label-md text-label-md text-on-surface">
                  Invite to events
                </span>
                {events.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => set("eventIds", allSelected ? [] : events.map((e) => e.id))}
                    className="text-[11px] font-semibold text-secondary hover:underline"
                  >
                    {allSelected ? "Clear all" : `Select all ${events.length}`}
                  </button>
                ) : null}
              </div>
              <p className="mb-3 font-body-sm text-body-sm text-outline">
                Pick the events this guest is invited to.
              </p>
              {events.length === 0 ? (
                <p className="rounded-lg border border-dashed border-on-surface/15 bg-[#FFFDF9] px-4 py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
                  No events yet. Add your events first, then invite guests to them.
                </p>
              ) : (
                <ul className="space-y-2">
                  {events.map((event) => {
                    const checked = form.eventIds.includes(event.id);
                    return (
                      <li key={event.id}>
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-on-surface/10 bg-[#FFFDF9] p-3 shadow-[0_1px_3px_0_rgba(42,38,34,0.02)] transition-all hover:border-primary-container/30">
                          <div className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                set(
                                  "eventIds",
                                  checked
                                    ? form.eventIds.filter((id) => id !== event.id)
                                    : [...form.eventIds, event.id],
                                )
                              }
                              className="h-4 w-4 cursor-pointer rounded border-on-surface/30 text-primary-container focus:ring-primary-container/20"
                            />
                            <div className="min-w-0">
                              <span className="block truncate font-body-sm text-body-sm font-semibold text-primary">
                                {event.name}
                              </span>
                              {event.detail ? (
                                <span className="block truncate text-[11px] text-on-surface-variant">
                                  {event.detail}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="ml-3 shrink-0 rounded bg-[#F4EFEA] px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                            {event.dateLabel}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {removedWithReply.length > 0 ? (
                <p
                  role="status"
                  className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-secondary-fixed/30 px-3 py-2 text-[12px] text-on-surface"
                >
                  <Icon name="warning" className="mt-px text-[15px] text-secondary" />
                  <span>
                    Taking this guest off{" "}
                    {removedWithReply.map((response) => response.eventName).join(", ")} also removes
                    the reply already recorded for it.
                  </span>
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Icon name="lock" className="text-sm text-outline" />
                <label
                  className="block font-label-md text-label-md text-on-surface"
                  htmlFor="guest-notes"
                >
                  Private notes{" "}
                  <span className="text-label-sm font-normal text-outline">(optional)</span>
                </label>
              </div>
              <textarea
                id="guest-notes"
                rows={3}
                maxLength={MAX_GUEST_NOTES}
                placeholder="e.g., Staying at Marriott, arriving with family on 12th morning."
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                className={`${FIELD} resize-none`}
              />
              <span className="mt-1.5 block text-[11px] text-outline">
                Only your team can see this. Never shown to guests.
              </span>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-on-surface/5 bg-[#FAF6F0] p-5">
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-outline select-none">
              <Icon name="group" className="text-xs text-primary-container" />
              <span>Shared with your team</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-lg border border-on-surface/15 px-3.5 py-2 font-body-sm text-body-sm text-on-surface transition-colors duration-150 hover:bg-surface-variant focus:ring-2 focus:ring-primary-container/20 focus:outline-none disabled:opacity-60"
              >
                Cancel
              </button>
              {editing ? null : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(true)}
                  className="hidden rounded-lg border border-on-surface/15 px-3.5 py-2 font-body-sm text-body-sm text-on-surface transition-colors duration-150 hover:bg-surface-variant focus:ring-2 focus:ring-primary-container/20 focus:outline-none disabled:opacity-60 sm:inline-flex"
                >
                  Save and add another
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary-container px-5 py-2 font-label-md text-label-md text-[#FAF6F0] shadow-[0_2px_8px_rgba(31,77,61,0.2)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#163A2E] focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-none active:translate-y-0 disabled:opacity-70"
              >
                <span>{saving ? "Saving..." : editing ? "Save changes" : "Save guest"}</span>
                {saving ? null : <span className="font-normal">→</span>}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
