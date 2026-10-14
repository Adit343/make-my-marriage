"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";

export interface LandingNavLink {
  href: string;
  label: string;
  active?: boolean;
}

/**
 * The marketing page's sticky header. From a laptop up the links sit in the bar; on phones and
 * tablets they move into a menu under the bar so every section stays reachable, and the sign-up
 * button shortens so the bar never wraps.
 */
export function LandingHeader({ links }: { links: LandingNavLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-surface/90 shadow-xs backdrop-blur-md transition-all duration-200">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 md:px-12">
        <Link
          href="/"
          className="inline-flex min-w-0 items-center gap-2 font-headline-sm text-[19px] leading-6 font-medium tracking-tight text-primary transition-opacity hover:opacity-90 sm:gap-2.5 sm:text-headline-sm"
        >
          <BrandMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <span className="truncate">Make My Marriage</span>
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 lg:flex xl:gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={
                link.active
                  ? "font-label-md text-label-md font-semibold text-primary"
                  : "font-label-md text-label-md text-on-surface-variant transition-colors duration-150 hover:text-primary"
              }
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-5">
          <Link
            href="/login"
            className="hidden font-label-md text-label-md text-on-surface-variant transition-colors duration-150 hover:text-primary sm:inline"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary-container px-3.5 py-2 font-label-md text-label-md whitespace-nowrap text-on-primary shadow-xs transition-all duration-200 hover:bg-primary active:scale-[0.99] sm:px-5 sm:py-2.5"
          >
            <span className="sm:hidden">Start free</span>
            <span className="hidden sm:inline">Start planning free</span>
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-menu"
            onClick={() => setOpen((value) => !value)}
            className="-mr-1.5 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-hidden lg:hidden"
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="landing-menu"
          aria-label="Sections"
          className="border-t border-on-surface/5 bg-surface px-4 py-3 shadow-lg sm:px-6 lg:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 font-label-md text-body-sm text-on-surface transition-colors hover:bg-surface-container"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="sm:hidden">
              <Link
                href="/login"
                className="block rounded-lg px-3 py-3 font-label-md text-body-sm font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
