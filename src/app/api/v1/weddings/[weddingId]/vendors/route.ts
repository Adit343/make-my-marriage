import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { createVendorBody, listVendorsQuery } from "@/modules/vendors/vendor.schemas";
import { createVendor, listVendors } from "@/modules/vendors/vendor.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §9.2. Owners and admins only (decision D3): a vendor holds contact details and terms.

export const GET = route(
  { params: weddingParams, query: listVendorsQuery, auth: requireWeddingAccess("vendors:manage") },
  async ({ auth, query }) => {
    const { items, meta } = await listVendors(auth, query);
    return { data: items, meta };
  },
);

export const POST = route(
  { params: weddingParams, body: createVendorBody, auth: requireWeddingAccess("vendors:manage") },
  async ({ auth, body }) => ({ status: 201, data: await createVendor(auth, body) }),
);
