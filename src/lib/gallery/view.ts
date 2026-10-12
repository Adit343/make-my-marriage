import type { MediaVisibility } from "@/lib/constants/enums";
import { formatBytes } from "@/lib/gallery/files";

// Wording and small calculations for the Gallery screens (Stitch "Gallery Home", "Photo Viewer",
// "Sharing and Settings"). Pure functions, so the server and the browser always agree.

export const VISIBILITY_LABEL: Record<MediaVisibility, string> = {
  private: "Private",
  guests: "Guests",
  public: "Public",
};

/** What each visibility means, as the viewer's helper note says it. */
export const VISIBILITY_NOTE: Record<MediaVisibility, string> = {
  private: "Only your planning team can see this photo.",
  guests: "Anyone with a gallery link can view this photo.",
  public: "Anyone with a gallery link can view it, and it can be used on your wedding website.",
};

/** The line at the bottom of the viewer. */
export const VISIBILITY_ACCESS: Record<MediaVisibility, string> = {
  private: "Visible to: your planning team only",
  guests: "Visible to: your team and anyone with a gallery link",
  public: "Visible to: anyone with a gallery link, and your website",
};

/** At or above this share of the allowance the meter turns to a warning. */
export const NEAR_FULL_PERCENT = 90;

export function storageView(usedBytes: number, quotaBytes: number) {
  const percent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return {
    percent,
    label: `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used`,
    nearFull: percent >= NEAR_FULL_PERCENT,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
  };
}

/** "2 hours ago", "Yesterday", "3 days ago", else the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** "14 Dec 2026 · 9:42 AM" in the wedding's timezone. */
export function addedLabel(iso: string, timezone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
  return `${day} · ${time}`;
}

/** The uploader line: "Meena", or "A guest" when a guest gave no name. */
export function uploaderName(uploadedBy: {
  kind: "member" | "guest";
  name: string | null;
}): string {
  return uploadedBy.name?.trim() || (uploadedBy.kind === "guest" ? "A guest" : "A team member");
}

export function permissionsSummary(p: {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
}): string {
  const parts = [p.canView && "view", p.canUpload && "add photos", p.canDownload && "download"];
  const list = parts.filter(Boolean) as string[];
  return list.length > 0 ? `Guests can ${list.join(", ")}.` : "No access.";
}

/** "Guests can view and add photos." for the QR dialog's subtitle. */
export function guestsCanLine(p: { canView: boolean; canUpload: boolean; canDownload: boolean }) {
  const parts = [
    p.canView && "view",
    p.canUpload && "add photos",
    p.canDownload && "download",
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "Guests can't do anything with this link.";
  const last = parts.pop()!;
  return `Guests can ${parts.length > 0 ? `${parts.join(", ")} and ` : ""}${last}.`;
}

/** An expiry as a short date ("20 Feb 2027"), or "Never". */
export function expiryLabel(iso: string | null, timezone: string): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** The end of a calendar day in a timezone, as an instant: a link "until 20 Feb" works all of 20 Feb. */
export function endOfDayIso(isoDate: string, timezone: string): string {
  // Find the UTC offset of that zone on that day by formatting noon, then place 23:59:59 locally.
  const noon = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(noon);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offsetMs = asUtc - noon.getTime();
  return new Date(Date.parse(`${isoDate}T23:59:59Z`) - offsetMs).toISOString();
}
