import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { upgradeRun } from "./upgradeRun.js";

function execSucceed(stdout = "", stderr = ""): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(null, stdout, stderr);
      return undefined;
    }
  );
}

function execFail(error: Error, stdout = "", stderr = ""): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(error, stdout, stderr);
      return undefined;
    }
  );
}

function pm2ListOutput(options: {
  processName: string;
  status: string;
  restartCount: number;
  pmUptime: number;
  pid: number;
}): string {
  return JSON.stringify([
    {
      name: options.processName,
      pid: options.pid,
      pm2_env: {
        status: options.status,
        restart_time: options.restartCount,
        pm_uptime: options.pmUptime
      }
    }
  ]);
}

describe("upgradeRun", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("runs npm install then pm2 restart and reports status", async () => {
    execSucceed();
    execSucceed(
      pm2ListOutput({
        processName: "daycare",
        status: "online",
        restartCount: 2,
        pmUptime: 1_700_000_000_000,
        pid: 123
      })
    );
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
      ["jlist"],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      3,
      "pm2",
      ["restart", "daycare"],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(sendStatus.mock.calls.map((call) => call[0])).toEqual([
      "Upgrading Daycare CLI (npm install -g daycare-cli)...",
      "Restarting process \"daycare\" via pm2..."
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

  it("ignores restart command failures when pm2 snapshot indicates success", async () => {
    execSucceed();
    execSucceed(
      pm2ListOutput({
        processName: "daycare",
        status: "online",
        restartCount: 2,
        pmUptime: 1_700_000_000_000,
        pid: 123
      })
    );
    const error = Object.assign(new Error("restart failed"), {
      stderr: "pm2 not found"
    });
    execFail(error, "", "pm2 not found");
    execSucceed(
      pm2ListOutput({
        processName: "daycare",
        status: "online",
        restartCount: 3,
        pmUptime: 1_700_000_001_000,
        pid: 456
      })
    );
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await expect(
      upgradeRun({
        strategy: "pm2",
        processName: "daycare",
        sendStatus
      })
    ).resolves.toBeUndefined();

    expect(execFileMock).toHaveBeenCalledTimes(4);
    expect(sendStatus.mock.calls.map((call) => call[0])).toEqual([
      "Upgrading Daycare CLI (npm install -g daycare-cli)...",
      "Restarting process \"daycare\" via pm2..."
    ]);
  });

  it("throws restart failures when pm2 snapshot does not indicate success", async () => {
    execSucceed();
    execSucceed(
      pm2ListOutput({
        processName: "daycare",
        status: "online",
        restartCount: 2,
        pmUptime: 1_700_000_000_000,
        pid: 123
      })
    );
    const error = Object.assign(new Error("restart failed"), {
      stderr: "pm2 not found"
    });
    execFail(error, "", "pm2 not found");
    execSucceed(
      pm2ListOutput({
        processName: "daycare",
        status: "online",
        restartCount: 2,
        pmUptime: 1_700_000_000_000,
        pid: 123
      })
    );
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

    expect(execFileMock).toHaveBeenCalledTimes(4);
    expect(sendStatus.mock.calls.map((call) => call[0])).toEqual([
      "Upgrading Daycare CLI (npm install -g daycare-cli)...",
      "Restarting process \"daycare\" via pm2..."
    ]);
  });
});
