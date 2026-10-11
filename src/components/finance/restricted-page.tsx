import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/** Shown to a member who opens a page that is for owners and admins (Vendors, Website: decision D3). */
export function RestrictedPage({
  title = "Vendors are for owners and admins",
  body = "Vendor contact details and terms are kept private. You can still see and record every expense, including which vendor it was paid to.",
  href = "/dashboard/expenses",
  linkLabel = "Go to Expenses",
}: {
  title?: string;
  body?: string;
  href?: string;
  linkLabel?: string;
} = {}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-8 py-16 text-center">
      <Icon name="lock" className="text-[30px] text-outline" />
      <h1 className="font-headline-md text-headline-md font-normal text-primary">{title}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>
      <Link
        href={href}
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-body-sm text-body-sm font-medium text-on-primary transition-colors hover:bg-tertiary"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
