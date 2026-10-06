"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isEmailFormat } from "@/components/auth/email-format";
import { RELATIONSHIP_PLAIN, ROLE_LABEL, canManageMembers } from "@/components/dashboard/labels";
import {
  changeMember,
  inviteMember,
  newInvitationLink,
  removeMember,
  revokeInvitation,
  transferOwnership,
} from "@/components/dashboard/workspace-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import {
  INVITATION_ROLES,
  type InvitationRole,
  type MemberRelationship,
  type MemberRole,
} from "@/lib/constants/enums";
import { initialsOf } from "@/lib/text/initials";
import type { MemberDto } from "@/modules/members/member.dto";
import type { PendingInvitation } from "@/modules/dashboard/workspace-pages.service";

// Stitch screen: "Team & Member Management (Owner View)". The same screen, with the actions each
// role is allowed (D3): admins and owners manage people; plain members only see the team.

const CARD =
  "rounded-xl border border-[#2A2622]/[0.06] bg-surface-container-lowest shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)]";
const FIELD =
  "w-full rounded-lg border border-[#2A2622]/12 bg-surface px-3.5 py-2.5 font-body-md text-body-md text-on-surface transition-all placeholder:text-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-hidden";
const FIELD_LABEL = "block font-label-md text-label-md font-semibold text-on-surface";

const AVATAR: Record<MemberRole, string> = {
  owner: "bg-primary text-on-primary",
  admin: "bg-secondary-fixed text-on-secondary-fixed",
  member: "bg-surface-container-high text-on-surface-variant",
};
const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "bg-primary font-semibold text-on-primary",
  admin:
    "border border-secondary/20 bg-secondary-container/40 font-semibold text-on-secondary-container",
  member: "bg-surface-container-highest font-medium text-on-surface-variant",
};

const ROLE_OPTION_TEXT: Record<InvitationRole, string> = {
  admin: "Admin — Full planning & vendor access",
  member: "Member — View & task participation",
};
const INVITE_RELATIONSHIPS = [
  "parent",
  "sibling",
  "relative",
  "friend",
  "planner",
  "other",
] as const;

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

type Pending =
  | { kind: "remove"; member: MemberDto }
  | { kind: "leave"; member: MemberDto }
  | { kind: "transfer"; member: MemberDto }
  | { kind: "role"; member: MemberDto }
  | { kind: "revoke"; invitation: PendingInvitation };

export function TeamManager({
  weddingId,
  weddingTitle,
  members,
  invitations,
  viewer,
}: {
  weddingId: string;
  weddingTitle: string;
  members: MemberDto[];
  invitations: PendingInvitation[];
  viewer: { memberId: string; role: MemberRole };
}) {
  const router = useRouter();
  const toast = useToast();
  const canManage = canManageMembers(viewer.role);
  const isOwner = viewer.role === "owner";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [newRole, setNewRole] = useState<InvitationRole>("member");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fallbackLinks, setFallbackLinks] = useState<Record<string, string>>({});

  function openDialog(next: Pending) {
    if (next.kind === "role") setNewRole(next.member.role === "admin" ? "member" : "admin");
    setPending(next);
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "remove") {
        await removeMember(weddingId, pending.member.id);
        toast({
          type: "success",
          title: "Member removed",
          message: `${pending.member.user.name} no longer has access.`,
        });
      } else if (pending.kind === "leave") {
        await removeMember(weddingId, pending.member.id);
        toast({
          type: "success",
          title: "You left the wedding",
          message: "You can now create or join another one.",
        });
        router.push("/dashboard");
      } else if (pending.kind === "transfer") {
        await transferOwnership(weddingId, pending.member.id);
        toast({
          type: "success",
          title: "Ownership transferred",
          message: `${pending.member.user.name} is now the owner. You're an admin.`,
        });
      } else if (pending.kind === "role") {
        await changeMember(weddingId, pending.member.id, { role: newRole });
        toast({
          type: "success",
          title: "Role updated",
          message: `${pending.member.user.name} is now ${newRole === "admin" ? "an admin" : "a member"}.`,
        });
      } else {
        await revokeInvitation(weddingId, pending.invitation.id);
        toast({
          type: "success",
          title: "Invitation revoked",
          message: "The link no longer works.",
        });
      }
      setPending(null);
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "That didn't work", message: errorMessage(error) });
      // A stale screen (someone else changed things) is the likeliest cause: show the truth.
      setPending(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink(invitation: PendingInvitation) {
    try {
      const { inviteLink } = await newInvitationLink(weddingId, invitation.id);
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopiedId(invitation.id);
        setTimeout(
          () => setCopiedId((current) => (current === invitation.id ? null : current)),
          2000,
        );
        toast({
          type: "info",
          title: "Invite link copied",
          message: "This is a fresh link. The one we emailed earlier no longer works.",
        });
      } catch {
        setFallbackLinks((current) => ({ ...current, [invitation.id]: inviteLink }));
        toast({
          type: "warning",
          title: "Couldn't copy automatically",
          message: "Select the link shown under the invitation and copy it.",
        });
      }
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't create a link", message: errorMessage(error) });
    }
  }

  const dialog = pending ? dialogContent(pending, weddingTitle, newRole, setNewRole) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
            Your team
          </h2>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Everyone helping plan this wedding.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-title text-body-sm font-semibold text-on-primary shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container active:scale-[0.99]"
          >
            <Icon name="add" className="text-[18px]" />
            <span>Invite member</span>
          </button>
        ) : null}
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between border-b border-[#2A2622]/[0.06] px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 className="font-title text-title font-semibold text-on-surface">Active Members</h3>
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
              {members.length}
            </span>
          </div>
          <span className="hidden font-body-sm text-body-sm text-outline sm:block">
            Roles define administrative and billing access
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#2A2622]/[0.06] bg-surface-container-low/50 font-label-md text-label-md text-on-surface-variant/80">
                <th scope="col" className="px-6 py-3 font-semibold">
                  Member
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Relationship
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Joined
                </th>
                <th scope="col" className="px-6 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2622]/[0.06] font-body-sm text-body-sm text-on-surface">
              {members.map((member) => {
                const isSelf = member.id === viewer.memberId;
                const target = member.role !== "owner";
                const items: MenuItem[] = [];
                if (canManage && target && !isSelf) {
                  items.push({
                    icon: "manage_accounts",
                    label: "Change role",
                    onSelect: () => openDialog({ kind: "role", member }),
                  });
                }
                if (isOwner && target && !isSelf) {
                  items.push({
                    icon: "swap_horiz",
                    label: "Transfer ownership",
                    onSelect: () => openDialog({ kind: "transfer", member }),
                  });
                }
                if (canManage && target && !isSelf) {
                  items.push({
                    icon: "person_remove",
                    label: "Remove from wedding",
                    danger: true,
                    onSelect: () => openDialog({ kind: "remove", member }),
                  });
                }
                if (isSelf && target) {
                  items.push({
                    icon: "person_remove",
                    label: "Leave wedding",
                    danger: true,
                    onSelect: () => openDialog({ kind: "leave", member }),
                  });
                }
                return (
                  <tr
                    key={member.id}
                    className="transition-colors hover:bg-surface-container-low/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-title text-body-sm font-semibold ${AVATAR[member.role]}`}
                        >
                          {initialsOf(member.user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-title text-body-sm font-semibold text-on-surface">
                            {member.user.name}
                            {isSelf ? (
                              <span className="ml-2 text-[12px] font-normal text-outline">
                                (you)
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[13px] text-on-surface-variant">
                            {member.user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {member.relationship ? RELATIONSHIP_PLAIN[member.relationship] : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label-sm text-label-sm tracking-wide ${ROLE_BADGE[member.role]}`}
                      >
                        {ROLE_LABEL[member.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-normal whitespace-nowrap text-on-surface-variant">
                      {DATE.format(new Date(member.joinedAt))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!target ? (
                        <span className="font-label-sm text-[12px] tracking-normal text-outline italic">
                          Primary Owner
                        </span>
                      ) : items.length > 0 ? (
                        <MemberMenu name={member.user.name} items={items} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canManage ? (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#2A2622]/[0.06] px-6 py-4">
            <div className="flex items-center gap-2">
              <h3 className="font-title text-title font-semibold text-on-surface">
                Pending invitations
              </h3>
              <span className="rounded-full bg-secondary-fixed px-2 py-0.5 font-label-sm text-label-sm font-semibold text-on-secondary-fixed">
                {invitations.length}
              </span>
            </div>
            <span className="hidden text-body-sm text-on-surface-variant sm:block">
              Links auto-expire after 7 days
            </span>
          </div>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Icon name="mail" className="text-outline" />
              <p className="font-title text-body-sm text-on-surface">No pending invitations</p>
              <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">
                Invite family members and your planner to plan together.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#2A2622]/[0.06]">
              {invitations.map((invitation) => (
                <div key={invitation.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-container-low/30">
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-outline-variant bg-surface-container text-outline">
                        <Icon name="mail" className="text-[18px]" />
                      </div>
                      <div>
                        <div className="font-title text-body-sm font-medium text-on-surface">
                          {invitation.email}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-outline">
                          <Icon name="schedule" className="text-[14px]" />
                          <span>{invitation.expiresLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${
                          invitation.role === "admin"
                            ? "border border-secondary/15 bg-secondary-container/30 font-semibold text-on-secondary-container"
                            : "bg-surface-container-highest font-medium text-on-surface-variant"
                        }`}
                      >
                        {ROLE_LABEL[invitation.role]}
                      </span>
                      <div className="flex items-center gap-4 text-body-sm">
                        <button
                          type="button"
                          onClick={() => copyInviteLink(invitation)}
                          className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary-container hover:underline"
                        >
                          <Icon
                            name={copiedId === invitation.id ? "check" : "content_copy"}
                            className="text-[16px]"
                          />
                          <span>{copiedId === invitation.id ? "Copied!" : "Copy invite link"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openDialog({ kind: "revoke", invitation })}
                          className="font-medium text-secondary transition-colors hover:text-on-secondary-container hover:underline"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                  {fallbackLinks[invitation.id] ? (
                    <div className="px-6 pb-4">
                      <input
                        readOnly
                        aria-label={`Invitation link for ${invitation.email}`}
                        value={fallbackLinks[invitation.id]}
                        onFocus={(event) => event.currentTarget.select()}
                        className={`${FIELD} font-mono text-[12px]`}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#2A2622]/15 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          Only owners and admins can invite people or change roles.
        </p>
      )}

      {drawerOpen ? (
        <InviteDrawer
          weddingId={weddingId}
          onClose={() => setDrawerOpen(false)}
          onSent={() => {
            setDrawerOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {pending && dialog ? (
        <ConfirmDialog
          title={dialog.title}
          confirmLabel={dialog.confirmLabel}
          danger={dialog.danger}
          busy={busy}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        >
          {dialog.body}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function dialogContent(
  pending: Pending,
  weddingTitle: string,
  newRole: InvitationRole,
  setNewRole: (role: InvitationRole) => void,
) {
  switch (pending.kind) {
    case "remove":
      return {
        title: `Remove ${pending.member.user.name}?`,
        confirmLabel: "Remove",
        danger: true,
        body: (
          <p>
            They lose access to {weddingTitle} immediately. They can be invited again later, and can
            join another wedding in the meantime.
          </p>
        ),
      };
    case "leave":
      return {
        title: "Leave this wedding?",
        confirmLabel: "Leave wedding",
        danger: true,
        body: (
          <p>
            You&apos;ll lose access to {weddingTitle}. You can create your own wedding or accept
            another invitation afterwards, but you&apos;ll need a new invitation to come back here.
          </p>
        ),
      };
    case "transfer":
      return {
        title: `Make ${pending.member.user.name} the owner?`,
        confirmLabel: "Transfer ownership",
        danger: false,
        body: (
          <>
            <p>
              {pending.member.user.name} becomes the owner: the only person who can delete the
              wedding or transfer ownership.
            </p>
            <p>You will become an admin.</p>
          </>
        ),
      };
    case "role":
      return {
        title: `Change ${pending.member.user.name}'s role`,
        confirmLabel: "Update role",
        danger: false,
        body: (
          <div className="relative">
            <select
              aria-label="New role"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as InvitationRole)}
              className={`${FIELD} cursor-pointer appearance-none`}
            >
              {[...INVITATION_ROLES].reverse().map((role) => (
                <option key={role} value={role}>
                  {ROLE_OPTION_TEXT[role]}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-outline"
            />
          </div>
        ),
      };
    case "revoke":
      return {
        title: "Revoke this invitation?",
        confirmLabel: "Revoke",
        danger: true,
        body: (
          <p>
            The link sent to {pending.invitation.email} stops working. You can invite them again
            later.
          </p>
        ),
      };
  }
}

interface MenuItem {
  icon: "manage_accounts" | "swap_horiz" | "person_remove";
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

/** The "more" popover on a member row. Positioned with `fixed` so the table can scroll sideways. */
function MemberMenu({ name, items }: { name: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((value) => !value);
  }

  const firstDanger = items.findIndex((item) => item.danger);

  return (
    <>
      <button
        ref={button}
        type="button"
        title="Member Actions"
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        onClick={toggle}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          open
            ? "bg-surface-container-high text-on-surface"
            : "text-outline hover:bg-surface-container hover:text-on-surface"
        }`}
      >
        <Icon name="more_horiz" className="text-[20px]" />
      </button>
      {open && position ? (
        <div
          ref={menu}
          role="menu"
          style={{ top: position.top, right: position.right }}
          className="fixed z-50 w-52 rounded-xl border border-[#2A2622]/[0.06] bg-surface-container-lowest py-1.5 text-left text-body-sm shadow-[0_16px_36px_-4px_rgba(42,38,34,0.12),0_4px_10px_-2px_rgba(42,38,34,0.04)]"
        >
          <div className="border-b border-[#2A2622]/[0.06] px-3 py-1.5 font-label-sm text-[11px] tracking-wider text-outline uppercase">
            Manage Member
          </div>
          {items.map((item, index) => (
            <div key={item.label}>
              {index === firstDanger && index > 0 ? (
                <div className="my-1 border-t border-[#2A2622]/[0.06]" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left font-body-sm transition-colors ${
                  item.danger
                    ? "text-error hover:bg-error-container/30"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`text-[18px] ${item.danger ? "text-error" : "text-outline"}`}
                />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** The "Invite member" slide-over from the right. */
function InviteDrawer({
  weddingId,
  onClose,
  onSent,
}: {
  weddingId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [relationship, setRelationship] = useState<MemberRelationship | "">("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({ email: false, relationship: false });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { email: !isEmailFormat(email), relationship: relationship === "" };
    setErrors(next);
    if (next.email || next.relationship) return;

    setSending(true);
    try {
      const result = await inviteMember(weddingId, {
        email: email.trim(),
        role,
        relationship: relationship || undefined,
        message: message.trim() || undefined,
      });
      toast({
        type: result.emailStatus === "sent" ? "success" : "warning",
        title: result.emailStatus === "sent" ? "Invitation sent" : "Invitation created",
        message:
          result.emailStatus === "sent"
            ? `We emailed ${email.trim()} a link to join.`
            : `The email couldn't be sent${result.emailError ? ` (${result.emailError.message ?? result.emailError.code})` : ""}. Use “Copy invite link” on the pending invitation to share it yourself.`,
      });
      onSent();
    } catch (error) {
      setSending(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "CONFLICT"
            ? "Already invited"
            : "Couldn't send the invitation",
        message: errorMessage(error),
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      <div
        className="absolute inset-0 bg-inverse-surface/20 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!sending) onClose();
        }}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Invite member"
        noValidate
        onSubmit={handleSubmit}
        className="fixed inset-y-0 right-0 flex w-screen max-w-md flex-col justify-between bg-surface-container-lowest shadow-[-12px_0_36px_-6px_rgba(42,38,34,0.12)]"
      >
        <div className="flex-1 space-y-6 overflow-y-auto p-8 select-text">
          <div className="flex items-start justify-between border-b border-[#2A2622]/[0.06] pb-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm font-medium text-on-surface">
                Invite member
              </h3>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Add a family member, partner, or planner to this workspace.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="invite-email" className={FIELD_LABEL}>
                Email address <span className="text-secondary">*</span>
              </label>
              {errors.email ? (
                <span className="text-[11px] text-error">Valid email required</span>
              ) : null}
            </div>
            <input
              id="invite-email"
              type="email"
              autoComplete="off"
              autoFocus
              placeholder="colleague@family.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (isEmailFormat(event.target.value)) setErrors((e) => ({ ...e, email: false }));
              }}
              aria-invalid={errors.email}
              className={`${FIELD} ${errors.email ? "border-error" : ""}`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className={FIELD_LABEL}>
              Role &amp; Permissions <span className="text-secondary">*</span>
            </label>
            <div className="relative">
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as InvitationRole)}
                className={`${FIELD} cursor-pointer appearance-none`}
              >
                {[...INVITATION_ROLES].reverse().map((value) => (
                  <option key={value} value={value}>
                    {ROLE_OPTION_TEXT[value]}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-outline"
              />
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-outline">
              Admins can edit event details, sign off vendor agreements, and approve guest lists.
              Only Owners can transfer wedding ownership or delete the project.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="invite-relationship" className={FIELD_LABEL}>
                Relationship <span className="text-secondary">*</span>
              </label>
              {errors.relationship ? (
                <span className="text-[11px] text-error">Select one</span>
              ) : null}
            </div>
            <div className="relative">
              <select
                id="invite-relationship"
                value={relationship}
                onChange={(event) => {
                  setRelationship(event.target.value as MemberRelationship);
                  setErrors((e) => ({ ...e, relationship: false }));
                }}
                aria-invalid={errors.relationship}
                className={`${FIELD} cursor-pointer appearance-none ${errors.relationship ? "border-error" : ""}`}
              >
                <option value="" disabled>
                  Select relationship
                </option>
                {INVITE_RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {RELATIONSHIP_PLAIN[value]}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-outline"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="invite-message" className={FIELD_LABEL}>
                Personal message
              </label>
              <span className="font-label-sm text-label-sm text-outline">Optional</span>
            </div>
            <textarea
              id="invite-message"
              rows={3}
              maxLength={500}
              placeholder="Add a personal note to the email invitation..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={`${FIELD} resize-none`}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-[#2A2622]/[0.06] bg-surface-container p-3.5">
            <Icon name="lock" className="mt-0.5 text-[18px] text-primary" />
            <p className="font-body-sm text-[12px] leading-relaxed text-on-surface-variant">
              Invitations generate a secure single-use link. No password setup required until
              accepted.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#2A2622]/[0.06] bg-surface-container-low p-6">
          <button
            type="submit"
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-title text-body-md font-semibold text-on-primary shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)] transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:opacity-70"
          >
            <Icon name="send" className="text-[18px]" />
            <span>{sending ? "Sending..." : "Send invitation"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="py-2 text-center font-title text-body-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
