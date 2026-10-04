"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

/** A designed call-to-action whose feature isn't built yet: explains itself instead of failing. */
export function ComingSoonButton({
  children,
  title,
  message,
  icon,
  iconAfter,
  className,
}: {
  children: React.ReactNode;
  title: string;
  message: string;
  icon?: IconName;
  iconAfter?: IconName;
  className: string;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ type: "info", title, message })}
      className={className}
    >
      {icon ? <Icon name={icon} className="text-[17px]" /> : null}
      {children}
      {iconAfter ? (
        <Icon
          name={iconAfter}
          className="text-[14px] transition-transform group-hover:translate-x-0.5"
        />
      ) : null}
    </button>
  );
}
