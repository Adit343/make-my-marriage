"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  changePassword,
  deleteAccount,
  deleteWedding,
  endOtherSessions,
  endSession,
  removeMember,
  updateProfile,
  updateWedding,
} from "@/components/dashboard/workspace-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GoogleLogo } from "@/components/ui/google-logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/auth";
import type { MemberRole } from "@/lib/constants/enums";
import type { SessionRow } from "@/modules/dashboard/workspace-pages.service";
import type { WeddingDto } from "@/modules/weddings/wedding.dto";

// Stitch screen: "Settings (Owner View)". Same screen for every role: the wedding fields are
// read-only below admin, and the danger zone offers what that role is allowed to do.

const CARD =
  "rounded-xl border border-[#2A2622]/[0.06] bg-[#FFFDF9] p-8 shadow-[0_2px_14px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-3px_rgba(42,38,34,0.06),0_2px_6px_-1px_rgba(42,38,34,0.02)]";
const INPUT =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-4 py-2.5 font-body-md text-body-md text-on-surface transition-all duration-150 placeholder:text-on-surface-variant/40 focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.09)] focus:outline-hidden disabled:cursor-not-allowed disabled:bg-[#F4EFEA]/70 disabled:text-on-surface/75";
const LABEL = "block font-title text-body-sm font-semibold text-on-surface";
const HINT = "text-[12px] text-on-surface-variant";
const PRIMARY =
  "flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-5 py-2.5 font-title text-body-sm font-semibold text-[#FAF6F0] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#163A2E] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-hidden active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";
const DANGER_BUTTON =
  "whitespace-nowrap rounded-lg border border-red-300 px-4 py-2 text-body-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-50 focus:ring-2 focus:ring-red-400 focus:outline-hidden";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST) — UTC+05:30" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST) — UTC+04:00" },
  { value: "Europe/London", label: "British Summer Time (BST) — UTC+01:00" },
  { value: "America/New_York", label: "Eastern Standard Time (EST) — UTC-05:00" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT) — UTC+08:00" },
];
const CURRENCIES = [
  { value: "INR", label: "Indian Rupee (₹ INR)" },
  { value: "USD", label: "United States Dollar ($ USD)" },
  { value: "AED", label: "United Arab Emirates Dirham (AED)" },
  { value: "GBP", label: "British Pound Sterling (£ GBP)" },
  { value: "EUR", label: "Euro (€ EUR)" },
];

const DEVICE_ICON: Record<SessionRow["kind"], IconName> = {
  laptop: "laptop_mac",
  phone: "phone_iphone",
  tablet: "tablet_mac",
};

function CardHeader({
  title,
  subtitle,
  tag,
  tagClass,
  action,
}: {
  title: string;
  subtitle: string;
  tag?: string;
  tagClass?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4 border-b border-[#2A2622]/[0.06] pb-5">
      <div>
        <h3 className="font-headline-sm text-xl font-medium text-on-surface">{title}</h3>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
      </div>
      {action ??
        (tag ? (
          <span
            className={`rounded px-2.5 py-1 font-label-sm text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ${tagClass}`}
          >
            {tag}
          </span>
        ) : null)}
    </div>
  );
}

function SelectField({
  id,
  icon,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string;
  icon: IconName;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        name={icon}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-outline"
      />
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} cursor-pointer appearance-none pr-8 pl-10`}
      >
        {children}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-outline"
      />
    </div>
  );
}

export function SettingsPanel({
  wedding,
  user,
  sessions,
  viewer,
  canEditWedding,
  activeMemberCount,
}: {
  wedding: WeddingDto;
  user: {
    name: string;
    email: string;
    hasPassword: boolean;
    passwordChangedLabel: string | null;
    hasGoogle: boolean;
  };
  sessions: SessionRow[];
  viewer: { memberId: string; role: MemberRole };
  canEditWedding: boolean;
  activeMemberCount: number;
}) {
  return (
    <>
      <section className="border-b border-[#2A2622]/[0.06] pb-8">
        <h2 className="font-headline-lg text-3xl font-normal tracking-tight text-on-surface">
          Settings
        </h2>
        <p className="mt-2 max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Manage your personal profile, wedding workspace parameters, and account security.
        </p>
      </section>
      <Profile key={user.name} user={user} />
      {/* Keyed by version so the form resets to the saved values after each save or refresh. */}
      <WeddingDetails key={wedding.version} wedding={wedding} canEdit={canEditWedding} />
      <Security user={user} />
      <Sessions sessions={sessions} />
      <DangerZone wedding={wedding} viewer={viewer} activeMemberCount={activeMemberCount} />
      <footer className="flex flex-col items-center justify-between border-t border-[#2A2622]/[0.06] pt-6 pb-12 text-[13px] text-on-surface-variant sm:flex-row">
        <p>
          © 2025 Make My Marriage Technologies Pvt Ltd. All rights reserved. Indian IT Act (2000)
          &amp; DPDP Compliant.
        </p>
        <div className="mt-2 flex gap-4 sm:mt-0">
          <Link href="/#privacy" className="transition-colors hover:text-primary">
            Privacy Policy
          </Link>
          <span className="text-outline-variant">•</span>
          <a href="#" className="transition-colors hover:text-primary">
            Security &amp; Compliance
          </a>
          <span className="text-outline-variant">•</span>
          <a href="#" className="transition-colors hover:text-primary">
            Support
          </a>
        </div>
      </footer>
    </>
  );
}

function Profile({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile(name.trim());
      toast({
        type: "success",
        title: "Profile updated",
        message: `Profile updated for ${name.trim()}`,
      });
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't update your name", message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={CARD}>
      <CardHeader
        title="Profile"
        subtitle="Your personal information across the wedding workspace."
        tag="Personal Info"
        tagClass="bg-[#F4EFEA] text-on-surface-variant"
      />
      <form noValidate onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className={LABEL}>
              Full name
            </label>
            <input
              id="fullName"
              value={name}
              maxLength={100}
              placeholder="Enter full name"
              onChange={(event) => setName(event.target.value)}
              className={INPUT}
            />
            <p className={HINT}>
              This name appears on invitations, assignments, and collaborator logs.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className={LABEL}>
              Email address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={user.email}
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-[#2A2622]/10 bg-[#F4EFEA]/70 px-4 py-2.5 pr-10 font-body-md text-on-surface/75 select-all"
              />
              <Icon
                name="lock"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-[#2A2622]/40"
              />
            </div>
            <p className={`${HINT} flex items-center gap-1`}>
              <Icon name="info" className="text-[14px] text-outline" />
              Contact workspace owner or support to change primary address.
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving || !name.trim() || name.trim() === user.name}
            className={PRIMARY}
          >
            <Icon name="check" className="text-[18px]" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function WeddingDetails({ wedding, canEdit }: { wedding: WeddingDto; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(wedding.title);
  const [partnerOne, setPartnerOne] = useState(wedding.partners[0]?.name ?? "");
  const [partnerTwo, setPartnerTwo] = useState(wedding.partners[1]?.name ?? "");
  const [weddingDate, setWeddingDate] = useState(wedding.weddingDate ?? "");
  const [timezone, setTimezone] = useState(wedding.timezone);
  const [currency, setCurrency] = useState(wedding.currency);
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  // A value saved elsewhere (e.g. an API client) that isn't one of the design's options still shows.
  const timezones = TIMEZONES.some((tz) => tz.value === wedding.timezone)
    ? TIMEZONES
    : [{ value: wedding.timezone, label: wedding.timezone }, ...TIMEZONES];
  const currencies = CURRENCIES.some((c) => c.value === wedding.currency)
    ? CURRENCIES
    : [{ value: wedding.currency, label: wedding.currency }, ...CURRENCIES];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setTitleInvalid(true);
      return;
    }
    const partners = [partnerOne, partnerTwo]
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    setSaving(true);
    try {
      await updateWedding(wedding.id, {
        version: wedding.version,
        title: title.trim(),
        partners,
        weddingDate: weddingDate || null,
        timezone,
        currency,
      });
      toast({
        type: "success",
        title: "Saved",
        message: "Wedding parameters and localization saved.",
      });
      router.refresh();
    } catch (error) {
      const conflict = error instanceof ApiError && error.code === "VERSION_CONFLICT";
      toast({
        type: "error",
        title: conflict ? "Someone else just edited this" : "Couldn't save",
        message: errorMessage(error),
      });
      // On a conflict, reloading shows what the other person saved.
      if (conflict) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={CARD}>
      <CardHeader
        title="Wedding details"
        subtitle={
          canEdit
            ? "Core metadata and localization for your wedding celebrations."
            : "Only owners and admins can change these."
        }
        tag="Workspace Meta"
        tagClass="bg-[#EBF2EE] text-[#1F4D3D]"
      />
      <form noValidate onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="weddingName" className={LABEL}>
                Wedding title / display name
              </label>
              {titleInvalid ? <span className="text-[11px] text-error">Required</span> : null}
            </div>
            <input
              id="weddingName"
              value={title}
              maxLength={120}
              disabled={!canEdit}
              onChange={(event) => {
                setTitle(event.target.value);
                if (event.target.value.trim()) setTitleInvalid(false);
              }}
              aria-invalid={titleInvalid}
              className={`${INPUT} ${titleInvalid ? "border-error" : ""}`}
            />
          </div>
          {[
            { id: "partnerOne", label: "Partner one", value: partnerOne, set: setPartnerOne },
            { id: "partnerTwo", label: "Partner two", value: partnerTwo, set: setPartnerTwo },
          ].map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label htmlFor={field.id} className={LABEL}>
                {field.label}
              </label>
              <div className="relative">
                <Icon
                  name="favorite"
                  className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-outline"
                />
                <input
                  id={field.id}
                  value={field.value}
                  maxLength={80}
                  disabled={!canEdit}
                  onChange={(event) => field.set(event.target.value)}
                  className={`${INPUT} pr-4 pl-10`}
                />
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <label htmlFor="weddingDate" className={LABEL}>
              Wedding date
            </label>
            <div className="relative">
              <Icon
                name="calendar_today"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-outline"
              />
              <input
                id="weddingDate"
                type="date"
                value={weddingDate}
                disabled={!canEdit}
                onChange={(event) => setWeddingDate(event.target.value)}
                className={`${INPUT} pr-4 pl-10`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="timezone" className={LABEL}>
              Primary timezone
            </label>
            <SelectField
              id="timezone"
              icon="schedule"
              value={timezone}
              disabled={!canEdit}
              onChange={setTimezone}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="currency" className={LABEL}>
              Accounting &amp; ledger currency
            </label>
            <SelectField
              id="currency"
              icon="payments"
              value={currency}
              disabled={!canEdit}
              onChange={setCurrency}
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            <p className={HINT}>
              All vendor quotes, contracts, and collaborator splits will calculate in this currency
              denomination.
            </p>
          </div>
        </div>
        {canEdit ? (
          <div className="flex justify-end pt-4">
            <button type="submit" disabled={saving} className={PRIMARY}>
              <Icon name="save" className="text-[18px]" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function Security({
  user,
}: {
  user: {
    email: string;
    hasPassword: boolean;
    passwordChangedLabel: string | null;
    hasGoogle: boolean;
  };
}) {
  const toast = useToast();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <section className={CARD}>
      <CardHeader
        title="Security"
        subtitle="Credentials and connected authentication providers."
        tag="Authentication"
        tagClass="bg-[#F4EFEA] text-on-surface-variant"
      />
      <div className="divide-y divide-[#2A2622]/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <div className="space-y-1">
            <span className="font-title text-body-md font-semibold text-on-surface">Password</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {user.hasPassword
                ? `${user.passwordChangedLabel ?? "Password set"} (secure scrypt hash)`
                : "No password set. You sign in with Google."}
            </p>
          </div>
          {user.hasPassword ? (
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="rounded-lg border border-[#2A2622]/20 px-4 py-2 font-title text-body-sm font-semibold text-[#2A2622] transition-colors duration-150 hover:bg-[#F4EFEA] focus:ring-2 focus:ring-[#1F4D3D] focus:outline-hidden"
            >
              Change password
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2A2622]/10 bg-[#FAF6F0] p-2 shadow-xs">
              <GoogleLogo />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-title text-body-md font-semibold text-on-surface">
                  Google Workspace
                </span>
                {user.hasGoogle ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#1F4D3D]/10 bg-[#EBF2EE] px-2 py-0.5 font-label-md text-[11px] font-semibold text-[#1F4D3D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1F4D3D]" />
                    Connected
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                {user.hasGoogle ? user.email : "Not connected"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              toast({
                type: "info",
                title: user.hasGoogle ? "Google account" : "Connect Google",
                message: user.hasGoogle
                  ? "Google account synchronization is managed by workspace administrator."
                  : "Linking Google to an existing account is coming soon.",
              })
            }
            className="rounded px-3 py-1.5 font-body-sm text-on-surface-variant transition-colors duration-150 hover:bg-[#F4EFEA] hover:text-secondary"
          >
            {user.hasGoogle ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>
      {passwordOpen ? <PasswordModal onClose={() => setPasswordOpen(false)} /> : null}
    </section>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast({
        type: "error",
        title: "Password too short",
        message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        type: "error",
        title: "Passwords don't match",
        message: "Re-enter the new password in both fields.",
      });
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast({
        type: "success",
        title: "Password updated",
        message: "Password updated successfully. Other active sessions revoked.",
      });
      onClose();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title: "Couldn't change your password",
        message: errorMessage(error),
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2A2622]/40 px-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Update password"
        className="w-full max-w-md rounded-xl border border-[#2A2622]/10 bg-[#FFFDF9] p-7 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#2A2622]/[0.07] pb-4">
          <h3 className="font-headline-sm text-xl font-medium text-on-surface">Update password</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-outline hover:text-on-surface"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="current-password" className={LABEL}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={INPUT}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className={LABEL}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={INPUT}
            />
            <p className="text-[11px] text-on-surface-variant">
              Minimum {PASSWORD_MIN_LENGTH} characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className={LABEL}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={INPUT}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#2A2622]/15 px-4 py-2 font-title text-body-sm font-semibold text-on-surface hover:bg-[#F4EFEA]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-lg bg-[#1F4D3D] px-5 py-2 font-title text-body-sm font-semibold text-[#FAF6F0] hover:bg-[#163A2E] disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Sessions({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const others = sessions.filter((session) => !session.isCurrent);

  async function logOutSession(session: SessionRow) {
    setBusyId(session.id);
    try {
      await endSession(session.id);
      toast({ type: "success", title: "Signed out", message: `Signed out of ${session.label}` });
      router.refresh();
    } catch (error) {
      toast({
        type: "error",
        title: "Couldn't sign out that device",
        message: errorMessage(error),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function logOutOthers() {
    setBusyId("all");
    try {
      await endOtherSessions();
      toast({
        type: "success",
        title: "Signed out",
        message: "All other remote sessions have been terminated.",
      });
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't sign out", message: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={CARD}>
      <CardHeader
        title="Active sessions"
        subtitle="Manage devices currently authenticated into this workspace."
        action={
          <button
            type="button"
            disabled={others.length === 0 || busyId === "all"}
            onClick={logOutOthers}
            className="font-label-md text-[12px] font-semibold tracking-wide whitespace-nowrap text-secondary uppercase transition-colors duration-150 hover:text-[#78401d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sign out all other sessions
          </button>
        }
      />
      <ul className="divide-y divide-[#2A2622]/[0.06]">
        {sessions.map((session, index) => (
          <li
            key={session.id}
            className={`flex flex-wrap items-center justify-between gap-3 ${index === 0 ? "pb-4" : "py-4"}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`rounded-lg p-2.5 ${session.isCurrent ? "bg-[#EBF2EE] text-[#1F4D3D]" : "bg-[#F4EFEA] text-on-surface-variant"}`}
              >
                <Icon name={DEVICE_ICON[session.kind]} className="text-[20px]" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-title text-body-md font-semibold text-on-surface">
                    {session.label}
                  </span>
                  {session.isCurrent ? (
                    <span className="rounded-full border border-[#1F4D3D]/10 bg-[#EBF2EE] px-2 py-0.5 font-label-md text-[11px] font-semibold text-[#1F4D3D]">
                      This device
                    </span>
                  ) : null}
                </div>
                <p
                  className={`font-body-sm text-body-sm ${session.isCurrent ? "font-medium text-[#1F4D3D]" : "text-on-surface-variant"}`}
                >
                  {session.activity}
                </p>
              </div>
            </div>
            {session.isCurrent ? (
              <span className="px-2 py-1 font-label-sm text-label-sm tracking-wider text-outline uppercase">
                Current Session
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === session.id}
                onClick={() => logOutSession(session)}
                className="rounded px-3 py-1.5 font-body-sm text-on-surface-variant transition-colors duration-150 hover:bg-[#F4EFEA] hover:text-on-surface hover:underline disabled:opacity-50"
              >
                Log out
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Confirming = "leave" | "delete-wedding" | "delete-account" | null;

function DangerZone({
  wedding,
  viewer,
  activeMemberCount,
}: {
  wedding: WeddingDto;
  viewer: { memberId: string; role: MemberRole };
  activeMemberCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = viewer.role === "owner";
  const soleOwner = isOwner && activeMemberCount <= 1;

  async function confirm() {
    if (!confirming) return;
    setBusy(true);
    try {
      if (confirming === "leave") {
        await removeMember(wedding.id, viewer.memberId);
        toast({
          type: "success",
          title: "You left the wedding",
          message: "You can create or join another one.",
        });
        router.push("/dashboard");
      } else if (confirming === "delete-wedding") {
        await deleteWedding(wedding.id, wedding.title);
        toast({
          type: "success",
          title: "Wedding deleted",
          message: "Wedding workspace marked for soft-deletion (30-day retention).",
        });
        router.push("/dashboard");
      } else {
        await deleteAccount({ deleteWedding: soleOwner });
        toast({ type: "success", title: "Account deleted", message: "You've been signed out." });
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      setBusy(false);
      toast({ type: "error", title: "That didn't work", message: errorMessage(error) });
      setConfirming(null);
    }
  }

  function requestDeleteAccount() {
    if (isOwner && !soleOwner) {
      toast({
        type: "warning",
        title: "Transfer ownership first",
        message: "Please transfer ownership to another admin before removing this account.",
      });
      return;
    }
    setConfirming("delete-account");
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/20 p-8 transition-shadow duration-200">
      <div className="mb-7 flex items-center justify-between gap-4 border-b border-red-200/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100/70 text-error">
            <Icon name="warning" className="text-[18px]" />
          </div>
          <div>
            <h3 className="font-headline-sm text-xl font-medium text-error">Danger zone</h3>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Irreversible actions affecting the entire workspace and account status.
            </p>
          </div>
        </div>
        {isOwner ? (
          <span className="rounded bg-red-100 px-2.5 py-1 font-label-sm text-[11px] font-semibold tracking-wider whitespace-nowrap text-error uppercase">
            Owner Access Only
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-red-200/50">
        <div className="flex flex-col justify-between gap-4 pb-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-1">
            <h4 className="font-title text-body-md font-semibold text-on-surface">
              {isOwner ? "Delete this wedding" : "Leave this wedding"}
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {isOwner
                ? "Hidden immediately and recoverable for 30 days. Soft delete retains financial records for DPDP compliance before permanent cleanup."
                : "You lose access to the workspace. You'd need a new invitation to come back."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirming(isOwner ? "delete-wedding" : "leave")}
            className={DANGER_BUTTON}
          >
            {isOwner ? "Delete wedding" : "Leave wedding"}
          </button>
        </div>
        <div className="flex flex-col justify-between gap-4 pt-6 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-1">
            <h4 className="font-title text-body-md font-semibold text-on-surface">
              Delete my account
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {isOwner
                ? "Permanently remove your personal credentials and membership. As wedding owner, you must transfer ownership first."
                : "Permanently remove your personal credentials and membership."}
            </p>
          </div>
          <button type="button" onClick={requestDeleteAccount} className={DANGER_BUTTON}>
            Delete account
          </button>
        </div>
      </div>

      {confirming ? (
        <ConfirmDialog
          title={
            confirming === "leave"
              ? "Leave this wedding?"
              : confirming === "delete-wedding"
                ? "Delete this wedding workspace?"
                : "Delete your account?"
          }
          confirmLabel={
            confirming === "leave"
              ? "Leave wedding"
              : confirming === "delete-wedding"
                ? "Delete wedding"
                : "Delete account"
          }
          requireText={
            confirming === "delete-wedding"
              ? wedding.title
              : confirming === "delete-account"
                ? "DELETE"
                : undefined
          }
          danger
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setConfirming(null)}
        >
          {confirming === "leave" ? (
            <p>
              You&apos;ll lose access to {wedding.title}. You can create or join another wedding
              afterwards.
            </p>
          ) : confirming === "delete-wedding" ? (
            <p>
              This will immediately hide all schedules, guest lists, and invitations. You have 30
              days of soft-delete grace period before permanent DPDP database erasure.
            </p>
          ) : (
            <>
              <p>
                This signs you out everywhere and closes your account.
                {soleOwner ? ` ${wedding.title} is deleted too (restorable for 30 days).` : ""}
              </p>
              <p>Your email stays reserved, so it can&apos;t be used to sign up again.</p>
            </>
          )}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
