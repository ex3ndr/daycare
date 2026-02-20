import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
    execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { upgradeRestartRun } from "./upgradeRestartRun.js";

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

describe("upgradeRestartRun", () => {
    beforeEach(() => {
        execFileMock.mockReset();
    });

    it("restarts pm2 process and reports status", async () => {
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

        await upgradeRestartRun({
            strategy: "pm2",
            processName: "daycare",
            sendStatus
        });

        expect(execFileMock).toHaveBeenNthCalledWith(1, "pm2", ["jlist"], { windowsHide: true }, expect.any(Function));
        expect(execFileMock).toHaveBeenNthCalledWith(
            2,
            "pm2",
            ["restart", "daycare"],
            { windowsHide: true },
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenCalledTimes(2);
        expect(sendStatus.mock.calls.map((call) => call[0])).toEqual(['Restarting process "daycare" via pm2...']);
    });

    it("reports restart failures with process output and exit metadata", async () => {
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
            code: "ENOENT"
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
            upgradeRestartRun({
                strategy: "pm2",
                processName: "daycare",
                sendStatus
            })
        ).rejects.toThrow(
            'Restart failed while restarting PM2 process "daycare": pm2 not found (code=ENOENT, signal=none)'
        );

        expect(execFileMock).toHaveBeenCalledTimes(3);
        expect(sendStatus).toHaveBeenCalledWith(
            'Restart failed while restarting PM2 process "daycare": pm2 not found (code=ENOENT, signal=none)'
        );
    });

    it("does not fail when pm2 reports an error but process appears restarted", async () => {
        execSucceed(
            pm2ListOutput({
                processName: "daycare",
                status: "online",
                restartCount: 2,
                pmUptime: 1_700_000_000_000,
                pid: 123
            })
        );
        execFail(Object.assign(new Error("restart failed"), { code: 1 }), "", "");
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
            upgradeRestartRun({
                strategy: "pm2",
                processName: "daycare",
                sendStatus
            })
        ).resolves.toBeUndefined();

        expect(execFileMock).toHaveBeenCalledTimes(3);
        expect(sendStatus.mock.calls.map((call) => call[0])).toEqual(['Restarting process "daycare" via pm2...']);
    });
});
