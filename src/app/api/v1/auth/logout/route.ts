import { route } from "@/lib/http/route";
import { logOut } from "@/modules/auth/auth.service";
import { optionalSession } from "@/modules/auth/guards";

// POST /api/v1/auth/logout — API Design §4.3. Idempotent: always clears the cookie.
export const POST = route({ auth: optionalSession }, async ({ auth }) => {
  const cookie = await logOut(auth);
  return { data: null, cookies: [cookie] };
});
