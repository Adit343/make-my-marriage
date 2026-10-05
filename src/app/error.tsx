"use client";

import { useEffect } from "react";
import { MESSAGE_BUTTON, MESSAGE_TEXT, MessagePage } from "@/components/ui/message-page";

// Catches unexpected errors in any page. Shows nothing about the error itself (no message, no
// stack): the server has already logged it, and `digest` lets us find that log line.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("page.error", error.digest ?? "");
  }, [error]);

  return (
    <MessagePage icon="error" title="Something went wrong">
      <p className={MESSAGE_TEXT}>
        That didn&apos;t work on our side. Your information is safe — please try again.
        {error.digest ? ` If it keeps happening, quote reference ${error.digest}.` : ""}
      </p>
      <button type="button" onClick={reset} className={MESSAGE_BUTTON}>
        Try again
      </button>
    </MessagePage>
  );
}
