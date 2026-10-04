"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { resetPassword } from "@/components/auth/auth-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/auth";

const REDIRECT_SECONDS = 3;

function strengthOf(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH = [
  { label: "Security: Standard", text: "text-on-surface-variant", bar: "", bars: 0 },
  { label: "Security: Weak", text: "text-[#8B4F2B] font-semibold", bar: "bg-[#8B4F2B]", bars: 1 },
  {
    label: "Security: Moderate",
    text: "text-[#8B4F2B] font-semibold",
    bar: "bg-[#FEAF83]",
    bars: 2,
  },
  {
    label: "Security: Good",
    text: "text-[#1F4D3D] font-semibold",
    bar: "bg-[#1F4D3D]/70",
    bars: 3,
  },
  {
    label: "Security: Strong password",
    text: "text-[#1F4D3D] font-bold",
    bar: "bg-[#1F4D3D]",
    bars: 4,
  },
];

const INPUT =
  "h-12 w-full rounded-lg border bg-surface-container-lowest px-4 pr-11 font-body-md text-on-surface placeholder:text-on-surface-variant/40 transition-all duration-150 focus:border-[#1F4D3D] focus:ring-4 focus:ring-[#1F4D3D]/10 focus:outline-hidden";

export function ResetPasswordForm({ token }: { token: string }) {
  const toast = useToast();
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      const timer = setTimeout(() => router.push("/login"), 500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setRedirectIn((seconds) => (seconds ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirectIn, router]);

  const lengthMet = password.length >= PASSWORD_MIN_LENGTH;
  const strength = password ? (STRENGTH[strengthOf(password)] ?? STRENGTH[0]!) : STRENGTH[0]!;
  const matches = confirm.length > 0 && password === confirm;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password) {
      setPasswordError(true);
      toast({ type: "error", title: "Missing Password", message: "Please enter a new password." });
      passwordRef.current?.focus();
      return;
    }
    if (!lengthMet) {
      setPasswordError(true);
      toast({
        type: "error",
        title: "Password Too Short",
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
      });
      passwordRef.current?.focus();
      return;
    }
    if (!confirm) {
      setConfirmError(true);
      toast({
        type: "error",
        title: "Confirmation Required",
        message: "Please confirm your new password.",
      });
      confirmRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setConfirmError(true);
      toast({
        type: "error",
        title: "Mismatch Error",
        message: "Passwords do not match. Please re-enter identical passwords.",
      });
      confirmRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, password });
    } catch (error) {
      const invalidLink = error instanceof ApiError && error.code === "INVALID_TOKEN";
      toast({
        type: "error",
        title: invalidLink ? "Link expired" : "Couldn't update your password",
        message: invalidLink
          ? "This reset link is invalid, already used or expired. Request a new one from the login page."
          : errorMessage(error),
      });
      return;
    } finally {
      setSubmitting(false);
    }
    toast({
      type: "success",
      title: "Password Updated",
      message: "Your new credentials have been verified and updated.",
    });
    setRedirectIn(REDIRECT_SECONDS);
  }

  return (
    <>
      <div className="mx-auto my-auto w-full max-w-[420px] py-8">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 text-secondary">
          <Icon name="lock_reset" className="text-[14px]" />
          <span className="font-label-sm text-label-sm tracking-widest uppercase">
            ACCOUNT SECURITY
          </span>
        </div>
        <h2 className="mb-2 font-headline-lg text-headline-lg tracking-tight text-[#2A2622]">
          Set a new password
        </h2>
        <p className="mb-8 font-body-md text-body-md text-on-surface-variant">
          Choose a new password for your account.
        </p>

        <form className="space-y-6" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className="block font-label-md text-label-md text-[#2A2622]"
                htmlFor="new-password"
              >
                New password
              </label>
              <span className={`font-label-sm text-label-sm transition-colors ${strength.text}`}>
                {strength.label}
              </span>
            </div>
            <div className="relative">
              <input
                ref={passwordRef}
                id="new-password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={`Enter at least ${PASSWORD_MIN_LENGTH} characters`}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (event.target.value.length >= PASSWORD_MIN_LENGTH) setPasswordError(false);
                }}
                aria-invalid={passwordError}
                className={`${INPUT} ${passwordError && !lengthMet ? "border-error" : "border-[#2A2622]/15"}`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center justify-center p-1 text-on-surface-variant/70 transition-colors hover:text-[#2A2622] focus:outline-hidden"
              >
                <Icon
                  name={showPassword ? "visibility_off" : "visibility"}
                  className="text-[20px]"
                />
              </button>
            </div>
            <div className="flex items-center justify-between pt-1.5">
              <span
                className={`flex items-center gap-1.5 font-body-sm text-body-sm transition-colors ${
                  lengthMet
                    ? "font-medium text-[#1F4D3D]"
                    : passwordError
                      ? "text-error"
                      : "text-on-surface-variant/80"
                }`}
              >
                {lengthMet ? (
                  <Icon name="check" className="text-[14px] font-bold text-[#1F4D3D]" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary transition-all" />
                )}
                At least {PASSWORD_MIN_LENGTH} characters
              </span>
              <div aria-hidden="true" className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={`h-1 w-5 rounded-full transition-all duration-300 ${bar <= strength.bars ? strength.bar : "bg-[#2A2622]/15"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="block font-label-md text-label-md text-[#2A2622]"
              htmlFor="confirm-password"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                ref={confirmRef}
                id="confirm-password"
                name="confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setConfirmError(false);
                }}
                aria-invalid={mismatch || confirmError}
                className={`${INPUT} ${mismatch || confirmError ? "border-error" : matches ? "border-[#1F4D3D]" : "border-[#2A2622]/15"}`}
              />
              <button
                type="button"
                aria-label={
                  showConfirm ? "Hide password confirmation" : "Show password confirmation"
                }
                onClick={() => setShowConfirm((shown) => !shown)}
                className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center justify-center p-1 text-on-surface-variant/70 transition-colors hover:text-[#2A2622] focus:outline-hidden"
              >
                <Icon
                  name={showConfirm ? "visibility_off" : "visibility"}
                  className="text-[20px]"
                />
              </button>
            </div>
            <div className="min-h-[20px] pt-0.5">
              {mismatch ? (
                <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-error">
                  <Icon name="error" className="text-[16px]" />
                  <span>Passwords do not match</span>
                </p>
              ) : matches ? (
                <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-[#1F4D3D]">
                  <Icon name="check_circle" className="text-[16px]" />
                  <span>Passwords match</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="group flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1F4D3D] px-6 font-label-md text-label-md tracking-wider text-[#FAF6F0] shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#163A2E] focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden active:translate-y-0 disabled:pointer-events-none disabled:opacity-75"
            >
              <span>{submitting ? "Updating password..." : "Update password"}</span>
              <Icon
                name={submitting ? "progress_activity" : "arrow_forward"}
                className={`text-[18px] transition-transform duration-150 ${submitting ? "animate-spin" : "group-hover:translate-x-0.5"}`}
              />
            </button>
          </div>
        </form>

        <div className="mt-10 flex items-center justify-center gap-2 border-t border-[#2A2622]/8 pt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="encrypted" className="text-[18px] text-[#1F4D3D]" />
          <span>256-bit encrypted • Indian DPDP Act compliant workspace</span>
        </div>
      </div>

      {redirectIn !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-updated-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B17]/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md animate-fade-up rounded-2xl border border-[#2A2622]/10 bg-[#FAF6F0] p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1F4D3D]/10 text-[#1F4D3D]">
              <Icon name="check_circle" className="text-[32px]" />
            </div>
            <span className="mb-1 inline-block font-label-sm text-label-sm font-bold tracking-widest text-[#1F4D3D] uppercase">
              Success
            </span>
            <h3
              id="password-updated-title"
              className="mb-2 font-headline-md text-headline-md text-[#2A2622]"
            >
              Password Updated
            </h3>
            <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
              {redirectIn > 0
                ? `Password updated successfully! Redirecting to workspace login in ${redirectIn} seconds...`
                : "Redirecting to login now..."}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1F4D3D] px-6 font-label-md text-label-md tracking-wider text-[#FAF6F0] shadow-xs transition-all hover:bg-[#163A2E]"
              >
                <span>Proceed to Login</span>
                <Icon name="login" className="text-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setRedirectIn(null)}
                className="py-2 font-label-md text-xs text-on-surface-variant transition-colors hover:text-[#2A2622]"
              >
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
