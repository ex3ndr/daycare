import { beforeEach, describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";
import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";

vi.mock("./upgradePm2ProcessDetect.js", () => ({
  upgradePm2ProcessDetect: vi.fn()
}));

describe("upgrade plugin onboarding", () => {
  beforeEach(() => {
    vi.mocked(upgradePm2ProcessDetect).mockReset();
  });

  it("returns default pm2 settings when daycare process is detected", async () => {
    vi.mocked(upgradePm2ProcessDetect).mockResolvedValue({
      found: true,
      processName: "daycare"
    });
    const note = vi.fn();

    const result = await plugin.onboarding?.({
      instanceId: "upgrade",
      pluginId: "upgrade",
      dataDir: "/tmp/daycare",
      auth: {} as Parameters<NonNullable<typeof plugin.onboarding>>[0]["auth"],
      prompt: {
        input: async () => null,
        confirm: async () => null,
        select: async () => null
      },
      note
    });

    expect(result).toEqual({
      settings: {
        strategy: "pm2",
        processName: "daycare"
      }
    });
    expect(note).toHaveBeenCalledWith(
      'Detected online PM2 process "daycare". Upgrade plugin configured.',
      "Upgrade"
    );
  });

  it("aborts onboarding when daycare process is not detected", async () => {
    vi.mocked(upgradePm2ProcessDetect).mockResolvedValue({
      found: false,
      reason: 'No online PM2 process named "daycare" was found.'
    });
    const note = vi.fn();

    const result = await plugin.onboarding?.({
      instanceId: "upgrade",
      pluginId: "upgrade",
      dataDir: "/tmp/daycare",
      auth: {} as Parameters<NonNullable<typeof plugin.onboarding>>[0]["auth"],
      prompt: {
        input: async () => null,
        confirm: async () => null,
        select: async () => null
      },
      note
    });

    expect(result).toBeNull();
    expect(note).toHaveBeenCalledWith(
      'Upgrade plugin requires an online PM2 process named "daycare". No online PM2 process named "daycare" was found.',
      "Upgrade"
    );
  });
});
