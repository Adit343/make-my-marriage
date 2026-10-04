import "server-only";
import { cookies } from "next/headers";
import { resolveSession, SESSION_COOKIE, type AuthContext } from "@/modules/auth/session.service";

/** For Server Components (decision D7): the current session from the request cookies. */
export async function getServerSession(): Promise<AuthContext | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}
