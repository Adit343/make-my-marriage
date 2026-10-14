"use client";

import { useId, type ReactNode } from "react";
import { FIELD, LABEL } from "@/components/ui/field-styles";
import { Icon, type IconName } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { currencySymbol } from "@/lib/finance/money";

// Small pieces the Expenses and Vendors screens share, in the Stitch style used by the Tasks and
// Guests screens (cream fields, green primary, terracotta accents).

export { FIELD, LABEL };
export const BUTTON_PRIMARY =
  "flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all duration-150 hover:bg-tertiary active:scale-[0.99]";
export const BUTTON_SECONDARY =
  "rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]";

/** The pill filter used across the app's list screens: "Category: All" opening a themed list. */
export function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      variant="pill"
      prefix={`${label}:`}
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={options}
      className="max-w-full"
    />
  );
}

/** A dropdown drawn like the other form fields, with an optional leading icon. */
export function SelectField({
  id,
  value,
  onChange,
  icon,
  children,
  disabled,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  icon?: IconName;
  /** <option> elements, as for a native select. */
  children: ReactNode;
  disabled?: boolean;
  /** A name for the control when no <label for> points at it. */
  ariaLabel?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      icon={icon}
      disabled={disabled}
      ariaLabel={ariaLabel}
    >
      {children}
    </Select>
  );
}

/** A money box with the currency symbol in front. The value is what was typed ("1,65,000"). */
export function AmountField({
  id,
  value,
  onChange,
  currency,
  invalid,
  describedBy,
  autoFocus,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-body-md text-[#2A2622]/60"
      >
        {currencySymbol(currency)}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${FIELD} pl-9 ${invalid ? "border-error" : ""} ${className}`}
      />
    </div>
  );
}

/** Label + control + optional hint/error, wired together for assistive technology. */
export function Field({
  label,
  htmlFor,
  optional,
  required,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  optional?: boolean;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
        {required ? <span className="text-secondary"> *</span> : null}
        {optional ? <span className="font-normal text-on-surface-variant"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={hintId} role="alert" className="font-body-sm text-[12px] text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="font-body-sm text-[12px] text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

/** A small rounded tag ("Booked", "Overdue", "Wedding Ceremony"). */
export function Chip({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: "neutral" | "green" | "terracotta" | "red" | "grey";
  children: ReactNode;
  dot?: boolean;
}) {
  const tones = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    green: "bg-primary-fixed/50 text-primary",
    terracotta: "bg-secondary-fixed/50 text-on-secondary-container",
    red: "bg-error-container/60 text-on-error-container",
    grey: "bg-surface-container text-on-surface-variant",
  } as const;
  const dots = {
    neutral: "bg-on-surface-variant",
    green: "bg-primary",
    terracotta: "bg-secondary",
    red: "bg-error",
    grey: "bg-outline",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-label-sm text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} /> : null}
      {children}
    </span>
  );
}

/** The thin progress bar under money figures: paid share of the cost. */
export function ProgressBar({
  percent,
  label,
  tone = "green",
}: {
  percent: number;
  label: string;
  tone?: "green" | "terracotta";
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
    >
      <div
        className={`h-full rounded-full ${tone === "green" ? "bg-primary" : "bg-secondary"}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** The empty-state card used when a list has nothing to show yet. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-16 text-center">
      <Icon name={icon} className="text-[28px] text-outline" />
      <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">{title}</h2>
      <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
