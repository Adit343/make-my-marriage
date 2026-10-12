// Checks that photo storage works, end to end, with the settings in .env.local:
//
//   npm run storage:check
//
// With the four R2_* variables set it talks to your real Cloudflare R2 bucket: it asks for an upload
// address, sends a few bytes (a tiny fake JPEG header) to it, reads the object back, makes a
// download address, checks the bucket's CORS rule for your app address, and deletes the test
// object. With no R2 settings it checks the local development store instead. It prints what
// happened and never prints a key or secret.

import { randomBytes } from "node:crypto";
import { getStorage, storageStatus } from "@/infrastructure/storage";
import { getEnv } from "@/lib/env";
import { buildObjectKey, sniffPhotoType } from "@/lib/gallery/files";

const results: string[] = [];
let failed = false;
function report(ok: boolean, label: string, detail = "") {
  if (!ok) failed = true;
  results.push(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  const status = storageStatus();
  console.log(`Photo store in use: ${status.kind}`);
  if (!status.configured) {
    console.log("Photo storage is not configured. Set the four R2_* variables in .env.local.");
    process.exit(1);
  }
  const storage = getStorage();
  const env = getEnv();

  const objectId = () => randomBytes(12).toString("hex");
  const key = buildObjectKey(
    objectId(),
    objectId(),
    randomBytes(18).toString("base64url"),
    "image/jpeg",
  );
  const bytes = new Uint8Array(64);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

  try {
    // 1. An upload address, and the browser-style PUT to it.
    const uploadUrl = await storage.createUploadUrl(key, {
      contentType: "image/jpeg",
      expiresInSeconds: 120,
    });
    report(true, "made a signed upload address");
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: bytes,
    });
    report(put.ok, "uploaded a test file to the signed address", `HTTP ${put.status}`);
    if (!put.ok) {
      console.log((await put.text()).slice(0, 300).replace(/<[^>]+>/g, " "));
      return;
    }

    // 2. What the server sees when it confirms.
    const info = await storage.head(key);
    report(
      info?.sizeBytes === bytes.length,
      "read the object's size back",
      `${info?.sizeBytes} bytes`,
    );
    report(
      info?.contentType === "image/jpeg",
      "the content type was stored as sent",
      String(info?.contentType),
    );
    const start = await storage.readStart(key, 32);
    report(
      start !== null && sniffPhotoType(start) === "image/jpeg",
      "read the first bytes back and recognised a JPEG",
    );

    // 3. A view address works for anyone holding it, and an unsigned one does not.
    const viewUrl = await storage.createDownloadUrl(key, { expiresInSeconds: 120 });
    const view = await fetch(viewUrl);
    report(
      view.ok && (await view.arrayBuffer()).byteLength === bytes.length,
      "a signed view address works",
    );
    const unsigned = await fetch(viewUrl.split("?")[0]!);
    report(
      [400, 401, 403].includes(unsigned.status),
      "the same address without its signature is refused",
      `HTTP ${unsigned.status}`,
    );

    // 4. The browser will be on your app's address: does the bucket's CORS rule allow it?
    if (status.kind === "r2") {
      const origin = new URL(env.APP_URL).origin;
      const preflight = await fetch(uploadUrl, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "PUT",
          "access-control-request-headers": "content-type",
        },
      });
      const allowedOrigin = preflight.headers.get("access-control-allow-origin");
      const allowedMethods = preflight.headers.get("access-control-allow-methods") ?? "";
      report(
        preflight.ok &&
          (allowedOrigin === origin || allowedOrigin === "*") &&
          /PUT/i.test(allowedMethods),
        `the bucket's CORS rule lets ${origin} upload with PUT`,
        preflight.ok ? `allows ${allowedOrigin ?? "nothing"}` : `HTTP ${preflight.status}`,
      );
    }
  } finally {
    // 5. Leave nothing behind.
    await storage.remove(key).catch(() => undefined);
    const gone = await storage.head(key).catch(() => "error");
    report(gone === null, "deleted the test file");
  }
}

main()
  .catch((error) => {
    failed = true;
    results.push(
      ` FAIL  unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    );
  })
  .finally(() => {
    console.log(results.join("\n"));
    console.log(failed ? "\nSomething needs attention (see above)." : "\nPhoto storage works.");
    process.exit(failed ? 1 : 0);
  });
