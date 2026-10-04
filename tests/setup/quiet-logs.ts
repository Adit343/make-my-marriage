import { vi } from "vitest";

// Route handlers write one JSON log line per request; keep integration test output readable.
// console.error stays visible so unexpected server errors still show up.
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
