"use client";

import { useState } from "react";
import { GOOGLE_SIGN_IN_AVAILABLE } from "@/components/auth/auth-api";
import { GoogleLogo } from "@/components/ui/google-logo";
import { useToast } from "@/components/ui/toast";

/** "Continue with Google". Starts the server-side OAuth flow once it exists (step 1.5). */
export function GoogleButton({ className }: { className: string }) {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);

  function handleClick() {
    if (GOOGLE_SIGN_IN_AVAILABLE) {
      // A full navigation, not router.push: the API route answers with a redirect to Google.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/api/v1/auth/google");
      return;
    }
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      toast({
        type: "info",
        title: "Google sign-in",
        message: "Google sign-in isn't connected yet. Use email and password for now.",
      });
    }, 1400);
  }

  return (
    <button type="button" disabled={connecting} onClick={handleClick} className={className}>
      {connecting ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-primary-container" />
      ) : (
        <GoogleLogo />
      )}
      <span>{connecting ? "Connecting to Google Accounts..." : "Continue with Google"}</span>
    </button>
  );
}
