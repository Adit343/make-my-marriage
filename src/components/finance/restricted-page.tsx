import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/** Shown to a member who opens a page that is for owners and admins (Vendors, decision D3). */
export function RestrictedPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-8 py-16 text-center">
      <Icon name="lock" className="text-[30px] text-outline" />
      <h1 className="font-headline-md text-headline-md font-normal text-primary">
        Vendors are for owners and admins
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Vendor contact details and terms are kept private. You can still see and record every
        expense, including which vendor it was paid to.
      </p>
      <Link
        href="/dashboard/expenses"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-body-sm text-body-sm font-medium text-on-primary transition-colors hover:bg-tertiary"
      >
        Go to Expenses
      </Link>
    </div>
  );
}
