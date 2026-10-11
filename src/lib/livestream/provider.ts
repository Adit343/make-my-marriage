import type { StreamProvider } from "@/lib/constants/enums";

// Live stream links (DB Design §6.16). The video always plays on YouTube or Vimeo: this app only
// checks the address belongs to the chosen platform, and, where the platform allows it, works out
// the embeddable player address. For "other" any https address is accepted and shown as a link.

export const PROVIDER_LABEL: Record<StreamProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  other: "Other",
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{4,15}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{6,32}$/;

export type StreamUrlCheck =
  { ok: true; url: string; embedUrl: string | null } | { ok: false; message: string };

function youtubeId(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "youtu.be") return parts[0] && YOUTUBE_ID.test(parts[0]) ? parts[0] : null;
  const fromQuery = url.searchParams.get("v");
  if (url.pathname === "/watch" && fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;
  const second = parts[1];
  if (
    ["live", "embed", "shorts", "v"].includes(parts[0] ?? "") &&
    second &&
    YOUTUBE_ID.test(second)
  ) {
    return second;
  }
  return null;
}

function vimeoEmbed(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  // vimeo.com/event/<id> is a Vimeo live event: it has its own embed address.
  if (parts[0] === "event" && parts[1] && VIMEO_ID.test(parts[1])) {
    return `https://vimeo.com/event/${parts[1]}/embed`;
  }
  // player.vimeo.com/video/<id>?h=<hash> or vimeo.com/<id>[/<hash>] (unlisted videos carry a hash).
  const idIndex = parts[0] === "video" ? 1 : 0;
  const id = parts[idIndex];
  if (!id || !VIMEO_ID.test(id)) return null;
  const hash = url.searchParams.get("h") ?? parts[idIndex + 1];
  return hash && VIMEO_HASH.test(hash)
    ? `https://player.vimeo.com/video/${id}?h=${hash}`
    : `https://player.vimeo.com/video/${id}`;
}

/** Checks a pasted address against the platform the member chose. */
export function checkStreamUrl(provider: StreamProvider, raw: string): StreamUrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Paste the full link, starting with https://" };
  }
  if (url.protocol !== "https:") return { ok: false, message: "The link must start with https://" };
  if (url.username || url.password) {
    return { ok: false, message: "Remove the sign-in details from the link." };
  }
  const host = url.hostname.toLowerCase();

  if (provider === "youtube") {
    if (!YOUTUBE_HOSTS.has(host)) {
      return { ok: false, message: "This doesn't look like a YouTube link." };
    }
    const id = youtubeId(url);
    return {
      ok: true,
      url: url.toString(),
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null,
    };
  }
  if (provider === "vimeo") {
    if (!VIMEO_HOSTS.has(host)) {
      return { ok: false, message: "This doesn't look like a Vimeo link." };
    }
    return { ok: true, url: url.toString(), embedUrl: vimeoEmbed(url) };
  }
  return { ok: true, url: url.toString(), embedUrl: null };
}
