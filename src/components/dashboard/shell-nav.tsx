"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";

// Whether the navigation drawer is open on a phone or small tablet. The menu button lives in the
// top bar and the drawer in the sidebar, so the two share this small piece of state.

interface ShellNav {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The top bar's menu button, which gets focus back when the drawer closes. */
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}

const ShellNavContext = createContext<ShellNav>({
  open: false,
  setOpen: () => {},
  menuButtonRef: { current: null },
});

export function ShellNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The page the drawer was opened on: following a link to another page closes it with no effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes it; the page behind does not scroll while it is open on a phone.
  useEffect(() => {
    if (!open) return;
    const button = menuButtonRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (button?.isConnected && button.getClientRects().length > 0) button.focus();
    };
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen: (next: boolean) => setOpenOn(next ? pathname : null), menuButtonRef }),
    [open, pathname],
  );
  return <ShellNavContext.Provider value={value}>{children}</ShellNavContext.Provider>;
}

export function useShellNav() {
  return useContext(ShellNavContext);
}
