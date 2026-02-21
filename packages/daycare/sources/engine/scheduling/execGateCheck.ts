import type { ExecException } from "node:child_process";
import path from "node:path";

import type { ExecGateDefinition, SessionPermissions } from "@/types";
import { pathResolveSecure } from "../../sandbox/pathResolveSecure.js";
import { runInSandbox } from "../../sandbox/runtime.js";
import { sandboxAllowedDomainsResolve } from "../../sandbox/sandboxAllowedDomainsResolve.js";
import { sandboxAllowedDomainsValidate } from "../../sandbox/sandboxAllowedDomainsValidate.js";
import { sandboxFilesystemPolicyBuild } from "../../sandbox/sandboxFilesystemPolicyBuild.js";

const MAX_EXEC_BUFFER = 1_000_000;
const DEFAULT_EXEC_TIMEOUT = 30_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 300_000;

export type ExecGateCheckInput = {
    gate: ExecGateDefinition;
    permissions: SessionPermissions;
    workingDir: string;
};

export type ExecGateCheckResult = {
    shouldRun: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
};

/**
 * Runs an exec gate command and reports whether the task should continue.
 * Expects: gate.command is non-empty; workingDir is absolute.
 */
export async function execGateCheck(input: ExecGateCheckInput): Promise<ExecGateCheckResult> {
    const command = input.gate.command.trim();
    if (!command) {
        return {
            shouldRun: false,
            exitCode: null,
            stdout: "",
            stderr: "",
            error: new Error("Gate command is required.")
        };
    }

    const permissions: SessionPermissions = {
        ...input.permissions,
        workingDir: path.resolve(input.workingDir)
    };

    const allowedDomains = sandboxAllowedDomainsResolve(input.gate.allowedDomains, input.gate.packageManagers);
    const domainIssues = sandboxAllowedDomainsValidate(allowedDomains);
    if (domainIssues.length > 0) {
        return gateError(domainIssues.join(" "));
    }

    const cwd = input.gate.cwd ? path.resolve(permissions.workingDir, input.gate.cwd) : permissions.workingDir;
    let resolvedCwd: string;
    try {
        resolvedCwd = await resolveGateCwd(permissions, cwd);
    } catch (error) {
        return gateError(error instanceof Error ? error.message : "Invalid gate cwd.");
    }
    let resolvedHome: string | undefined;
    if (input.gate.home) {
        try {
            resolvedHome = await resolveGateHome(permissions, input.gate.home);
        } catch (error) {
            return gateError(error instanceof Error ? error.message : "Invalid gate home.");
        }
    }

    const env = input.gate.env ? { ...process.env, ...input.gate.env } : process.env;
    const timeoutMs = clampTimeout(input.gate.timeoutMs ?? DEFAULT_EXEC_TIMEOUT);
    const sandboxConfig = buildSandboxConfig(permissions, allowedDomains);

    try {
        const result = await runInSandbox(command, sandboxConfig, {
            cwd: resolvedCwd,
            env,
            home: resolvedHome,
            timeoutMs,
            maxBufferBytes: MAX_EXEC_BUFFER
        });
        return {
            shouldRun: true,
            exitCode: 0,
            stdout: toText(result.stdout),
            stderr: toText(result.stderr)
        };
    } catch (error) {
        const execError = error as ExecException & {
            stdout?: string | Buffer;
            stderr?: string | Buffer;
            code?: number | string | null;
            signal?: NodeJS.Signals | null;
        };
        const stdout = toText(execError.stdout);
        const stderr = toText(execError.stderr);
        if (typeof execError.code === "number") {
            return {
                shouldRun: false,
                exitCode: execError.code,
                stdout,
                stderr
            };
        }
        return {
            shouldRun: false,
            exitCode: null,
            stdout,
            stderr,
            error: execError instanceof Error ? execError : new Error("Gate command failed.")
        };
    }
}

function gateError(message: string): ExecGateCheckResult {
    return {
        shouldRun: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        error: new Error(message)
    };
}

function buildSandboxConfig(permissions: SessionPermissions, allowedDomains: string[]) {
    const filesystem = sandboxFilesystemPolicyBuild({
        writeDirs: permissions.writeDirs,
        workingDir: permissions.workingDir
    });
    return {
        filesystem,
        network: {
            allowedDomains,
            deniedDomains: []
        },
        enableWeakerNestedSandbox: true
    };
}

async function resolveGateCwd(permissions: SessionPermissions, cwd: string): Promise<string> {
    const allowedDirs = Array.from(new Set([permissions.workingDir, ...permissions.writeDirs]));
    const resolved = await pathResolveSecure(allowedDirs, cwd);
    return resolved.realPath;
}

async function resolveGateHome(permissions: SessionPermissions, home: string): Promise<string> {
    const allowedDirs = Array.from(new Set([...permissions.writeDirs]));
    const resolved = await pathResolveSecure(allowedDirs, home);
    return resolved.realPath;
}

function clampTimeout(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_EXEC_TIMEOUT;
    }
    return Math.min(Math.max(value, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
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
