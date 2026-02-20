import { execFile } from "node:child_process";

export type UpgradePm2ProcessDetectResult = { found: true; processName: string } | { found: false; reason: string };

/**
 * Detects whether PM2 has a running process with the provided name.
 * Expects: processName is non-empty and references the PM2 process to restart.
 */
export async function upgradePm2ProcessDetect(processName: string): Promise<UpgradePm2ProcessDetectResult> {
    let output: string;
    try {
        output = await commandOutput("pm2", ["jlist"]);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown PM2 error";
        return {
            found: false,
            reason: `Failed to run pm2 jlist: ${message}`
        };
    }

    const parsed = pm2ListParse(output);
    if (!parsed) {
        return {
            found: false,
            reason: "PM2 returned an invalid process list."
        };
    }

    const entry = parsed.find((item) => {
        if (!item || typeof item !== "object") {
            return false;
        }
        const candidate = item as {
            name?: unknown;
            pm2_env?: { status?: unknown };
        };
        return candidate.name === processName && candidate.pm2_env?.status === "online";
    });

    if (!entry) {
        return {
            found: false,
            reason: `No online PM2 process named "${processName}" was found.`
        };
    }

    return {
        found: true,
        processName
    };
}

function commandOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { windowsHide: true }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function pm2ListParse(value: string): unknown[] | null {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
