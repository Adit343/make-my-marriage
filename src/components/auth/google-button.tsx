"use client";

import { useState } from "react";
import { GoogleLogo } from "@/components/ui/google-logo";

/**
 * "Continue with Google": a full-page navigation to the OAuth start route, which redirects to
 * Google (or back to /login?error=… when Google sign-in isn't configured).
 */
export function GoogleButton({ className }: { className: string }) {
  const [connecting, setConnecting] = useState(false);

  function handleClick() {
    setConnecting(true);
    // Not router.push: the API route answers with a redirect to Google.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/api/v1/auth/google");
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
