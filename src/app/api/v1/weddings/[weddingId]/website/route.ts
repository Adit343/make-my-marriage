import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { updateWebsiteBody, websiteParams } from "@/modules/website/website.schemas";
import { createWebsite, getWebsite, updateWebsite } from "@/modules/website/website.service";

// API Design §10.1. Reading is open to every member; setting up and editing the site is owner and
// admin (decision D3). A GET never creates the site (§2.9): "set up" is the explicit POST.

export const GET = route(
  { params: websiteParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await getWebsite(auth) }),
);

export const POST = route(
  { params: websiteParams, auth: requireWeddingAccess("website:manage") },
  async ({ auth }) => ({ status: 201, data: await createWebsite(auth) }),
);

export const PATCH = route(
  { params: websiteParams, body: updateWebsiteBody, auth: requireWeddingAccess("website:manage") },
  async ({ auth, body }) => ({ data: await updateWebsite(auth, body) }),
);
