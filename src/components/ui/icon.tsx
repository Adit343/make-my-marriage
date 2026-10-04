// Material Symbols Outlined, loaded as a subset containing only these glyphs (~12 KB instead of
// the full multi-megabyte font). To use a new icon, add its name here — the list must stay in
// alphabetical order, which the Google Fonts `icon_names` parameter requires.
const ICON_NAMES = [
  "account_balance",
  "account_balance_wallet",
  "add",
  "arrow_back",
  "arrow_forward",
  "arrow_outward",
  "calendar_month",
  "check",
  "check_circle",
  "close",
  "edit",
  "encrypted",
  "error",
  "event_note",
  "favorite",
  "group",
  "group_add",
  "groups",
  "info",
  "key",
  "link",
  "lock",
  "lock_person",
  "lock_reset",
  "login",
  "mail",
  "mark_chat_unread",
  "mark_email_read",
  "person_add",
  "photo",
  "photo_camera",
  "photo_library",
  "progress_activity",
  "refresh",
  "restaurant",
  "send",
  "share",
  "shield",
  "task_alt",
  "update",
  "verified",
  "verified_user",
  "visibility",
  "visibility_off",
  "warning",
  "web",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const MATERIAL_SYMBOLS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" +
  `&icon_names=${ICON_NAMES.join(",")}&display=block`;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={className ? `ms-icon ${className}` : "ms-icon"}>
      {name}
    </span>
  );
}
