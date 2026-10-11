"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createGroup, deleteGroup, updateGroup } from "@/components/guests/guests-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { GUEST_SIDES, type GuestSide } from "@/lib/constants/enums";
import { MAX_GROUP_NAME } from "@/lib/constants/guests";
import type { GuestGroupInfo } from "@/lib/guests/types";
import { sideLabel, type Partners } from "@/lib/guests/view";

// "Manage groups" (the button beside "Add guest"). The Stitch project has no screen for it, so it
// is built in the same cream-card style as the app's other dialogs: add a group, rename it, change
// its side, or delete it, choosing where its guests go (they are never deleted with the group).

const FIELD =
  "w-full rounded-lg border border-on-surface/15 bg-[#FFFDF9] px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:border-primary-container focus:ring-2 focus:ring-primary-container/10 focus:outline-none";

export function GroupsDialog({
  weddingId,
  groups,
  partners,
  onClose,
  onChanged,
}: {
  weddingId: string;
  groups: GuestGroupInfo[];
  partners: Partners;
  onClose: () => void;
  /** Groups or their guests changed: the list and the group choices should be re-read. */
  onChanged: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [name, setName] = useState("");
  const [side, setSide] = useState<GuestSide>("partnerOne");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the group a name");
      return;
    }
    setBusy(true);
    try {
      await createGroup(weddingId, { name: name.trim(), side });
      toast({ type: "success", title: "Group added", message: name.trim() });
      setName("");
      setError(null);
      onChanged();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "CONFLICT") {
        setError("You already have a group with that name");
      } else {
        toast({ type: "error", title: "Couldn't add the group", message: errorMessage(failure) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2A2622]/40 px-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl border border-[#2A2622]/10 bg-[#FFFDF9] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#2A2622]/[0.06] px-7 pt-6 pb-4">
          <div>
            <h2 id={titleId} className="font-headline-sm text-xl font-medium text-primary">
              Manage groups
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Organise guests by family or circle of friends. Deleting a group never deletes guests.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
            className="-mt-1 -mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-5">
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-on-surface/15 px-4 py-8 text-center font-body-sm text-body-sm text-on-surface-variant">
              No groups yet. Add one below, for example &ldquo;College Friends&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-[#2A2622]/[0.05]">
              {groups.map((group) => (
                <li key={group.id} className="py-3">
                  {editing === group.id ? (
                    <EditRow
                      weddingId={weddingId}
                      group={group}
                      partners={partners}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        onChanged();
                      }}
                    />
                  ) : deleting === group.id ? (
                    <DeleteRow
                      weddingId={weddingId}
                      group={group}
                      others={groups.filter((other) => other.id !== group.id)}
                      onCancel={() => setDeleting(null)}
                      onDeleted={() => {
                        setDeleting(null);
                        onChanged();
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-body-md text-body-md font-medium text-on-surface">
                          {group.name}
                        </p>
                        <p className="font-body-sm text-[12px] text-on-surface-variant">
                          {sideLabel(group.side, partners)} · {group.guestCount}{" "}
                          {group.guestCount === 1 ? "guest" : "guests"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${group.name}`}
                          onClick={() => setEditing(group.id)}
                          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                        >
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${group.name}`}
                          onClick={() => setDeleting(group.id)}
                          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          noValidate
          onSubmit={add}
          className="border-t border-[#2A2622]/[0.06] bg-[#FAF6F0] px-7 py-4"
        >
          <p className="mb-2 font-label-md text-label-md text-on-surface">Add a group</p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-[160px] flex-1">
              <input
                type="text"
                aria-label="Group name"
                aria-invalid={Boolean(error)}
                maxLength={MAX_GROUP_NAME}
                placeholder="e.g., College Friends"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                className={`${FIELD} ${error ? "border-error" : ""}`}
              />
              {error ? <p className="mt-1 text-[11px] text-error">{error}</p> : null}
            </div>
            <select
              aria-label="Side"
              value={side}
              onChange={(event) => setSide(event.target.value as GuestSide)}
              className={`${FIELD} w-auto cursor-pointer`}
            >
              {GUEST_SIDES.map((value) => (
                <option key={value} value={value}>
                  {sideLabel(value, partners)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary-container px-4 py-2 font-label-md text-label-md text-[#FAF6F0] shadow-sm transition-colors hover:bg-[#163A2E] disabled:opacity-70"
            >
              {busy ? "Adding..." : "Add group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRow({
  weddingId,
  group,
  partners,
  onCancel,
  onSaved,
}: {
  weddingId: string;
  group: GuestGroupInfo;
  partners: Partners;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(group.name);
  const [side, setSide] = useState<GuestSide>(group.side);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the group a name");
      return;
    }
    setSaving(true);
    try {
      await updateGroup(weddingId, group.id, group.version, { name: name.trim(), side });
      toast({ type: "success", title: "Group updated", message: name.trim() });
      onSaved();
    } catch (failure) {
      setSaving(false);
      if (failure instanceof ApiError && failure.code === "CONFLICT") {
        setError("You already have a group with that name");
      } else {
        toast({ type: "error", title: "Couldn't save the group", message: errorMessage(failure) });
      }
    }
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-wrap items-start gap-2">
      <div className="min-w-[140px] flex-1">
        <input
          type="text"
          autoFocus
          aria-label="Group name"
          aria-invalid={Boolean(error)}
          maxLength={MAX_GROUP_NAME}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          className={`${FIELD} ${error ? "border-error" : ""}`}
        />
        {error ? <p className="mt-1 text-[11px] text-error">{error}</p> : null}
      </div>
      <select
        aria-label="Side"
        value={side}
        onChange={(event) => setSide(event.target.value as GuestSide)}
        className={`${FIELD} w-auto cursor-pointer`}
      >
        {GUEST_SIDES.map((value) => (
          <option key={value} value={value}>
            {sideLabel(value, partners)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary-container px-3.5 py-2 font-label-md text-label-md text-[#FAF6F0] hover:bg-[#163A2E] disabled:opacity-70"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border border-on-surface/15 px-3.5 py-2 font-body-sm text-body-sm text-on-surface hover:bg-surface-variant"
      >
        Cancel
      </button>
    </form>
  );
}

function DeleteRow({
  weddingId,
  group,
  others,
  onCancel,
  onDeleted,
}: {
  weddingId: string;
  group: GuestGroupInfo;
  others: GuestGroupInfo[];
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const result = await deleteGroup(weddingId, group.id, target || null);
      toast({
        type: "success",
        title: "Group deleted",
        message:
          result.guestsMoved > 0
            ? `${result.guestsMoved} ${result.guestsMoved === 1 ? "guest" : "guests"} moved`
            : group.name,
      });
      onDeleted();
    } catch (failure) {
      setBusy(false);
      toast({ type: "error", title: "Couldn't delete the group", message: errorMessage(failure) });
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/40 p-3.5">
      <p className="font-body-sm text-body-sm text-on-surface">
        Delete <strong className="font-semibold">{group.name}</strong>?{" "}
        {group.guestCount > 0
          ? `Its ${group.guestCount} ${group.guestCount === 1 ? "guest" : "guests"} will not be deleted. Choose where they go:`
          : "It has no guests."}
      </p>
      {group.guestCount > 0 ? (
        <select
          aria-label="Move guests to"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className={`${FIELD} cursor-pointer`}
        >
          <option value="">No group (ungrouped)</option>
          {others.map((other) => (
            <option key={other.id} value={other.id}>
              Move to {other.name}
            </option>
          ))}
        </select>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-on-surface/15 px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-variant"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="rounded-lg bg-red-700 px-4 py-1.5 font-label-md text-label-md text-white hover:bg-red-800 disabled:opacity-60"
        >
          {busy ? "Deleting..." : "Delete group"}
        </button>
      </div>
    </div>
  );
}
