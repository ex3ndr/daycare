import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";

function execOutput(stdout: string): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null, stdout: string) => void
    ) => {
      callback(null, stdout);
      return undefined;
    }
  );
}

function execError(error: Error): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null, stdout: string) => void
    ) => {
      callback(error, "");
      return undefined;
    }
  );
}

describe("upgradePm2ProcessDetect", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("returns found when daycare is online in pm2", async () => {
    execOutput(
      JSON.stringify([
        {
          name: "daycare",
          pm2_env: { status: "online" }
        }
      ])
    );

    await expect(upgradePm2ProcessDetect("daycare")).resolves.toEqual({
      found: true,
      processName: "daycare"
    });
  });

  it("returns not found when daycare process is missing", async () => {
    execOutput(
      JSON.stringify([
        {
          name: "other",
          pm2_env: { status: "online" }
        }
      ])
    );

    await expect(upgradePm2ProcessDetect("daycare")).resolves.toEqual({
      found: false,
      reason: 'No online PM2 process named "daycare" was found.'
    });
  });

  it("returns not found when pm2 command fails", async () => {
    execError(new Error("spawn pm2 ENOENT"));

    const result = await upgradePm2ProcessDetect("daycare");
    expect(result.found).toBe(false);
    if (result.found) {
      throw new Error("Expected not found result");
    }
    expect(result.reason).toContain("Failed to run pm2 jlist");
  });
});
