import type { ExecException } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runInSandbox } from "./runtime.js";

const baseFilesystem = {
    denyRead: [],
    allowWrite: ["."],
    denyWrite: []
};

type ExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
};

async function runCurlWithDomains(url: string, allowedDomains: string[]): Promise<ExecResult> {
    try {
        const result = await runInSandbox(
            `curl -s -I --max-time 10 "${url}"`,
            {
                filesystem: baseFilesystem,
                network: {
                    allowedDomains,
                    deniedDomains: []
                }
            },
            {
                timeoutMs: 30_000,
                maxBufferBytes: 1_000_000
            }
        );

        return {
            stdout: toText(result.stdout),
            stderr: toText(result.stderr),
            exitCode: 0
        };
    } catch (error) {
        const execError = error as ExecException & {
            stdout?: string | Buffer;
            stderr?: string | Buffer;
            code?: number | string | null;
        };
        return {
            stdout: toText(execError.stdout),
            stderr: toText(execError.stderr),
            exitCode: typeof execError.code === "number" ? execError.code : null
        };
    }
}

function toText(value?: string | Buffer): string {
    if (!value) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    return value.toString("utf8");
}

describe("runInSandbox integration", () => {
    it("runs google and microsoft in parallel with one whitelisted domain per call", async () => {
        const [googleResult, microsoftResult] = await Promise.all([
            runCurlWithDomains("https://google.com", ["google.com"]),
            runCurlWithDomains("https://microsoft.com", ["microsoft.com"])
        ]);

        expect(googleResult.exitCode).toBe(0);
        expect(microsoftResult.exitCode).toBe(0);
        expect(googleResult.stdout).toContain("HTTP/");
        expect(microsoftResult.stdout).toContain("HTTP/");
    });

    it("blocks https requests when domain is not whitelisted", async () => {
        const result = await runCurlWithDomains("https://microsoft.com", ["google.com"]);

        expect(result.stdout).toContain("X-Proxy-Error: blocked-by-allowlist");
    });

    it("blocks http requests when domain is not whitelisted", async () => {
        const result = await runCurlWithDomains("http://microsoft.com", ["google.com"]);

        expect(result.stdout).toContain("X-Proxy-Error: blocked-by-allowlist");
    });

    it("maps HOME when home option is provided", async () => {
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-srt-home-"));
        try {
            const home = path.join(workspace, ".sandbox-home");
            const result = await runInSandbox(
                "printf '%s' \"$HOME\"",
                {
                    filesystem: baseFilesystem,
                    network: {
                        allowedDomains: [],
                        deniedDomains: []
                    }
                },
                { home }
            );

            expect(result.stdout).toBe(home);
        } finally {
            await fs.rm(workspace, { recursive: true, force: true });
        }
    });
});
