import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { websiteParams } from "@/modules/website/website.schemas";
import { unpublishWebsite } from "@/modules/website/website.service";

// API Design §10.2. The site goes back to a draft; its address is kept.

export const POST = route(
  { params: websiteParams, auth: requireWeddingAccess("website:manage") },
  async ({ auth }) => ({ data: await unpublishWebsite(auth) }),
);
