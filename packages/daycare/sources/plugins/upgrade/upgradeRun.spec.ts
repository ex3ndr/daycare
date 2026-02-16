import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { upgradeRun } from "./upgradeRun.js";

function execSucceed(): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null) => void
    ) => {
      callback(null);
      return undefined;
    }
  );
}

function execFail(error: Error): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null) => void
    ) => {
      callback(error);
      return undefined;
    }
  );
}

describe("upgradeRun", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("runs npm install then pm2 restart and reports status", async () => {
    execSucceed();
    execSucceed();
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await upgradeRun({
      strategy: "pm2",
      processName: "daycare",
      sendStatus
    });

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "npm",
      ["install", "-g", "daycare-cli"],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      "pm2",
      ["restart", "daycare"],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(sendStatus.mock.calls.map((call) => call[0])).toEqual([
      "Upgrading Daycare CLI (npm install -g daycare-cli)...",
      "Restarting process \"daycare\" via pm2...",
      "Upgrade complete. PM2 process \"daycare\" restarted."
    ]);
  });

  it("reports npm install failures and aborts restart", async () => {
    const error = Object.assign(new Error("install failed"), {
      stderr: "permission denied"
    });
    execFail(error);
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await expect(
      upgradeRun({
        strategy: "pm2",
        processName: "daycare",
        sendStatus
      })
    ).rejects.toThrow(
      "Upgrade failed while installing daycare-cli: permission denied"
    );

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(sendStatus).toHaveBeenCalledWith(
      "Upgrade failed while installing daycare-cli: permission denied"
    );
  });

  it("reports restart failures after install succeeds", async () => {
    execSucceed();
    const error = Object.assign(new Error("restart failed"), {
      stderr: "pm2 not found"
    });
    execFail(error);
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await expect(
      upgradeRun({
        strategy: "pm2",
        processName: "daycare",
        sendStatus
      })
    ).rejects.toThrow(
      'Upgrade failed while restarting PM2 process "daycare": pm2 not found'
    );

    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(sendStatus).toHaveBeenCalledWith(
      'Upgrade failed while restarting PM2 process "daycare": pm2 not found'
    );
  });
});
