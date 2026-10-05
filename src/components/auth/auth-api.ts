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

/** Signup role chips. */
export type SignUpRole = "couple" | "family" | "planner";

/** Signup role chips → the owner membership's relationship label. */
export const RELATIONSHIP_FOR_ROLE: Record<SignUpRole, MemberRelationship> = {
  couple: "couple",
  family: "relative",
  planner: "planner",
};

/** Where a signed-in person belongs: setup first if they have no wedding yet. */
export function homeFor(hasWedding: boolean) {
  return hasWedding ? "/dashboard" : "/onboarding";
}

export function logIn(input: LogInInput) {
  return apiRequest<SignedIn>("/api/v1/auth/login", { method: "POST", body: input });
}

/** Step 1 of 2: the account. The wedding is set up next on /onboarding. */
export function signUp(input: { name: string; email: string; password: string }) {
  return apiRequest<SignedIn>("/api/v1/auth/signup", { method: "POST", body: input });
}

export interface CreateWeddingInput {
  title: string;
  partners: { name: string }[];
  weddingDate?: string;
  relationship: MemberRelationship;
}

/** Step 2 of 2: the wedding workspace, with the caller as its owner. */
export function createWedding(input: CreateWeddingInput) {
  return apiRequest<{ wedding: { id: string; title: string } }>("/api/v1/weddings", {
    method: "POST",
    body: input,
  });
}

/**
 * The signup form also asks for a workspace name and role; they're carried to the onboarding
 * form so nobody types them twice. Tab-scoped (sessionStorage) and holds no secrets.
 */
const PREFILL_KEY = "mmm:onboarding-prefill";

export interface OnboardingPrefill {
  title?: string;
  relationship?: MemberRelationship;
}

export function saveOnboardingPrefill(prefill: OnboardingPrefill) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    // Storage unavailable: onboarding simply starts empty.
  }
}

export function takeOnboardingPrefill(): OnboardingPrefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    sessionStorage.removeItem(PREFILL_KEY);
    return raw ? (JSON.parse(raw) as OnboardingPrefill) : null;
  } catch {
    return null;
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

/** API Design §6.11: join the wedding an invitation link belongs to. */
export function acceptInvitation(token: string) {
  return apiRequest<{
    membership: { id: string; role: string };
    wedding: { id: string; title: string };
  }>("/api/v1/invitations/accept", { method: "POST", body: { token } });
}
