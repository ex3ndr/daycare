import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";

describe("dashboard plugin onboarding", () => {
  it("stores host and port when auth is disabled", async () => {
    const prompt = {
      input: vi
        .fn()
        .mockResolvedValueOnce("127.0.0.1")
        .mockResolvedValueOnce("7331"),
      confirm: vi.fn().mockResolvedValue(false),
      select: vi.fn()
    };
    const note = vi.fn();

    const result = await plugin.onboarding?.({ prompt, note } as never);

    expect(result).toEqual({
      settings: {
        host: "127.0.0.1",
        port: 7331
      }
    });
    expect(note).toHaveBeenCalledWith(
      "Dashboard plugin enabled on http://127.0.0.1:7331 without authentication.",
      "Dashboard"
    );
    expect(prompt.select).not.toHaveBeenCalled();
  });

  it("hashes generated password when auth is enabled", async () => {
    const prompt = {
      input: vi
        .fn()
        .mockResolvedValueOnce("127.0.0.1")
        .mockResolvedValueOnce("7331")
        .mockResolvedValueOnce("operator"),
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue("generate")
    };
    const note = vi.fn();

    const result = await plugin.onboarding?.({ prompt, note } as never);

    expect(result?.settings).toBeTruthy();
    expect(result?.settings).toMatchObject({
      host: "127.0.0.1",
      port: 7331,
      basicAuth: {
        username: "operator"
      }
    });

    const auth = result?.settings?.basicAuth as
      | { username: string; passwordHash: string }
      | undefined;
    if (!auth) {
      throw new Error("Expected basic auth settings");
    }

    const firstNote = note.mock.calls[0]?.[0];
    if (typeof firstNote !== "string") {
      throw new Error("Expected onboarding note");
    }

    const passwordLine = firstNote
      .split("\n")
      .find((line: string) => line.startsWith("Password: "));
    if (!passwordLine) {
      throw new Error("Expected generated password note");
    }

    const password = passwordLine.slice("Password: ".length);
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(await bcrypt.compare(password, auth.passwordHash)).toBe(true);
  });

  it("rejects weak provided password", async () => {
    const prompt = {
      input: vi
        .fn()
        .mockResolvedValueOnce("127.0.0.1")
        .mockResolvedValueOnce("7331")
        .mockResolvedValueOnce("daycare")
        .mockResolvedValueOnce("short"),
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue("provide")
    };
    const note = vi.fn();

    const result = await plugin.onboarding?.({ prompt, note } as never);

    expect(result).toBeNull();
    expect(note).toHaveBeenCalledWith(
      "Password must be at least 12 characters and include uppercase, lowercase, and numeric characters.",
      "Dashboard"
    );
  });
});
