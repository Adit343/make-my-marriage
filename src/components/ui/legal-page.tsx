import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";

/** A readable single-column page for the Terms and Privacy Policy. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-on-surface">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2.5 font-headline-sm text-headline-sm font-medium tracking-tight text-primary"
        >
          <BrandMark className="h-8 w-8 shrink-0" />
          Make My Marriage
        </Link>
        <h1 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight">
          {title}
        </h1>
        <p className="mb-2 font-body-sm text-body-sm text-on-surface-variant">
          Last updated {updated}
        </p>
        <p
          role="note"
          className="mb-8 rounded-lg border border-secondary/40 bg-secondary-fixed/30 p-4 font-body-sm text-body-sm text-on-surface"
        >
          This is a plain-language draft that describes how the product works today. It has not yet
          been reviewed by a lawyer and will be replaced by a reviewed version before launch.
        </p>
        <div className="space-y-6 font-body-md text-body-md leading-relaxed text-on-surface [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-headline-sm [&_h2]:text-headline-sm [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </main>
  );
}
