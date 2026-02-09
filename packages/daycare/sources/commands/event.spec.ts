import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEngineSignal } from "../engine/ipc/client.js";
import { eventCommand } from "./event.js";

vi.mock("../engine/ipc/client.js", () => ({
  sendEngineSignal: vi.fn()
}));

describe("eventCommand", () => {
  const sendEngineSignalMock = vi.mocked(sendEngineSignal);

  beforeEach(() => {
    sendEngineSignalMock.mockReset();
    process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the provided event type and parsed payload", async () => {
    await eventCommand("demo.event", "{\"ok\":true}");

    expect(sendEngineSignalMock).toHaveBeenCalledWith(
      "demo.event",
      { ok: true },
      { type: "process", id: "daycare-cli" }
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("sets a non-zero exit code when socket send fails", async () => {
    sendEngineSignalMock.mockRejectedValueOnce(new Error("connect ENOENT"));

    await eventCommand("demo.event");

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send event: connect ENOENT")
    );
  });

  it("sets a non-zero exit code when payload is invalid JSON", async () => {
    await eventCommand("demo.event", "{not-json");

    expect(sendEngineSignalMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to send event: Payload must be valid JSON."
    );
  });
});
