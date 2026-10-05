"use client";

import { useState } from "react";
import { GoogleLogo } from "@/components/ui/google-logo";

/**
 * "Continue with Google": a full-page navigation to the OAuth start route, which redirects to
 * Google (or back to /login?error=… when Google sign-in isn't configured). `next` is an
 * invitation path (/join/<token>) to return to afterwards; the server validates it.
 */
export function GoogleButton({ className, next }: { className: string; next?: string }) {
  const [connecting, setConnecting] = useState(false);

  function handleClick() {
    setConnecting(true);
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    // Not router.push: the API route answers with a redirect to Google.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/v1/auth/google${query}`);
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
