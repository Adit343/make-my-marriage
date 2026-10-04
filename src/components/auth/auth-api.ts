import type { MemberRelationship } from "@/lib/constants/enums";
import { apiRequest } from "@/lib/client/api-client";

// Browser calls to the auth API (API Design §4) used by the login/signup/reset screens.

interface SignedIn {
  user: { id: string; email: string; name: string };
  hasWedding: boolean;
}

export interface LogInInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignUpInput {
  name: string;
  /** Becomes the wedding's title. */
  workspaceName: string;
  relationship: "couple" | "family" | "planner";
  email: string;
  password: string;
}

/** Signup role chips → the owner membership's relationship label. */
const RELATIONSHIP_FOR_ROLE: Record<SignUpInput["relationship"], MemberRelationship> = {
  couple: "couple",
  family: "relative",
  planner: "planner",
};

export function logIn(input: LogInInput) {
  return apiRequest<SignedIn>("/api/v1/auth/login", { method: "POST", body: input });
}

/**
 * Approved flow (2026-10-04): create the account, then the wedding workspace. If the second call
 * fails the account still exists, so this reports it rather than throwing.
 */
export async function signUpWithWorkspace(
  input: SignUpInput,
): Promise<{ weddingCreated: boolean }> {
  await apiRequest<SignedIn>("/api/v1/auth/signup", {
    method: "POST",
    body: { name: input.name, email: input.email, password: input.password },
  });
  try {
    await apiRequest("/api/v1/weddings", {
      method: "POST",
      body: { title: input.workspaceName, relationship: RELATIONSHIP_FOR_ROLE[input.relationship] },
    });
    return { weddingCreated: true };
  } catch {
    return { weddingCreated: false };
  }
}

export function requestPasswordReset(email: string) {
  return apiRequest<null>("/api/v1/auth/password/reset-request", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(input: { token: string; password: string }) {
  return apiRequest<null>("/api/v1/auth/password/reset-confirm", {
    method: "POST",
    body: { token: input.token, newPassword: input.password },
  });
}

export function logOut() {
  return apiRequest<null>("/api/v1/auth/logout", { method: "POST" });
}

/** Messages for the ?error=… codes the Google callback redirects back with. */
export const GOOGLE_SIGN_IN_ERRORS: Record<string, string> = {
  oauth_unavailable: "Google sign-in isn't set up yet. Please use your email and password.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  email_exists_password:
    "This email already has a password account. Log in with your password instead.",
  account_unavailable: "This account isn't available. Contact support if you think this is wrong.",
};
