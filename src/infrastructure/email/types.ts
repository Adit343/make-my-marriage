// Provider abstraction for transactional email (Architecture §3.9, §29).

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  /** Recorded in emailLogs.provider. */
  readonly name: string;
  /** Resolves with the provider's message id; rejects with EmailProviderError on failure. */
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

/** A sanitized failure: `message` is safe to store in emailLogs (no secrets, no tokens). */
export class EmailProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message.slice(0, 300));
    this.name = "EmailProviderError";
  }
}
