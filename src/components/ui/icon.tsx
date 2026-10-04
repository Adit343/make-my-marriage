// Material Symbols Outlined, loaded as a subset containing only these glyphs (~17 KB instead of
// the full multi-megabyte font). To use a new icon, add its name here — the list must stay in
// alphabetical order, which the Google Fonts `icon_names` parameter requires.
const ICON_NAMES = [
  "account_balance",
  "account_balance_wallet",
  "add",
  "arrow_back",
  "arrow_forward",
  "arrow_outward",
  "assignment_turned_in",
  "calendar_month",
  "check",
  "check_circle",
  "checklist",
  "chevron_right",
  "close",
  "dashboard",
  "diversity_3",
  "edit",
  "encrypted",
  "error",
  "event_note",
  "expand_more",
  "favorite",
  "group",
  "group_add",
  "groups",
  "handshake",
  "info",
  "key",
  "laptop_chromebook",
  "link",
  "lock",
  "lock_person",
  "lock_reset",
  "login",
  "logout",
  "mail",
  "mark_chat_unread",
  "mark_email_read",
  "menu",
  "notifications",
  "person_add",
  "person_outline",
  "photo",
  "photo_camera",
  "photo_library",
  "pin_drop",
  "progress_activity",
  "refresh",
  "restaurant",
  "schedule",
  "send",
  "settings",
  "share",
  "shield",
  "storefront",
  "support_agent",
  "task_alt",
  "update",
  "verified",
  "verified_user",
  "videocam",
  "visibility",
  "visibility_off",
  "warning",
  "web",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

// Optical size 20–24 and weight 350–400 cover both the marketing/auth screens (24/400) and the
// lighter dashboard style (20/350) for ~0.3 KB more than a single static instance.
export const MATERIAL_SYMBOLS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,350..400,0,0" +
  `&icon_names=${ICON_NAMES.join(",")}&display=block`;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={className ? `ms-icon ${className}` : "ms-icon"}>
      {name}
    </span>
  );
}
