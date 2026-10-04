"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/components/auth/auth-api";
import { isEmailFormat } from "@/components/auth/email-format";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/constants/auth";

const RESEND_COOLDOWN_SECONDS = 45;
const EMPTY_MESSAGE = "Please enter your registered email address";
const FORMAT_MESSAGE = "Please enter a valid email address (e.g. name@domain.com)";

export function ForgotPasswordFlow() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailOk, setEmailOk] = useState(false);
  const [sending, setSending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleInput(value: string) {
    setEmail(value);
    const valid = isEmailFormat(value);
    setEmailOk(valid);
    if (value.trim() === "" || valid) setError(null);
    else if (error) setError(FORMAT_MESSAGE);
  }

  function handleBlur() {
    if (email.trim() === "") setError(EMPTY_MESSAGE);
    else if (!isEmailFormat(email)) setError(FORMAT_MESSAGE);
    else setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!isEmailFormat(value)) {
      setError(value === "" ? EMPTY_MESSAGE : FORMAT_MESSAGE);
      inputRef.current?.focus();
      toast({
        type: "error",
        title: "Validation Error",
        message: "Please provide a valid email before continuing",
      });
      return;
    }

    setSending(true);
    await requestPasswordReset(value);
    setSending(false);
    setSubmittedEmail(value);
    setView("sent");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast({
      type: "success",
      title: "Reset link dispatched!",
      message: `A secure temporary token has been sent to ${value}.`,
    });
  }

  async function handleResend() {
    setResending(true);
    await requestPasswordReset(submittedEmail);
    setResending(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast({
      type: "success",
      title: "New Link Sent",
      message: `A fresh authentication token has been dispatched to ${submittedEmail}`,
    });
  }

  function changeEmail() {
    setCooldown(0);
    setView("form");
    requestAnimationFrame(() => inputRef.current?.select());
  }

  if (view === "sent") {
    const canResend = cooldown <= 0 && !resending;
    return (
      <div className="relative mx-auto my-auto w-full max-w-[420px] animate-fade-up py-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-[#e8f3ee] text-primary shadow-xs">
          <Icon name="mark_email_read" className="text-[28px]" />
        </div>
        <div className="mb-2">
          <span className="rounded-full bg-[#e1efe8] px-2.5 py-1 font-label-sm text-label-sm font-semibold tracking-widest text-[#023627]">
            DISPATCHED SUCCESSFULLY
          </span>
        </div>
        <h2 className="mb-3 font-headline-lg text-headline-lg font-normal tracking-tight text-on-surface">
          Check your inbox
        </h2>
        <p className="mb-6 font-body-md text-body-md leading-relaxed text-on-surface-variant">
          We&apos;ve dispatched a temporary recovery link to{" "}
          <strong className="font-semibold text-on-surface underline decoration-primary/30">
            {submittedEmail}
          </strong>
          . It expires in {PASSWORD_RESET_TTL_MINUTES} minutes.
        </p>

        <div className="mb-8 space-y-2 rounded-xl border border-[#E5DFD7] bg-surface-container p-4">
          <div className="flex items-center gap-2 font-title text-[13px] font-semibold text-primary">
            <Icon name="verified_user" className="text-[17px]" />
            <span>Didn&apos;t see the email?</span>
          </div>
          <p className="font-body-sm text-[13px] leading-normal text-on-surface-variant">
            Check your spam or quarantine folder, or wait for the cooldown timer below to generate a
            new verification token.
          </p>
        </div>

        <div className="space-y-3.5">
          <button
            type="button"
            disabled={!canResend}
            onClick={handleResend}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-6 py-3.5 font-title text-[14px] font-medium tracking-normal transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-75 ${
              canResend
                ? "border-transparent bg-primary-container text-[#FAF6F0] hover:bg-[#163A2E]"
                : "border-[#d8cfc5] bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <Icon
              name={resending ? "progress_activity" : canResend ? "refresh" : "update"}
              className={`text-[18px] ${resending ? "animate-spin" : ""}`}
            />
            <span>
              {resending
                ? "Resending link..."
                : canResend
                  ? "Resend link now"
                  : `Resend available in ${cooldown}s`}
            </span>
          </button>
          <button
            type="button"
            onClick={changeEmail}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-6 py-3 font-title text-[14px] font-medium text-primary transition-all duration-150 hover:bg-surface-container hover:text-[#023627]"
          >
            <Icon name="edit" className="text-[17px]" />
            <span>Change email address</span>
          </button>
        </div>

        <div className="mt-8 border-t border-[#2A2622]/[0.06] pt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            <span>Back to login</span>
          </Link>
        </div>
      </div>
    );
  }

  const inputState = error
    ? "border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500/20"
    : emailOk
      ? "border-[#1f4d3d] focus:border-primary-container focus:ring-4 focus:ring-primary-container/10"
      : "border-[#E5DFD7] focus:border-primary-container focus:ring-4 focus:ring-primary-container/10";

  return (
    <div className="relative mx-auto my-auto w-full max-w-[420px] animate-fade-up py-10">
      <div className="mb-3">
        <span className="font-label-sm text-label-sm font-semibold tracking-widest text-secondary">
          PASSWORD RECOVERY
        </span>
      </div>
      <div className="mb-8">
        <h2 className="mb-2 font-headline-lg text-headline-lg font-normal tracking-tight text-on-surface">
          Reset your password
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Enter your email and we&apos;ll send you a secure link to reset your account credentials.
        </p>
      </div>

      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-2 block font-title text-[14px] font-medium text-on-surface"
            htmlFor="email"
          >
            Registered email address
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="aarav@example.com"
              value={email}
              onChange={(event) => handleInput(event.target.value)}
              onBlur={handleBlur}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "email-error" : "email-helper"}
              className={`w-full rounded-lg border bg-surface-container-lowest px-4 py-3.5 pr-11 font-body-md text-on-surface shadow-[0_1px_3px_0_rgba(42,38,34,0.02)] transition-all duration-150 placeholder:text-on-surface-variant/40 focus:outline-hidden ${inputState}`}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
              <Icon
                name={error ? "error" : emailOk ? "check_circle" : "mail"}
                className={`text-[20px] transition-colors duration-150 ${error ? "text-red-500" : emailOk ? "text-emerald-600" : "text-on-surface-variant/50"}`}
              />
            </div>
          </div>
          {error ? (
            <p
              id="email-error"
              role="alert"
              className="mt-2 flex items-center gap-1.5 font-body-sm text-body-sm text-[#ba1a1a]"
            >
              <Icon name="error" className="text-[16px] text-[#ba1a1a]" />
              <span>{error}</span>
            </p>
          ) : (
            <p
              id="email-helper"
              className="mt-2 font-body-sm text-body-sm text-on-surface-variant/70"
            >
              A temporary authentication link valid for {PASSWORD_RESET_TTL_MINUTES} minutes will be
              dispatched.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={sending}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3.5 font-title text-[15px] font-medium tracking-normal text-[#FAF6F0] shadow-xs transition-all duration-150 hover:bg-[#163A2E] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-80"
        >
          <span>{sending ? "Sending secure link..." : "Send reset link"}</span>
          <Icon
            name={sending ? "progress_activity" : "arrow_forward"}
            className={`text-[18px] transition-transform ${sending ? "animate-spin" : "group-hover:translate-x-0.5"}`}
          />
        </button>
      </form>

      <div className="mt-8 border-t border-[#2A2622]/[0.06] pt-6 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">
          Remembered your password?
          <Link
            href="/login"
            className="ml-1 font-medium text-primary underline underline-offset-4 transition-colors hover:font-semibold hover:text-primary-container"
          >
            Log in
          </Link>
        </p>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() =>
            toast({
              type: "info",
              title: "Need Help?",
              message:
                "Contact your wedding coordinator if you no longer have access to this email.",
            })
          }
          className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant/70 underline-offset-2 transition-colors hover:text-primary hover:underline"
        >
          Cannot access your email? Contact family coordinator support
        </button>
      </div>
    </div>
  );
}
