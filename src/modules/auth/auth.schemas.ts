import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/auth";
import { email, objectId } from "@/lib/validation/primitives";

// Request schemas for API Design §4. Passwords are capped at 200 characters so a huge body
// can't make scrypt burn CPU.

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200);

/** Login accepts any length: the policy applies when a password is set, not when it's used. */
const existingPassword = z.string().min(1).max(200);

export const signupBody = z.strictObject({
  email,
  password: newPassword,
  name: z.string().trim().min(1).max(100),
});

export const loginBody = z.strictObject({
  email,
  password: existingPassword,
  rememberMe: z.boolean().optional().default(false),
});

export const passwordChangeBody = z.strictObject({
  currentPassword: existingPassword,
  newPassword,
});

export const resetRequestBody = z.strictObject({ email });

export const resetConfirmBody = z.strictObject({
  token: z.string().min(16).max(200),
  newPassword,
});

export const sessionParams = z.strictObject({ sessionId: objectId });

/** Not strict: Google appends its own parameters (scope, authuser, prompt, hd). */
export const googleCallbackQuery = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(512).optional(),
  error: z.string().max(200).optional(),
});

/** `next` is validated by joinPath() before it is used; anything else is ignored. */
export const googleStartQuery = z.object({ next: z.string().max(300).optional() });
