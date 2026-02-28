#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SandboxManager, type SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

type ParsedArgs = {
    settingsPath: string;
    command: string;
};

function defaultSettingsPathResolve(): string {
    return path.join(os.homedir(), ".srt-settings.json");
}

function defaultConfigBuild(): SandboxRuntimeConfig {
    return {
        network: {
            allowedDomains: [],
            deniedDomains: []
        },
        filesystem: {
            denyRead: [],
            allowWrite: [],
            denyWrite: []
        }
    };
}

function usagePrint(): void {
    process.stderr.write("Usage: sandbox [--settings <path>] -- <command>\n");
}

function argsParse(argv: string[]): ParsedArgs {
    let settingsPath = defaultSettingsPathResolve();
    let separatorIndex = -1;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--") {
            separatorIndex = i;
            break;
        }
        if (arg === "--help" || arg === "-h") {
            usagePrint();
            process.exit(0);
        }
        if (arg === "--settings" || arg === "-s") {
            const next = argv[i + 1];
            if (!next) {
                throw new Error("Missing value for --settings.");
            }
            settingsPath = next;
            i += 1;
            continue;
        }
        if (arg === "--debug" || arg === "-d") {
            process.env.DEBUG = "true";
            continue;
        }
        throw new Error(`Unknown option: ${arg}. Use '--' before command arguments.`);
    }
    if (separatorIndex < 0) {
        throw new Error("Missing '--' separator before command.");
    }
    const commandArgs = argv.slice(separatorIndex + 1);
    if (commandArgs.length === 0) {
        throw new Error("No command provided after '--'.");
    }
    return {
        settingsPath,
        command: commandArgs.join(" ")
    };
}

function runtimeConfigLoad(settingsPath: string): SandboxRuntimeConfig {
    try {
        const raw = readFileSync(settingsPath, "utf8");
        const parsed = JSON.parse(raw) as SandboxRuntimeConfig & {
            network?: {
                allowedDomains?: string[];
                deniedDomains?: string[];
            };
        };
        if (!parsed.network) {
            return defaultConfigBuild();
        }
        if (parsed.network.allowedDomains?.includes("*")) {
            return {
                ...parsed,
                network: {
                    ...parsed.network,
                    allowedDomains: undefined
                }
            } as unknown as SandboxRuntimeConfig;
        }
        return parsed;
    } catch {
        return defaultConfigBuild();
    }
}

async function main(): Promise<void> {
    const parsedArgs = argsParse(process.argv.slice(2));
    const runtimeConfig = runtimeConfigLoad(parsedArgs.settingsPath);
    await SandboxManager.initialize(runtimeConfig);

    const sandboxedCommand = await SandboxManager.wrapWithSandbox(parsedArgs.command);
    const child = spawn(sandboxedCommand, {
        shell: true,
        stdio: ["inherit", "pipe", "pipe"]
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);

    child.on("error", (error) => {
        process.stderr.write(`Failed to execute sandboxed command: ${error.message}\n`);
        process.exit(1);
    });
    child.on("exit", (code, signal) => {
        if (signal) {
            process.exit(1);
            return;
        }
        process.exit(code ?? 1);
    });
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    usagePrint();
    process.exit(1);
});
