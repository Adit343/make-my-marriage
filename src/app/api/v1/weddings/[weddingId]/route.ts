import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import {
  deleteWeddingBody,
  updateWeddingBody,
  weddingParams,
} from "@/modules/weddings/wedding.schemas";
import {
  deleteWedding,
  getWeddingFor,
  updateWeddingDetails,
} from "@/modules/weddings/wedding.service";

// API Design §6.2–§6.3.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await getWeddingFor(auth) }),
);

export const PATCH = route(
  { params: weddingParams, body: updateWeddingBody, auth: requireWeddingAccess("wedding:update") },
  async ({ auth, body }) => ({ data: await updateWeddingDetails(auth, body) }),
);

export const DELETE = route(
  { params: weddingParams, body: deleteWeddingBody, auth: requireWeddingAccess("wedding:delete") },
  async ({ auth, body }) => ({ data: await deleteWedding(auth, body.confirm) }),
);
