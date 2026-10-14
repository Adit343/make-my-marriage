"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { FIELD, FIELD_SM } from "@/components/ui/field-styles";
import { Icon, type IconName } from "@/components/ui/icon";
import { Popover, useCompactScreen } from "@/components/ui/popover";

// A dropdown drawn in the app's own style, replacing the browser's native <select> menu (which
// ignores the theme, can't be styled and looks different on every device). It behaves like a
// real listbox: full keyboard control (arrows, Home/End, type-ahead, Enter, Escape), screen
// reader roles, and on phones it opens as a bottom sheet with large tap targets.

export interface SelectOption {
  value: string;
  label: string;
  /** A smaller second line under the label. */
  hint?: string;
  disabled?: boolean;
  /** Heading the option belongs to (from an <optgroup>). */
  group?: string;
}

/** Reads <option> and <optgroup> children so existing markup can be passed through unchanged. */
export function optionsFromChildren(children: ReactNode, group?: string): SelectOption[] {
  const found: SelectOption[] = [];
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const element = child as ReactElement<{
      value?: string | number;
      label?: string;
      disabled?: boolean;
      children?: ReactNode;
    }>;
    if (element.type === Fragment) {
      found.push(...optionsFromChildren(element.props.children, group));
    } else if (element.type === "optgroup") {
      found.push(...optionsFromChildren(element.props.children, element.props.label));
    } else if (element.type === "option") {
      const text = Children.toArray(element.props.children)
        .filter((node) => typeof node === "string" || typeof node === "number")
        .join("");
      found.push({
        value: String(element.props.value ?? text),
        label: text,
        disabled: element.props.disabled,
        group,
      });
    }
  }
  return found;
}

export type SelectVariant = "field" | "field-sm" | "pill" | "chip" | "inline";

const TRIGGER_BASE: Record<SelectVariant, string> = {
  field: `${FIELD} flex cursor-pointer items-center gap-2 text-left`,
  "field-sm": `${FIELD_SM} flex cursor-pointer items-center gap-2 text-left`,
  pill: "flex cursor-pointer items-center gap-2 rounded-full border border-on-background/10 bg-surface-container-lowest px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface outline-none transition-all hover:border-on-background/20 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
  chip: "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2A2622]/[0.08] bg-[#FAF6F0] px-2.5 py-1 text-on-surface-variant outline-none transition-all hover:border-[#2A2622]/20 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15",
  inline:
    "flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2A2622]/12 bg-[#FFFDF9] py-1.5 pr-2 pl-3 font-body-sm text-body-sm font-semibold text-primary outline-none transition-all hover:bg-[#F4EFEA] focus-visible:ring-2 focus-visible:ring-primary/30",
};

export function Select({
  id,
  value,
  onChange,
  options,
  children,
  placeholder = "Select…",
  icon,
  disabled,
  ariaLabel,
  invalid,
  describedBy,
  variant = "field",
  fieldClass,
  prefix,
  title,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Either `options` or <option> children. */
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  /** A leading icon inside the field. */
  icon?: IconName;
  disabled?: boolean;
  /** A name for the control when no <label for> points at it. */
  ariaLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  variant?: SelectVariant;
  /** Replaces the standard field look (border, background, padding, type) for the field variants, so a screen with its own input style can match it. */
  fieldClass?: string;
  /** Small text in front of the value, used by filter pills ("Event:"). */
  prefix?: string;
  /** Heading of the phone bottom sheet; defaults to the aria label or prefix. */
  title?: string;
  /** Extra classes for the control itself. */
  className?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const listId = `${controlId}-list`;
  const items = useMemo(() => options ?? optionsFromChildren(children), [options, children]);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const chosen = selectedIndex >= 0 ? items[selectedIndex] : undefined;
  // A disabled option with no value is a prompt ("Select relationship"), not a choice.
  const selected = chosen && !(chosen.disabled && chosen.value === "") ? chosen : undefined;
  const compact = useCompactScreen();

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [labelText, setLabelText] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const enabledIndexes = items.flatMap((item, index) => (item.disabled ? [] : [index]));

  function openList() {
    if (disabled || items.length === 0) return;
    setActive(selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? -1));
    // The field's own label names the phone sheet ("Event type", "Timezone").
    const label = document.querySelector(`label[for="${controlId}"]`);
    setLabelText(
      (label?.textContent ?? "")
        .replace(/\s*\*\s*$/, "")
        .replace(/\(optional\)/i, "")
        .trim(),
    );
    setOpen(true);
  }

  function choose(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    setOpen(false);
    if (item.value !== value) onChange(item.value);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function move(step: 1 | -1) {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(active);
    const next =
      position === -1
        ? step === 1
          ? 0
          : enabledIndexes.length - 1
        : Math.min(Math.max(position + step, 0), enabledIndexes.length - 1);
    setActive(enabledIndexes[next]!);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else move(event.key === "ArrowDown" ? 1 : -1);
        return;
      case "Home":
      case "End":
        if (!open) return;
        event.preventDefault();
        setActive(enabledIndexes[event.key === "Home" ? 0 : enabledIndexes.length - 1] ?? -1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) openList();
        else choose(active);
        return;
      case "Tab":
        if (open) setOpen(false);
        return;
    }
    // Type-ahead: "ha" jumps to the first option starting "ha", as a native select does.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const state = typed.current;
      state.text =
        now - state.at > 700 ? event.key.toLowerCase() : state.text + event.key.toLowerCase();
      state.at = now;
      const match = items.findIndex(
        (item) => !item.disabled && item.label.toLowerCase().startsWith(state.text),
      );
      if (match >= 0) {
        if (!open) openList();
        setActive(match);
      }
    }
  }

  // Keep the highlighted option visible while moving with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${controlId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, controlId]);

  const groupFor = (index: number) => {
    const group = items[index]?.group;
    return group && items[index - 1]?.group !== group ? group : null;
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${controlId}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
        className={`${fieldClass && (variant === "field" || variant === "field-sm") ? `${fieldClass} flex cursor-pointer items-center gap-2 text-left` : TRIGGER_BASE[variant]} ${invalid ? "border-error" : ""} ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        } ${className}`}
      >
        {icon ? <Icon name={icon} className="shrink-0 text-[18px] text-[#1F4D3D]" /> : null}
        {prefix ? <span className="shrink-0 text-on-surface-variant">{prefix}</span> : null}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? (variant === "pill" ? "font-medium text-primary" : "") : "text-[#6A645D]"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <Icon
          name="expand_more"

          className={`shrink-0 text-[18px] text-on-surface-variant transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <Popover
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          title={
            title ||
            labelText ||
            ariaLabel ||
            (prefix ? prefix.replace(/:$/, "") : "Choose an option")
          }
          matchWidth={variant === "field" || variant === "field-sm"}
          maxHeight={288}
          className={variant === "field" || variant === "field-sm" ? "" : "min-w-52"}
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? title ?? prefix?.replace(/:$/, "") ?? "Options"}
            className="p-1.5"
          >
            {items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === active;
              const group = groupFor(index);
              return (
                <Fragment key={`${item.value}-${index}`}>
                  {group ? (
                    <li
                      role="presentation"
                      className="px-3 pt-2.5 pb-1 font-label-sm text-label-sm tracking-wider text-outline uppercase"
                    >
                      {group}
                    </li>
                  ) : null}
                  <li
                    id={`${controlId}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={item.disabled || undefined}
                    onMouseMove={() => !item.disabled && !isActive && setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 ${
                      compact ? "min-h-12 py-2.5" : "py-2"
                    } font-body-sm text-body-sm transition-colors ${
                      item.disabled
                        ? "cursor-not-allowed text-[#2A2622]/35"
                        : isSelected
                          ? "bg-primary-fixed/45 font-semibold text-primary"
                          : isActive
                            ? "bg-surface-container text-[#2A2622]"
                            : "text-[#2A2622]"
                    } ${isSelected && isActive ? "bg-primary-fixed/70" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="block truncate text-[12px] font-normal text-on-surface-variant">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Icon name="check" className="shrink-0 text-[18px] text-primary" />
                    ) : null}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </Popover>
      ) : null}
    </>
  );
}
