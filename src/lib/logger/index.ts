// Basic structured application logs (Architecture §37): one JSON line per entry on stdout/stderr,
// which Vercel captures. No external logging platform in V1.

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Never log passwords, tokens, secrets, cookies or API keys (Architecture §9, §37).
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|api[-_]?key/i;
const MAX_DEPTH = 6;

function serializeError(error: Error): Fields {
  const serialized: Fields = { name: error.name, message: error.message, stack: error.stack };
  if ("code" in error) serialized.code = (error as { code: unknown }).code;
  if (error.cause !== undefined) serialized.cause = redact(error.cause, 1);
  return serialized;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[Truncated]";
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value !== null && typeof value === "object") {
    const result: Fields = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(entry, depth + 1);
    }
    return result;
  }
  return value;
}

function write(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    event,
    ...(redact(fields) as Fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
