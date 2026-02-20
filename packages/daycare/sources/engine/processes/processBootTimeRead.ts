import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

/**
 * Resolves system boot time as unix milliseconds.
 * Returns null when the platform does not expose a supported boot-time source.
 */
export async function processBootTimeRead(): Promise<number | null> {
    try {
        if (process.platform === "linux") {
            return processBootTimeReadLinux();
        }
        if (process.platform === "darwin") {
            return processBootTimeReadDarwin();
        }
    } catch {
        return null;
    }
    return null;
}

async function processBootTimeReadLinux(): Promise<number | null> {
    const raw = await fs.readFile("/proc/stat", "utf8");
    const line = raw.split(/\r?\n/).find((entry) => entry.startsWith("btime "));
    if (!line) {
        return null;
    }
    const seconds = Number(line.slice(6).trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }
    return Math.floor(seconds * 1_000);
}

async function processBootTimeReadDarwin(): Promise<number | null> {
    const result = await execFile("sysctl", ["-n", "kern.boottime"], {
        encoding: "utf8"
    });
    const output = result.stdout ?? "";
    const secMatch = /sec\s*=\s*(\d+)/.exec(output);
    if (!secMatch) {
        return null;
    }
    const secText = secMatch[1];
    if (!secText) {
        return null;
    }
    const sec = Number(secText);
    if (!Number.isFinite(sec) || sec <= 0) {
        return null;
    }
    return Math.floor(sec * 1_000);
}
