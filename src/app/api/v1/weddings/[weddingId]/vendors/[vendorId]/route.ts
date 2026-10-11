import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { updateVendorBody, vendorParams } from "@/modules/vendors/vendor.schemas";
import { deleteVendor, getVendorDetail, updateVendor } from "@/modules/vendors/vendor.service";

// API Design §9.2. Owners and admins only.

export const GET = route(
  { params: vendorParams, auth: requireWeddingAccess("vendors:manage") },
  async ({ auth, params }) => ({ data: await getVendorDetail(auth, params.vendorId) }),
);

export const PATCH = route(
  { params: vendorParams, body: updateVendorBody, auth: requireWeddingAccess("vendors:manage") },
  async ({ auth, params, body }) => ({ data: await updateVendor(auth, params.vendorId, body) }),
);

export const DELETE = route(
  { params: vendorParams, auth: requireWeddingAccess("vendors:manage") },
  async ({ auth, params }) => ({ data: await deleteVendor(auth, params.vendorId) }),
);
