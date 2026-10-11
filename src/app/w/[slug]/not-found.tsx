import type { Metadata } from "next";
import { MESSAGE_TEXT, MessagePage } from "@/components/ui/message-page";

export const metadata: Metadata = {
  title: "Website not available — Make My Marriage",
  robots: { index: false, follow: false },
};

// A guest opened a wedding website address that doesn't lead anywhere: mistyped, not published yet,
// or taken down. Every such case reads the same, and nothing here points to the couple's
// dashboard, because the visitor is a guest. Not designed in Stitch: built in the same message-page
// style as the app's other "not found" screens.
export default function SiteNotAvailable() {
  return (
    <MessagePage icon="link_off" title="This website isn't available">
      <p className={MESSAGE_TEXT}>
        The address may be mistyped, or the couple haven&apos;t published their website yet. Please
        ask them to share the link again.
      </p>
    </MessagePage>
  );
}
