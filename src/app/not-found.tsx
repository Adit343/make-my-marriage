import type { Metadata } from "next";
import Link from "next/link";
import { MESSAGE_BUTTON, MESSAGE_TEXT, MessagePage } from "@/components/ui/message-page";

export const metadata: Metadata = { title: "Page not found — Make My Marriage" };

// Not designed in Stitch yet: built in the auth screens' visual language until a design exists.
export default function NotFound() {
  return (
    <MessagePage icon="error" title="We can't find that page">
      <p className={MESSAGE_TEXT}>
        The link may be mistyped or out of date. If someone sent you an invitation, ask them for a
        new link.
      </p>
      <Link href="/dashboard" className={MESSAGE_BUTTON}>
        Go to my dashboard
      </Link>
    </MessagePage>
  );
}
