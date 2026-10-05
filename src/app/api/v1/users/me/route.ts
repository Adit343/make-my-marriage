import { route } from "@/lib/http/route";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";
import { deleteAccountQuery, updateProfileBody } from "@/modules/users/user.schemas";
import { deleteAccount, updateProfile } from "@/modules/users/user.service";

// API Design §5. Only `name` is editable: changing the login email safely needs re-verification,
// which V1 does not have (API Design §16 item 4).

export const GET = route({ auth: requireSession }, async ({ auth }) => ({
  data: await getCurrentUser(auth),
}));

export const PATCH = route(
  { body: updateProfileBody, auth: requireSession },
  async ({ auth, body }) => {
    await updateProfile(auth, body);
    return { data: await getCurrentUser(auth) };
  },
);

export const DELETE = route(
  { query: deleteAccountQuery, auth: requireSession },
  async ({ auth, query }) => deleteAccount(auth, query),
);
