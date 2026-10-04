"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logOut } from "@/components/auth/auth-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";

export function LogoutButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await logOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      setBusy(false);
      toast({ type: "error", title: "Couldn't log out", message: errorMessage(error) });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-60"
    >
      <Icon name="arrow_back" className="text-[16px]" />
      <span>{busy ? "Logging out..." : "Log out"}</span>
    </button>
  );
}
