import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/** A centered card on the brand green, for pages with a single message (not found, error). */
export function MessagePage({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-primary-container px-4 py-10 text-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <div className="w-full max-w-[440px]">
        <p className="mb-6 text-center font-headline-sm text-headline-sm font-medium tracking-tight text-surface-bright">
          Make My Marriage
        </p>
        <div className="rounded-2xl bg-surface p-8 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <Icon name={icon} className="text-[22px]" />
          </div>
          <h1 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}

export const MESSAGE_TEXT = "mb-6 font-body-sm text-body-sm text-on-surface-variant";
export const MESSAGE_BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 font-title text-[14px] font-semibold text-surface-bright shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:bg-tertiary-container focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden";
