import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalProvider,
  readLocalObject,
  resolveLocalPath,
  verifyLocalLink,
  writeLocalObject,
} from "@/infrastructure/storage/local";
import { createR2Provider } from "@/infrastructure/storage/r2";

const WEDDING = "6acbcd6533ba8a64f91799bb";
const ASSET = "6acbcd6533ba8a64f91799c4";
const KEY = `weddings/${WEDDING}/gallery/${ASSET}/nGhWgxnp9AVBqDThTAJRfj3F.jpg`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);

describe("the local photo store", () => {
  let dir = "";
  const config = () => ({ directory: dir, appUrl: "http://localhost:3000", secret: "test-secret" });

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "mmm-store-"));
  });
  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a file: head, first bytes, read, remove", async () => {
    const store = createLocalProvider(config());
    expect(await store.head(KEY)).toBeNull();
    expect(await store.readStart(KEY, 4)).toBeNull();

    expect(await writeLocalObject(dir, KEY, JPEG, "image/jpeg")).toBe(true);
    expect(await store.head(KEY)).toEqual({ sizeBytes: JPEG.length, contentType: "image/jpeg" });
    expect([...(await store.readStart(KEY, 4))!]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    // Asking for more than the file has returns what exists.
    expect((await store.readStart(KEY, 99))!.length).toBe(JPEG.length);
    expect((await readLocalObject(dir, KEY))!.contentType).toBe("image/jpeg");

    await store.remove(KEY);
    expect(await store.head(KEY)).toBeNull();
    await store.remove(KEY); // removing what is gone is not an error
  });

  it("makes upload and view addresses that its own checker accepts, for that key and purpose only", async () => {
    const store = createLocalProvider(config());
    const put = new URL(
      await store.createUploadUrl(KEY, { contentType: "image/jpeg", expiresInSeconds: 600 }),
    );
    const get = new URL(
      await store.createDownloadUrl(KEY, { expiresInSeconds: 600, downloadAs: "a b.jpg" }),
    );
    expect(put.origin).toBe("http://localhost:3000");
    expect(put.pathname).toBe(`/api/v1/storage/local/${KEY}`);

    expect(verifyLocalLink("test-secret", "put", KEY, put.searchParams)).toBe(true);
    expect(verifyLocalLink("test-secret", "get", KEY, get.searchParams)).toBe(true);
    // Wrong purpose, wrong key, wrong secret.
    expect(verifyLocalLink("test-secret", "get", KEY, put.searchParams)).toBe(false);
    expect(verifyLocalLink("test-secret", "put", KEY, get.searchParams)).toBe(false);
    expect(verifyLocalLink("test-secret", "put", KEY.replace("jpg", "png"), put.searchParams)).toBe(
      false,
    );
    expect(verifyLocalLink("other-secret", "put", KEY, put.searchParams)).toBe(false);
  });

  it("makes addresses that stop working when they expire or are altered", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-02-14T10:00:00Z"));
    const store = createLocalProvider(config());
    const url = new URL(await store.createDownloadUrl(KEY, { expiresInSeconds: 60 }));
    expect(verifyLocalLink("test-secret", "get", KEY, url.searchParams)).toBe(true);

    const later = Date.now() + 61_000;
    expect(verifyLocalLink("test-secret", "get", KEY, url.searchParams, later)).toBe(false);

    const extended = new URLSearchParams(url.searchParams);
    extended.set("exp", String(Number(extended.get("exp")) + 100_000));
    expect(verifyLocalLink("test-secret", "get", KEY, extended)).toBe(false);
    const renamed = new URLSearchParams(url.searchParams);
    renamed.set("dl", "evil.html");
    expect(verifyLocalLink("test-secret", "get", KEY, renamed)).toBe(false);
    const unsigned = new URLSearchParams(url.searchParams);
    unsigned.delete("sig");
    expect(verifyLocalLink("test-secret", "get", KEY, unsigned)).toBe(false);
    expect(
      verifyLocalLink("test-secret", "get", KEY, new URLSearchParams("op=get&exp=abc&sig=x")),
    ).toBe(false);
  });

  it("refuses any key that is not one of ours, so nothing outside its folder is reachable", async () => {
    const store = createLocalProvider(config());
    for (const key of [
      "../../etc/passwd",
      `weddings/${WEDDING}/gallery/${ASSET}/../../../secret.jpg`,
      "/etc/passwd",
      "weddings/x/gallery/y/z.jpg",
      "C:\\Windows\\win.ini",
      "",
    ]) {
      expect(resolveLocalPath(dir, key), key).toBeNull();
      await expect(
        store.createUploadUrl(key, { contentType: "image/jpeg", expiresInSeconds: 1 }),
      ).rejects.toThrow();
      await expect(store.head(key)).rejects.toThrow();
      expect(await writeLocalObject(dir, key, JPEG, "image/jpeg")).toBe(false);
      expect(await readLocalObject(dir, key)).toBeNull();
    }
    expect(resolveLocalPath(dir, KEY)!.startsWith(path.resolve(dir))).toBe(true);
  });
});

describe("the Cloudflare R2 store", () => {
  const config = {
    accountId: "abc123def456",
    accessKeyId: "AKIATESTKEY",
    secretAccessKey: "test-secret-access-key",
    bucket: "mmm-photos",
  };
  afterEach(() => vi.unstubAllGlobals());

  it("presigns an upload address on the account's R2 host, in path style, expiring as asked", async () => {
    const store = createR2Provider(config);
    const url = new URL(
      await store.createUploadUrl(KEY, { contentType: "image/jpeg", expiresInSeconds: 600 }),
    );
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("abc123def456.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/mmm-photos/${KEY}`);
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(
      /^AKIATESTKEY\/\d{8}\/auto\/s3\/aws4_request$/,
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    // The secret never appears in the address.
    expect(url.toString()).not.toContain("test-secret-access-key");
  });

  it("signs different keys and methods differently", async () => {
    const store = createR2Provider(config);
    const sig = (u: string) => new URL(u).searchParams.get("X-Amz-Signature");
    const put = await store.createUploadUrl(KEY, {
      contentType: "image/jpeg",
      expiresInSeconds: 600,
    });
    const get = await store.createDownloadUrl(KEY, { expiresInSeconds: 600 });
    const other = await store.createDownloadUrl(KEY.replace("jpg", "png"), {
      expiresInSeconds: 600,
    });
    expect(new Set([sig(put), sig(get), sig(other)]).size).toBe(3);
  });

  it("asks the browser to save a download under a safe name", async () => {
    const store = createR2Provider(config);
    const url = new URL(
      await store.createDownloadUrl(KEY, {
        expiresInSeconds: 3600,
        downloadAs: 'Haldi "Mama" é.jpg',
      }),
    );
    const disposition = url.searchParams.get("response-content-disposition")!;
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="Haldi Mama _.jpg"');
    expect(disposition).toContain("filename*=UTF-8''Haldi%20Mama%20%C3%A9.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    const plain = new URL(await store.createDownloadUrl(KEY, { expiresInSeconds: 3600 }));
    expect(plain.searchParams.has("response-content-disposition")).toBe(false);
  });

  it("reads an object's size and type with a signed HEAD, and treats 404 as 'not there'", async () => {
    const calls: Request[] = [];
    vi.stubGlobal("fetch", async (input: Request | string, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request);
      return request.method === "HEAD" && request.url.includes("present")
        ? new Response(null, {
            status: 200,
            headers: { "content-length": "4096", "content-type": "image/jpeg" },
          })
        : new Response(null, { status: 404 });
    });
    const store = createR2Provider(config);
    expect(await store.head(KEY.replace("nGhW", "present"))).toEqual({
      sizeBytes: 4096,
      contentType: "image/jpeg",
    });
    expect(await store.head(KEY)).toBeNull();
    expect(calls[0]!.method).toBe("HEAD");
    expect(calls[0]!.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIATESTKEY\//,
    );
  });

  it("reads only the first bytes with a signed range request", async () => {
    let seen: Request | null = null;
    vi.stubGlobal("fetch", async (input: Request | string, init?: RequestInit) => {
      seen = new Request(input, init);
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]), { status: 206 });
    });
    const start = await createR2Provider(config).readStart(KEY, 4);
    expect(seen!.headers.get("range")).toBe("bytes=0-3");
    expect([...start!]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it("deletes with a signed DELETE, tolerates 404, and reports other failures", async () => {
    let status = 204;
    const methods: string[] = [];
    vi.stubGlobal("fetch", async (input: Request | string, init?: RequestInit) => {
      methods.push(new Request(input, init).method);
      return new Response(null, { status });
    });
    const store = createR2Provider(config);
    await expect(store.remove(KEY)).resolves.toBeUndefined();
    status = 404;
    await expect(store.remove(KEY)).resolves.toBeUndefined();
    status = 500;
    await expect(store.remove(KEY)).rejects.toThrow("status 500");
    expect(new Set(methods)).toEqual(new Set(["DELETE"]));
  });

  it("reports a failing HEAD instead of pretending the object is missing", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
    await expect(createR2Provider(config).head(KEY)).rejects.toThrow("status 503");
  });
});
