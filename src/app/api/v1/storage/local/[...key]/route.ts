import { localStorageSettings, storageStatus } from "@/infrastructure/storage";
import { readLocalObject, verifyLocalLink, writeLocalObject } from "@/infrastructure/storage/local";
import { MAX_PHOTO_BYTES } from "@/lib/constants/gallery";

// The development photo store's upload and view address (see infrastructure/storage/local.ts). It
// stands in for Cloudflare R2's presigned URLs: the link itself, signed by us and expiring, is the
// only credential. It answers 404 whenever the local store is not the active one (so never in
// production, and never when R2 is configured). These two handlers move raw file bytes, so they do
// not use the JSON route() pipeline; the route-inventory test lists them on purpose.

const notFound = () => new Response("Not found", { status: 404 });
const forbidden = () => new Response("This link is invalid or has expired", { status: 403 });

type Context = { params: Promise<{ key: string[] }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  if (storageStatus().kind !== "local") return notFound();
  const key = (await context.params).key.join("/");
  const settings = localStorageSettings();
  const url = new URL(request.url);
  if (!verifyLocalLink(settings.secret, "put", key, url.searchParams)) return forbidden();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES) return new Response("Too large", { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    return new Response(bytes.length === 0 ? "Empty file" : "Too large", {
      status: bytes.length === 0 ? 400 : 413,
    });
  }
  const contentType =
    request.headers.get("content-type") ?? url.searchParams.get("ct") ?? "application/octet-stream";
  const stored = await writeLocalObject(settings.directory, key, bytes, contentType);
  return stored ? new Response(null, { status: 200 }) : notFound();
}

export async function GET(request: Request, context: Context): Promise<Response> {
  if (storageStatus().kind !== "local") return notFound();
  const key = (await context.params).key.join("/");
  const settings = localStorageSettings();
  const url = new URL(request.url);
  if (!verifyLocalLink(settings.secret, "get", key, url.searchParams)) return forbidden();

  const object = await readLocalObject(settings.directory, key);
  if (!object) return notFound();
  const headers = new Headers({
    "content-type": object.contentType,
    "content-length": String(object.bytes.length),
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
  });
  const downloadAs = url.searchParams.get("dl");
  if (downloadAs) {
    const safe = downloadAs.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    headers.set("content-disposition", `attachment; filename="${safe}"`);
  }
  return new Response(object.bytes as BodyInit, { headers });
}
