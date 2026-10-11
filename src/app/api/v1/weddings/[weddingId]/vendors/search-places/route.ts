import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { searchPlacesQuery } from "@/modules/vendors/vendor.schemas";
import { searchVendorPlaces } from "@/modules/vendors/vendor.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §9.2: the server-mediated Google Places search (Architecture §28). The key never
// leaves the server, results are never saved, and a missing key or a Google outage is a normal
// answer (`meta.configured` / `meta.unavailable`), not an error: the vendor can be typed in.
// A GET that writes nothing (a rate-limit counter aside), as the CSRF note in API Design §2.9 requires.

export const GET = route(
  {
    params: weddingParams,
    query: searchPlacesQuery,
    auth: requireWeddingAccess("vendors:manage"),
  },
  async ({ auth, query }) => {
    const { results, configured, unavailable } = await searchVendorPlaces(auth, query);
    return { data: results, meta: { configured, unavailable } };
  },
);
