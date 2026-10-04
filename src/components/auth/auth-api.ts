// STAND-IN until step 1.5. The real endpoints (POST /api/v1/auth/signup, /login,
// /password/reset-request, /password/reset-confirm and GET /api/v1/auth/google) don't exist yet,
// so these resolve after a short delay. That lets every designed state — loading, success,
// confirmation — be reviewed now. Step 1.5 replaces the bodies with real fetch calls; the forms
// that call them don't change.

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface LogInInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignUpInput {
  name: string;
  /** Wedding workspace name — see the open question on combining signup with wedding creation. */
  workspaceName: string;
  relationship: "couple" | "family" | "planner";
  email: string;
  password: string;
}

export async function logIn(input: LogInInput): Promise<void> {
  void input;
  await delay(1200);
}

export async function signUp(input: SignUpInput): Promise<void> {
  void input;
  await delay(1400);
}

export async function requestPasswordReset(email: string): Promise<void> {
  void email;
  await delay(800);
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  void input;
  await delay(1000);
}

/** Whether "Continue with Google" can start a real OAuth flow yet. */
export const GOOGLE_SIGN_IN_AVAILABLE = false;
