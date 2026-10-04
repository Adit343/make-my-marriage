import { randomUUID } from "node:crypto";

// Architecture §38: honour a client-supplied X-Request-ID, otherwise generate one.
export const REQUEST_ID_HEADER = "x-request-id";

// Reject anything that could pollute log lines (newlines, quotes) or is unreasonably long.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER);
  return incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}
