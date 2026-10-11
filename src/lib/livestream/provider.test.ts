import { describe, expect, it } from "vitest";
import { checkStreamUrl } from "@/lib/livestream/provider";

const ok = (provider: "youtube" | "vimeo" | "other", url: string) => {
  const result = checkStreamUrl(provider, url);
  if (!result.ok) throw new Error(`expected ok: ${result.message}`);
  return result;
};

describe("checkStreamUrl: YouTube", () => {
  const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("embeds %s", (url) => {
    expect(ok("youtube", url).embedUrl).toBe(embed);
  });

  it("links, without embedding, a YouTube page that is not one video", () => {
    expect(ok("youtube", "https://www.youtube.com/@aaravdiya/live").embedUrl).toBeNull();
    expect(ok("youtube", "https://www.youtube.com/channel/UC123456789/live").embedUrl).toBeNull();
    expect(ok("youtube", "https://www.youtube.com/watch?v=").embedUrl).toBeNull();
  });

  it("never lets a crafted video id break out of the embed address", () => {
    const result = ok("youtube", 'https://www.youtube.com/watch?v=abc"onload="x');
    expect(result.embedUrl).toBeNull();
    expect(ok("youtube", "https://youtu.be/../../evil").embedUrl).toBeNull();
  });

  it("refuses other hosts, including look-alikes", () => {
    for (const url of [
      "https://vimeo.com/76979871",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
      "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      const result = checkStreamUrl("youtube", url);
      expect(result, url).toMatchObject({
        ok: false,
        message: "This doesn't look like a YouTube link.",
      });
    }
  });
});

describe("checkStreamUrl: Vimeo", () => {
  it("embeds a video, with the hash an unlisted video carries", () => {
    expect(ok("vimeo", "https://vimeo.com/76979871").embedUrl).toBe(
      "https://player.vimeo.com/video/76979871",
    );
    expect(ok("vimeo", "https://vimeo.com/76979871/abcdef1234").embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?h=abcdef1234",
    );
    expect(ok("vimeo", "https://player.vimeo.com/video/76979871?h=abcdef1234").embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?h=abcdef1234",
    );
  });

  it("embeds a Vimeo live event with its own embed address", () => {
    expect(ok("vimeo", "https://vimeo.com/event/4417").embedUrl).toBe(
      "https://vimeo.com/event/4417/embed",
    );
  });

  it("links a Vimeo page that is not a video, and refuses other hosts", () => {
    expect(ok("vimeo", "https://vimeo.com/aaravdiya").embedUrl).toBeNull();
    expect(checkStreamUrl("vimeo", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      ok: false,
      message: "This doesn't look like a Vimeo link.",
    });
    expect(checkStreamUrl("vimeo", "https://vimeo.com.evil.example/76979871")).toMatchObject({
      ok: false,
    });
  });
});

describe("checkStreamUrl: any platform", () => {
  it("accepts any https address for 'other' and never embeds it", () => {
    const result = ok("other", "https://stream.example.org/live/1");
    expect(result.embedUrl).toBeNull();
    expect(result.url).toBe("https://stream.example.org/live/1");
  });

  it.each([
    ["http://www.youtube.com/watch?v=dQw4w9WgXcQ", "The link must start with https://"],
    ["javascript:alert(1)", "The link must start with https://"],
    ["data:text/html,<script>1</script>", "The link must start with https://"],
    ["not a link", "Paste the full link, starting with https://"],
    ["", "Paste the full link, starting with https://"],
    [
      "https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "Remove the sign-in details from the link.",
    ],
  ])("refuses %s", (url, message) => {
    expect(checkStreamUrl("youtube", url)).toEqual({ ok: false, message });
  });

  it("trims what was pasted", () => {
    expect(ok("youtube", "  https://youtu.be/dQw4w9WgXcQ \n").embedUrl).toContain("dQw4w9WgXcQ");
  });
});
