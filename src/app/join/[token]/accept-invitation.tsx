"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvitation, logOut } from "@/components/auth/auth-api";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";

type Status = "idle" | "joining" | "done";

/** The signed-in, no-wedding-yet branch of /join/<token>: one click to accept. */
export function AcceptInvitation({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");

  async function handleAccept() {
    setStatus("joining");
    try {
      const { wedding } = await acceptInvitation(token);
      setStatus("done");
      toast({
        type: "success",
        title: "You're in!",
        message: `Welcome to ${wedding.title}. Opening the dashboard...`,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      toast({ type: "error", title: "Couldn't join", message: errorMessage(error) });
      // The link may have just been used or withdrawn: refresh so the page shows the right state.
      router.refresh();
    }
  }

  async function switchAccount() {
    try {
      await logOut();
    } finally {
      router.push(`/login?invite=${token}`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleAccept}
        disabled={status !== "idle"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 font-title text-[14px] font-semibold text-surface-bright shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:bg-tertiary-container focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-90"
      >
        {status === "joining" ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-bright/30 border-t-surface-bright" />
        ) : null}
        <span>
          {status === "idle"
            ? "Accept invitation"
            : status === "joining"
              ? "Joining..."
              : "Welcome aboard!"}
        </span>
      </button>
      <p className="text-center font-body-sm text-[13px] text-on-surface-variant">
        Signed in as <strong className="font-semibold text-on-surface">{email}</strong>
        {" • "}
        <button
          type="button"
          onClick={switchAccount}
          className="underline transition-colors hover:text-primary focus:outline-hidden"
        >
          Switch account
        </button>
      </p>
    </div>
  );
}
