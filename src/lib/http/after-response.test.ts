import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAfterResponse } from "@/lib/http/after-response";

describe("runAfterResponse (outside a request, as in tests)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the work inline when there is no request to defer it past", async () => {
    let ran = false;
    await runAfterResponse(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("logs a failure instead of throwing at the caller, who has already answered", async () => {
    await expect(
      runAfterResponse(async () => {
        throw new Error("provider exploded");
      }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledOnce();
    expect(String(vi.mocked(console.error).mock.calls[0]![0])).toContain(
      "http.after_response_failed",
    );
  });
});
