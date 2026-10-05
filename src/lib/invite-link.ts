// Invitation links look like https://<app>/join/<token>. The token is base64url (generateToken()).
// Everything that arrives from outside (?invite=… on a page, a link pasted into onboarding) is
// run through here before it is used in a redirect or a URL, so only a well-formed token passes.

const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

/** The token from a bare token or a full /join/<token> link; undefined for anything else. */
export function parseInviteToken(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const text = input.trim();
  if (TOKEN.test(text)) return text;

  const fromPath = /\/join\/([A-Za-z0-9_-]{20,200})\/?(?:[?#].*)?$/.exec(text);
  return fromPath?.[1];
}

/** In-app path to continue an invitation, or undefined if `value` isn't a valid token. */
export function joinPath(value: unknown): string | undefined {
  const token = parseInviteToken(value);
  return token ? `/join/${token}` : undefined;
}
