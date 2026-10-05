// A short, human label for a session's User-Agent ("Chrome on Windows"), for the Settings
// "Active sessions" list. Deliberately small: it only needs to tell devices apart, not to be a
// full UA parser, and unknown agents fall back to "Unknown device".

export type DeviceKind = "laptop" | "phone" | "tablet";

export interface DeviceDescription {
  label: string;
  kind: DeviceKind;
}

export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? "";
  if (!ua) return { label: "Unknown device", kind: "laptop" };

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;

  const tablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const phone = !tablet && /iPhone|Android.*Mobile|Mobile/.test(ua);
  const os = /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux|X11/.test(ua)
            ? "Linux"
            : null;

  const label = browser && os ? `${browser} on ${os}` : (browser ?? os ?? "Unknown device");
  return { label, kind: tablet ? "tablet" : phone ? "phone" : "laptop" };
}

/** "Active now" within five minutes, otherwise "Last active 2 hours ago". */
export function lastActiveLabel(lastUsedAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - lastUsedAt.getTime()) / 60_000);
  if (minutes < 5) return "Active now";
  if (minutes < 60) return `Last active ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Last active ${days} ${days === 1 ? "day" : "days"} ago`;
}
