"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { logIn } from "@/components/auth/auth-api";
import { isEmailFormat } from "@/components/auth/email-format";
import { GoogleButton } from "@/components/auth/google-button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/auth";

type Feedback = "none" | "valid" | "invalid";
type Status = "idle" | "submitting" | "done";

const INPUT_BASE =
  "w-full rounded-lg bg-surface-container-lowest border px-3.5 py-2.5 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-hidden transition-all duration-150";
const INPUT_NEUTRAL =
  "border-outline-variant/50 focus:border-primary-container focus:ring-2 focus:ring-primary-container/20";
const INPUT_VALID = "border-primary-container ring-2 ring-primary-container/20";
const INPUT_INVALID = "border-error ring-2 ring-error/20";

export function LoginForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [emailFeedback, setEmailFeedback] = useState<Feedback>("none");
  const [password, setPassword] = useState("");
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [redirecting, setRedirecting] = useState(false);

  const passwordValid = password.length >= PASSWORD_MIN_LENGTH;

  function handleEmailChange(value: string) {
    setEmail(value);
    if (isEmailFormat(value)) setEmailFeedback("valid");
    else if (value.trim() === "") setEmailFeedback("none");
    else if (emailFeedback === "valid") setEmailFeedback("none");
  }

  function handleEmailBlur() {
    if (email.trim() === "") setEmailFeedback("none");
    else setEmailFeedback(isEmailFormat(email) ? "valid" : "invalid");
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (value.length === 0 || value.length >= PASSWORD_MIN_LENGTH) setPasswordInvalid(false);
  }

  function handleRememberMe(checked: boolean) {
    setRememberMe(checked);
    if (checked) {
      toast({
        type: "info",
        title: "Preferences saved",
        message: "You'll stay signed in on this browser.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailOk = isEmailFormat(email);
    setEmailFeedback(emailOk ? "valid" : "invalid");
    setPasswordInvalid(!passwordValid);
    if (!emailOk || !passwordValid) {
      toast({
        type: "error",
        title: "Invalid information",
        message: "Please check your email and password format.",
      });
      return;
    }

    setStatus("submitting");
    await logIn({ email: email.trim(), password, rememberMe });
    setStatus("done");
    toast({
      type: "success",
      title: "Welcome back",
      message: "Signed in successfully. Opening your workspace...",
    });
    setTimeout(() => setRedirecting(true), 1000);
  }

  const emailClass =
    emailFeedback === "valid"
      ? INPUT_VALID
      : emailFeedback === "invalid"
        ? INPUT_INVALID
        : INPUT_NEUTRAL;

  return (
    <div className="mx-auto w-full max-w-[420px] py-4">
      <div className="mb-8">
        <span className="mb-2 inline-block font-label-md text-label-md tracking-widest text-secondary uppercase">
          Welcome back
        </span>
        <h2 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
          Sign in to your wedding workspace
        </h2>
        <p className="font-body-sm text-body-sm font-normal text-on-surface-variant">
          Plan together with your family and planner, all in one place.
        </p>
      </div>

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="email"
            >
              Email address
            </label>
            {emailFeedback === "invalid" ? (
              <span className="font-label-sm text-[11px] text-error">Valid email required</span>
            ) : null}
          </div>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="e.g. aarav@example.com"
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              onBlur={handleEmailBlur}
              aria-invalid={emailFeedback === "invalid"}
              className={`${INPUT_BASE} ${emailClass}`}
            />
            {emailFeedback !== "none" ? (
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors duration-150 ${emailFeedback === "valid" ? "text-primary-container" : "text-error"}`}
              >
                <Icon
                  name={emailFeedback === "valid" ? "check_circle" : "error"}
                  className="text-[18px]"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="block font-label-md text-label-md font-medium text-on-surface"
              htmlFor="password"
            >
              Password
            </label>
            {passwordInvalid ? (
              <span className="font-label-sm text-[11px] text-error">
                At least {PASSWORD_MIN_LENGTH} characters required
              </span>
            ) : null}
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(event) => handlePasswordChange(event.target.value)}
              onBlur={() => setPasswordInvalid(password.length > 0 && !passwordValid)}
              aria-invalid={passwordInvalid}
              className={`${INPUT_BASE} pr-11 ${passwordInvalid ? INPUT_INVALID : INPUT_NEUTRAL}`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-on-surface-variant/60 transition-colors hover:text-on-surface focus:outline-hidden"
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <label
              className="group relative flex cursor-pointer items-center gap-2 select-none"
              htmlFor="rememberMe"
            >
              <div className="relative flex items-center justify-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="peer sr-only"
                  checked={rememberMe}
                  onChange={(event) => handleRememberMe(event.target.checked)}
                />
                <div className="flex h-4 w-4 items-center justify-center rounded border border-outline-variant/70 bg-surface-container-lowest transition-all group-hover:border-primary-container peer-checked:border-primary-container peer-checked:bg-primary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/30">
                  <Icon
                    name="check"
                    className={`text-[13px] text-white transition-opacity ${rememberMe ? "opacity-100" : "opacity-0"}`}
                  />
                </div>
              </div>
              <span className="font-body-sm text-[13px] text-on-surface-variant transition-colors group-hover:text-on-surface">
                Remember me
              </span>
            </label>
            <Link
              href="/forgot-password"
              className="font-body-sm text-body-sm text-on-surface-variant transition-colors duration-150 hover:text-primary focus:underline focus:outline-hidden"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={status !== "idle"}
          className={`relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-title text-[14px] font-semibold text-surface-bright shadow-xs transition-all duration-150 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden ${
            status === "done"
              ? "bg-[#14532d]"
              : "bg-primary-container hover:-translate-y-0.5 hover:bg-tertiary-container active:translate-y-0"
          } ${status === "submitting" ? "cursor-not-allowed opacity-90" : ""}`}
        >
          {status === "submitting" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-bright/30 border-t-surface-bright" />
          ) : null}
          <span>
            {status === "idle"
              ? "Log in"
              : status === "submitting"
                ? "Verifying credentials..."
                : redirecting
                  ? "Redirecting to workspace..."
                  : "Authenticated!"}
          </span>
        </button>

        <div className="relative py-2">
          <div aria-hidden="true" className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/40" />
          </div>
          <div className="relative flex justify-center font-label-sm text-label-sm uppercase">
            <span className="bg-surface px-3 tracking-wider text-on-surface-variant/70">
              or continue with
            </span>
          </div>
        </div>

        <GoogleButton className="flex min-h-[46px] w-full items-center justify-center gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 font-title text-[14px] font-medium text-on-surface shadow-xs transition-all duration-150 hover:bg-surface-container-low hover:shadow-sm focus:ring-2 focus:ring-primary-container/20 focus:outline-hidden active:scale-[0.99]" />
      </form>

      <p className="mt-7 text-center font-body-sm text-body-sm text-on-surface-variant">
        Don&apos;t have an account?
        <Link
          href="/signup"
          className="ml-1 font-semibold text-primary-container decoration-secondary transition-colors hover:underline focus:outline-hidden"
        >
          Create wedding workspace
        </Link>
      </p>

      <div className="mt-10 flex items-center justify-center gap-2 border-t border-outline-variant/30 pt-6 font-label-sm text-label-sm text-on-surface-variant/60">
        <Icon name="lock" className="text-[15px]" />
        <span>256-bit encrypted • Indian DPDP Act compliant workspace</span>
      </div>
    </div>
  );
}
