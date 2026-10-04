"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

// Toast notifications in the react-toastify style of the Stitch auth screens: top-right, slide-in,
// progress bar, pause on hover. Implemented locally — no extra dependency.

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastInput {
  type?: ToastType;
  title?: string;
  message: string;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "title">> {
  id: number;
  title?: string;
}

const STYLES: Record<
  ToastType,
  { icon: IconName; iconColor: string; border: string; progress: string; title: string }
> = {
  success: {
    icon: "check_circle",
    iconColor: "text-[#1f4d3d]",
    border: "border-[#1f4d3d]/25",
    progress: "bg-[#1f4d3d]",
    title: "text-[#023627]",
  },
  error: {
    icon: "error",
    iconColor: "text-[#ba1a1a]",
    border: "border-[#ba1a1a]/30",
    progress: "bg-[#ba1a1a]",
    title: "text-[#ba1a1a]",
  },
  warning: {
    icon: "warning",
    iconColor: "text-[#8b4f2b]",
    border: "border-[#8b4f2b]/30",
    progress: "bg-[#8b4f2b]",
    title: "text-[#8b4f2b]",
  },
  info: {
    icon: "info",
    iconColor: "text-[#3a6756]",
    border: "border-[#3a6756]/25",
    progress: "bg-[#3a6756]",
    title: "text-on-surface",
  },
};

const EXIT_ANIMATION_MS = 300;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast() must be used inside <ToastProvider>");
  return show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    const id = ++nextId.current;
    setToasts((current) => [
      ...current,
      {
        id,
        type: toast.type ?? "info",
        title: toast.title,
        message: toast.message,
        duration: toast.duration ?? 4500,
      },
    ]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-5 right-5 z-[100] flex w-full max-w-[380px] flex-col gap-3 px-3 sm:max-w-[400px] sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onRemove={remove} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastCard({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const style = STYLES[toast.type];

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), EXIT_ANIMATION_MS);
  }, [onRemove, toast.id]);

  const resume = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(dismiss, Math.max(remaining.current, 600));
  }, [dismiss]);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  }, []);

  useEffect(() => {
    resume();
    return () => clearTimeout(timer.current);
  }, [resume]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={resume}
      className={`toast-card pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-[0_10px_25px_-5px_rgba(31,27,23,0.12),0_8px_10px_-6px_rgba(31,27,23,0.06)] transition-all duration-300 ${style.border} ${leaving ? "toast-exit" : "toast-enter"}`}
    >
      <div className="flex items-start gap-3">
        <Icon name={style.icon} className={`mt-0.5 shrink-0 text-[22px] ${style.iconColor}`} />
        <div className="min-w-0 flex-1 pr-2">
          {toast.title ? (
            <h4 className={`font-title text-[14px] leading-snug font-semibold ${style.title}`}>
              {toast.title}
            </h4>
          ) : null}
          <p className="mt-0.5 font-body-sm text-[13px] leading-relaxed break-words text-on-surface-variant">
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={dismiss}
          className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-on-surface-variant/40 transition-colors hover:bg-surface-container hover:text-on-surface-variant focus:outline-hidden"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>
      <div className="absolute right-0 bottom-0 left-0 h-[3.5px] bg-[#FAF6F0]">
        <div
          className={`toast-progress h-full ${style.progress}`}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      </div>
    </div>
  );
}
