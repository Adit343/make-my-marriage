import { apiRequest } from "@/lib/client/api-client";
import type { SlugAvailability } from "@/modules/website/website.service";
import type { WebsiteDto } from "@/modules/website/website.dto";

// Browser calls to the wedding website API (API Design §10).

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}/website`;

export function createWebsite(weddingId: string) {
  return apiRequest<WebsiteDto>(base(weddingId), { method: "POST" });
}

export function getWebsite(weddingId: string) {
  return apiRequest<WebsiteDto | null>(base(weddingId));
}

export function updateWebsite(
  weddingId: string,
  version: number,
  changes: Record<string, unknown>,
) {
  return apiRequest<WebsiteDto>(base(weddingId), {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function publishWebsite(weddingId: string) {
  return apiRequest<WebsiteDto>(`${base(weddingId)}/publish`, { method: "POST" });
}

export function unpublishWebsite(weddingId: string) {
  return apiRequest<WebsiteDto>(`${base(weddingId)}/unpublish`, { method: "POST" });
}

export function checkSlug(weddingId: string, slug: string, signal?: AbortSignal) {
  return apiRequest<{ slug: string; availability: SlugAvailability }>(
    `${base(weddingId)}/slug-check?slug=${encodeURIComponent(slug)}`,
    { signal },
  );
}
