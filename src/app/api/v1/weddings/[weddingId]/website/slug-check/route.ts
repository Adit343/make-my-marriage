import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { requireWeddingAccess } from "@/modules/members/guards";
import { slugCheckQuery, websiteParams } from "@/modules/website/website.schemas";
import { checkSlugAvailability } from "@/modules/website/website.service";

// Addition to the API doc: the editor's "Available" badge. A read, so it never reserves the address;
// the unique index is what finally decides when the site is saved.

export const GET = route(
  {
    params: websiteParams,
    query: slugCheckQuery,
    auth: requireWeddingAccess("website:manage"),
  },
  async ({ auth, query }) => {
    await enforceRateLimit(`slug-check:${auth.weddingId}`, RATE_LIMITS.slugCheck);
    return { data: await checkSlugAvailability(auth, query.slug) };
  },
);
