"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signUpWithWorkspace, type SignUpInput } from "@/components/auth/auth-api";
import { isEmailFormat } from "@/components/auth/email-format";
import { GoogleButton } from "@/components/auth/google-button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/auth";

type Role = SignUpInput["relationship"];
type Field = "name" | "workspaceName" | "email" | "password";
type Status = "idle" | "submitting" | "done";

const ROLES: { value: Role; label: string; icon: IconName }[] = [
  { value: "couple", label: "Couple", icon: "favorite" },
  { value: "family", label: "Family Coor.", icon: "groups" },
  { value: "planner", label: "Lead Planner", icon: "event_note" },
];

const INPUT =
  "w-full rounded-lg bg-surface-container-lowest border px-3.5 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-hidden focus:ring-2 transition-all duration-150";
const INPUT_OK =
  "border-surface-dim focus:border-primary-container focus:ring-primary-container/20";
const INPUT_ERROR = "border-error focus:border-error focus:ring-error/20";

/** Signup design's meter, with its thresholds moved up to the 10-character minimum. */
function strengthOf(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= PASSWORD_MIN_LENGTH + 4) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH = [
  { label: "Weak", text: "text-on-surface-variant", bar: "bg-surface-dim", bars: 0 },
  { label: "Weak", text: "text-error", bar: "bg-error", bars: 1 },
  { label: "Fair", text: "text-secondary", bar: "bg-secondary", bars: 2 },
  { label: "Good", text: "text-tertiary-container", bar: "bg-tertiary-container", bars: 3 },
  {
    label: "Strong",
    text: "text-primary-container font-semibold",
    bar: "bg-primary-container",
    bars: 4,
  },
];

function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 font-body-sm text-[11px] text-error">
      <Icon name="error" className="text-[13px]" /> {children}
    </span>
  );
}

export function SignupForm() {
  const toast = useToast();
  const router = useRouter();
  const [role, setRole] = useState<Role>("couple");
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    workspaceName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<Field, boolean>>({
    name: false,
    workspaceName: false,
    email: false,
    password: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [redirecting, setRedirecting] = useState(false);

  function isFieldValid(field: Field, value: string): boolean {
    if (field === "email") return isEmailFormat(value);
    if (field === "password") return value.length >= PASSWORD_MIN_LENGTH;
    return value.trim().length > 0;
  }

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (isFieldValid(field, value)) setErrors((current) => ({ ...current, [field]: false }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      name: !isFieldValid("name", values.name),
      workspaceName: !isFieldValid("workspaceName", values.workspaceName),
      email: !isFieldValid("email", values.email),
      password: !isFieldValid("password", values.password),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setStatus("submitting");
    let weddingCreated: boolean;
    try {
      ({ weddingCreated } = await signUpWithWorkspace({
        name: values.name.trim(),
        workspaceName: values.workspaceName.trim(),
        relationship: role,
        email: values.email.trim(),
        password: values.password,
      }));
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        setErrors((current) => ({ ...current, email: true }));
      }
      toast({ type: "error", title: "Couldn't create your account", message: errorMessage(error) });
      return;
    }

    setStatus("done");
    toast(
      weddingCreated
        ? {
            type: "success",
            title: "Wedding workspace created!",
            message: "Opening your dashboard...",
          }
        : {
            type: "warning",
            title: "Account created",
            message:
              "We couldn't set up the workspace just now — you can create it from your dashboard.",
          },
    );
    setRedirecting(true);
    router.push("/dashboard");
  }

  const strength = STRENGTH[strengthOf(values.password)] ?? STRENGTH[0]!;

  return (
    <div className="mx-auto my-auto w-full max-w-[440px] py-6">
      <div className="mb-3">
        <span className="font-label-sm text-label-sm font-semibold tracking-widest text-secondary uppercase">
          New workspace
        </span>
      </div>
      <h2 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
        Create your wedding workspace
      </h2>
      <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">
        Set it up in minutes, then invite your family to start planning together.
      </p>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <fieldset>
          <legend className="mb-2 block font-label-md text-label-md font-medium text-on-surface">
            Your role in this celebration
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((option) => {
              const selected = option.value === role;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRole(option.value)}
                  className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all duration-150 ${
                    selected
                      ? "border-primary-container bg-primary-container/5 font-semibold text-primary-container ring-1 ring-primary-container"
                      : "border-surface-dim bg-surface-container-lowest text-on-surface-variant hover:border-outline hover:text-on-surface"
                  }`}
                >
                  <Icon name={option.icon} className="mb-0.5 text-[18px]" />
                  <span className="font-label-sm text-[11px] leading-tight">{option.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="full_name"
            >
              Full name
            </label>
            <FieldError show={errors.name}>Name is required</FieldError>
          </div>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="e.g. Ananya Sen"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={errors.name}
            className={`${INPUT} ${errors.name ? INPUT_ERROR : INPUT_OK}`}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="partner_name"
            >
              Partner name / Wedding workspace name
            </label>
            <FieldError show={errors.workspaceName}>Required</FieldError>
          </div>
          <input
            id="partner_name"
            name="partner_name"
            type="text"
            placeholder="e.g. Vikram Mehta or Ananya & Vikram"
            value={values.workspaceName}
            onChange={(event) => update("workspaceName", event.target.value)}
            aria-invalid={errors.workspaceName}
            className={`${INPUT} ${errors.workspaceName ? INPUT_ERROR : INPUT_OK}`}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="email"
            >
              Email
            </label>
            <FieldError show={errors.email}>Enter a valid email</FieldError>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={errors.email}
            className={`${INPUT} ${errors.email ? INPUT_ERROR : INPUT_OK}`}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="password"
            >
              Password
            </label>
            <FieldError show={errors.password}>
              At least {PASSWORD_MIN_LENGTH} characters
            </FieldError>
          </div>
          <div className="relative flex items-center">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
              aria-invalid={errors.password}
              className={`${INPUT} pr-11 ${errors.password ? INPUT_ERROR : INPUT_OK}`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute right-3 flex items-center justify-center p-1 text-on-surface-variant transition-colors hover:text-on-surface focus:outline-hidden"
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
            </button>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between font-body-sm text-[11px]">
              <span className="text-on-surface-variant/75">
                At least {PASSWORD_MIN_LENGTH} characters.
              </span>
              <span
                className={`font-medium capitalize transition-colors duration-200 ${strength.text}`}
              >
                {strength.label}
              </span>
            </div>
            <div className="grid h-1.5 grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`h-full rounded-full transition-colors duration-200 ${bar <= strength.bars ? strength.bar : "bg-surface-dim"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={status !== "idle"}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-title text-[15px] font-semibold tracking-normal text-surface-bright shadow-xs transition-all duration-150 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden active:scale-[0.99] ${
              status === "done"
                ? "bg-tertiary"
                : "bg-primary-container hover:-translate-y-0.5 hover:bg-tertiary-container active:translate-y-0"
            } ${status === "submitting" ? "cursor-not-allowed opacity-90" : ""}`}
          >
            {status === "submitting" ? (
              <svg
                className="h-5 w-5 animate-spin text-surface-bright"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            ) : null}
            <span>
              {status === "idle"
                ? "Create workspace"
                : status === "submitting"
                  ? "Setting up workspace..."
                  : redirecting
                    ? "Redirecting..."
                    : "Workspace Created!"}
            </span>
          </button>
        </div>
      </form>

      <div className="relative my-5 flex items-center justify-center">
        <div className="w-full border-t border-surface-dim" />
        <span className="absolute bg-surface px-3 font-body-sm text-body-sm text-on-surface-variant/80">
          or
        </span>
      </div>

      <GoogleButton className="flex w-full items-center justify-center gap-3 rounded-lg border border-surface-dim bg-surface-container-lowest px-4 py-2.5 font-label-md text-label-md font-semibold text-on-surface transition-all duration-150 hover:bg-surface-container-low active:scale-[0.99]" />

      <p className="mt-5 text-center font-body-sm text-body-sm leading-relaxed text-on-surface-variant/80">
        By creating an account, you agree to our{" "}
        <a
          href="#"
          className="font-medium text-primary-container decoration-secondary underline-offset-2 hover:underline"
        >
          Terms
        </a>{" "}
        and{" "}
        <a
          href="#"
          className="font-medium text-primary-container decoration-secondary underline-offset-2 hover:underline"
        >
          Privacy Policy
        </a>
        .
      </p>

      <div className="mt-6 border-t border-surface-dim/60 pt-5 text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Already have an account?
          <Link
            href="/login"
            className="ml-1 font-semibold text-primary-container decoration-secondary underline-offset-2 transition-colors hover:text-tertiary-container hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
