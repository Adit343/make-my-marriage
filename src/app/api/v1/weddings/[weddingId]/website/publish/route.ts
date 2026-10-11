import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { websiteParams } from "@/modules/website/website.schemas";
import { publishWebsite } from "@/modules/website/website.service";

// API Design §10.2. "Go live" is always an explicit action, never a side effect of an edit.

export const POST = route(
  { params: websiteParams, auth: requireWeddingAccess("website:manage") },
  async ({ auth }) => ({ data: await publishWebsite(auth) }),
);
