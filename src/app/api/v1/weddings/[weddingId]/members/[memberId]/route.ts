import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { memberParams, updateMemberBody } from "@/modules/members/member.schemas";
import { changeMember, removeMember } from "@/modules/members/member.service";

// API Design §6.6–§6.7.

export const PATCH = route(
  { params: memberParams, body: updateMemberBody, auth: requireWeddingAccess("members:manage") },
  async ({ auth, params, body }) => ({ data: await changeMember(auth, params.memberId, body) }),
);

// Any member may call this on their OWN row to leave; removing someone else needs members:manage,
// which removeMember checks once it knows whose row it is.
export const DELETE = route(
  { params: memberParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await removeMember(auth, params.memberId) }),
);
