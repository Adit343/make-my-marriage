// Error codes and their HTTP statuses (API Design §2.5, Appendix B). Every code maps to
// exactly one status so clients can switch on either.
export const ERROR_DEFINITIONS = {
  VALIDATION_ERROR: { status: 400, message: "Invalid request data" },
  AUTHENTICATION_REQUIRED: { status: 401, message: "Please log in to continue" },
  NOT_A_MEMBER: { status: 403, message: "You don't have access to this wedding" },
  INSUFFICIENT_ROLE: { status: 403, message: "Your role doesn't allow this action" },
  INVALID_TOKEN: { status: 403, message: "This link is invalid or has expired" },
  NOT_FOUND: { status: 404, message: "Resource not found" },
  CONFLICT: { status: 409, message: "This action conflicts with the current state" },
  EMAIL_TAKEN: { status: 409, message: "An account with this email already exists" },
  ALREADY_IN_WEDDING: { status: 409, message: "You already belong to a wedding" },
  VERSION_CONFLICT: {
    status: 409,
    message: "This was updated elsewhere — please refresh and try again",
  },
  SLUG_TAKEN: { status: 409, message: "This website address is already in use" },
  OWNER_MUST_RESOLVE_WEDDING: {
    status: 409,
    message: "Transfer ownership or delete the wedding before deleting your account",
  },
  BUSINESS_RULE_VIOLATION: { status: 422, message: "This action breaks a business rule" },
  RATE_LIMITED: { status: 429, message: "Too many attempts — please try again later" },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong. Please try again." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;

export interface AppErrorOptions {
  /** Client-safe message; defaults to the code's standard message. */
  message?: string;
  /** Client-safe structured detail (API decision C9: extra error data lives here). */
  details?: unknown;
  /** Original error, for server-side logs only. Never sent to the client. */
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? ERROR_DEFINITIONS[code].message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_DEFINITIONS[code].status;
    this.details = options.details;
  }
}
