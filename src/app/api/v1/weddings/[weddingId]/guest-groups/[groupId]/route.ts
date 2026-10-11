import { route } from "@/lib/http/route";
import {
  deleteGroupBody,
  groupParams,
  updateGroupBody,
} from "@/modules/guest-groups/guest-group.schemas";
import { deleteGroup, updateGroup } from "@/modules/guest-groups/guest-group.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §8.1. Deleting a group says where its guests go; guests are never deleted with it.

export const PATCH = route(
  { params: groupParams, body: updateGroupBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params, body }) => ({ data: await updateGroup(auth, params.groupId, body) }),
);

export const DELETE = route(
  { params: groupParams, body: deleteGroupBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params, body }) => ({ data: await deleteGroup(auth, params.groupId, body) }),
);
