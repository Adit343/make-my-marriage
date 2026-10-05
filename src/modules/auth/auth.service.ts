import "server-only";
import type { z } from "zod";
import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/constants/auth";
import { getEnv } from "@/lib/env";
import {
  hashPassword,
  needsRehash,
  verifyAgainstDummy,
  verifyPassword,
  type PasswordHash,
} from "@/lib/crypto/password";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import type { CookieToSet } from "@/lib/http/cookies";
import type {
  loginBody,
  passwordChangeBody,
  resetConfirmBody,
  signupBody,
} from "@/modules/auth/auth.schemas";
import {
  claimResetToken,
  createResetToken,
  retireOutstandingTokens,
} from "@/modules/auth/password-reset.repository";
import {
  listActiveSessions,
  revokeAllSessions,
  revokeSession,
} from "@/modules/auth/session.repository";
import {
  clearedSessionCookie,
  startSession,
  type AuthContext,
} from "@/modules/auth/session.service";
import { findActiveMembershipByUser } from "@/modules/members/member.repository";
import { sendEmail } from "@/modules/notifications/email.service";
import { passwordResetEmail } from "@/modules/notifications/templates";
import { toUserDto, type UserDto } from "@/modules/users/user.dto";
import {
  createUser,
  emailIsRegistered,
  findUserByEmail,
  findUserById,
  findUserWithPassword,
  recordLogin,
  setPassword,
} from "@/modules/users/user.repository";

interface RequestContext {
  userAgent?: string | null;
}

export interface SignedIn {
  user: UserDto;
  hasWedding: boolean;
  cookie: CookieToSet;
}

/** Deliberately vague (API Design §4.2): never reveal whether the email is registered. */
const invalidCredentials = () =>
  new AppError("AUTHENTICATION_REQUIRED", { message: "Invalid email or password" });

export async function signUp(
  input: z.infer<typeof signupBody>,
  context: RequestContext,
): Promise<SignedIn> {
  if (await emailIsRegistered(input.email)) throw new AppError("EMAIL_TAKEN");

  let user;
  try {
    user = await createUser({
      email: input.email,
      name: input.name,
      passwordAuth: await hashPassword(input.password),
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "emailNormalized")) throw new AppError("EMAIL_TAKEN");
    throw error;
  }

  // No email-verification gate in V1 (Architecture §8): signed in straight away.
  const { cookie } = await startSession(user._id, {
    persistent: true,
    userAgent: context.userAgent,
  });
  return { user: toUserDto(user, { hasPassword: true }), hasWedding: false, cookie };
}

export async function logIn(
  input: z.infer<typeof loginBody>,
  context: RequestContext,
): Promise<SignedIn> {
  const user = await findUserByEmail(input.email, { withPassword: true });
  const stored = user?.passwordAuth as PasswordHash | null | undefined;
  if (!user || !stored) {
    await verifyAgainstDummy(input.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(input.password, stored)) || user.status !== "active") {
    throw invalidCredentials();
  }

  if (needsRehash(stored)) await setPassword(user._id, await hashPassword(input.password));
  await recordLogin(user._id);
  const { cookie } = await startSession(user._id, {
    persistent: input.rememberMe,
    userAgent: context.userAgent,
  });
  return {
    user: toUserDto(user, { hasPassword: true }),
    hasWedding: Boolean(await findActiveMembershipByUser(user._id)),
    cookie,
  };
}

export async function logOut(auth: AuthContext | null): Promise<CookieToSet> {
  if (auth) await revokeSession(auth.userId, auth.sessionId);
  return clearedSessionCookie();
}

export async function getCurrentUser(auth: AuthContext): Promise<UserDto> {
  const user = await findUserWithPassword(auth.userId);
  if (!user) throw new AppError("AUTHENTICATION_REQUIRED");
  return toUserDto(user, { hasPassword: Boolean(user.passwordAuth) });
}

/**
 * Re-proves identity with the current password (401, not 403, when wrong), then signs out every
 * other device so a stolen session elsewhere stops working (API Design §4.5).
 */
export async function changePassword(
  auth: AuthContext,
  input: z.infer<typeof passwordChangeBody>,
): Promise<void> {
  const user = await findUserWithPassword(auth.userId);
  const stored = user?.passwordAuth as PasswordHash | null | undefined;
  if (!user || !stored || !(await verifyPassword(input.currentPassword, stored))) {
    throw new AppError("AUTHENTICATION_REQUIRED", {
      message: "Your current password is incorrect",
    });
  }
  await setPassword(user._id, await hashPassword(input.newPassword));
  await revokeAllSessions(user._id, { except: auth.sessionId });
}

/**
 * Always succeeds from the caller's point of view (API Design §4.6), so the response never
 * reveals whether an account exists. Only the newest link works.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user || user.status !== "active") return;

  await retireOutstandingTokens(user._id);
  const token = generateToken();
  await createResetToken(
    user._id,
    hashToken(token),
    new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
  );

  const resetUrl = new URL(`/reset-password/${token}`, getEnv().APP_URL).toString();
  await sendEmail({
    type: "password_reset",
    to: user.email,
    ...passwordResetEmail({ name: user.name, resetUrl }),
  });
}

/** Single-use (atomic claim), then signs the user out everywhere. */
export async function confirmPasswordReset(input: z.infer<typeof resetConfirmBody>): Promise<void> {
  const claimed = await claimResetToken(hashToken(input.token));
  if (!claimed) throw new AppError("INVALID_TOKEN");

  const user = await findUserById(claimed.userId);
  if (!user || user.status !== "active") throw new AppError("INVALID_TOKEN");

  await setPassword(user._id, await hashPassword(input.newPassword));
  await retireOutstandingTokens(user._id);
  await revokeAllSessions(user._id);
}

export async function listSessions(auth: AuthContext) {
  const sessions = await listActiveSessions(auth.userId);
  return sessions.map((session) => ({
    id: session._id.toString(),
    userAgent: session.userAgent ?? null,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    isCurrent: session._id.toString() === auth.sessionId,
  }));
}

/** "Sign out all other sessions": everything except the one making the request. */
export async function endOtherSessions(auth: AuthContext) {
  await revokeAllSessions(auth.userId, { except: auth.sessionId });
}

/** 404 for unknown ids and other users' sessions alike (API Design §3.4). */
export async function endSession(auth: AuthContext, sessionId: string) {
  const revoked = await revokeSession(auth.userId, sessionId);
  if (!revoked) throw new AppError("NOT_FOUND");
  return { endedCurrent: sessionId === auth.sessionId };
}
