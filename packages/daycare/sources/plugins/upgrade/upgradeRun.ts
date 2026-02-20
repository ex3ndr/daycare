import { execFile } from "node:child_process";

type UpgradeRunOptions = {
    strategy: "pm2";
    processName: string;
    sendStatus: (text: string) => Promise<void>;
    version?: string;
};

type Pm2ProcessSnapshot = {
    pid: number | null;
    status: string | null;
    pmUptime: number | null;
    restartCount: number | null;
};

/**
 * Runs a full CLI upgrade and restart flow for the configured runtime strategy.
 * PM2 restart command errors are ignored only when PM2 state shows a successful restart.
 * Expects: strategy is supported and processName is a non-empty PM2 process identifier.
 */
export async function upgradeRun(options: UpgradeRunOptions): Promise<void> {
    const packageSpec = options.version ? `daycare-cli@${options.version}` : "daycare-cli";

    await options.sendStatus(`Upgrading Daycare CLI (npm install -g ${packageSpec})...`);

    try {
        await commandRun("npm", ["install", "-g", packageSpec]);
    } catch (error) {
        const text = `Upgrade failed while installing ${packageSpec}: ${errorTextBuild(error)}`;
        await options.sendStatus(text);
        throw new Error(text);
    }

    if (options.strategy !== "pm2") {
        const text = `Upgrade failed: unsupported strategy ${options.strategy}`;
        await options.sendStatus(text);
        throw new Error(text);
    }

    await options.sendStatus(`Restarting process "${options.processName}" via pm2...`);
    const beforeSnapshot = await pm2ProcessSnapshotRead(options.processName);

    try {
        await commandRun("pm2", ["restart", options.processName]);
    } catch (error) {
        const afterSnapshot = await pm2ProcessSnapshotRead(options.processName);
        if (pm2RestartLikelySucceeded(beforeSnapshot, afterSnapshot)) {
            return;
        }
        throw new Error(
            `Upgrade failed while restarting PM2 process "${options.processName}": ${errorTextBuild(error)}`
        );
    }
}

function commandRun(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(
            command,
            args,
            {
                windowsHide: true
            },
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            }
        );
    });
}

function errorTextBuild(error: unknown): string {
    if (!(error instanceof Error)) {
        return "Unknown error";
    }
    const withOutput = error as Error & {
        stderr?: string | Buffer;
        stdout?: string | Buffer;
    };
    const details = [String(withOutput.stderr ?? "").trim(), String(withOutput.stdout ?? "").trim()].find(
        (entry) => entry.length > 0
    );
    if (details) {
        return details;
    }
    return error.message || "Unknown error";
}

function pm2RestartLikelySucceeded(
    beforeSnapshot: Pm2ProcessSnapshot | null,
    afterSnapshot: Pm2ProcessSnapshot | null
): boolean {
    if (!beforeSnapshot || !afterSnapshot) {
        return false;
    }
    if (afterSnapshot.status !== "online") {
        return false;
    }
    if (
        typeof beforeSnapshot.restartCount === "number" &&
        typeof afterSnapshot.restartCount === "number" &&
        afterSnapshot.restartCount > beforeSnapshot.restartCount
    ) {
        return true;
    }
    if (
        typeof beforeSnapshot.pmUptime === "number" &&
        typeof afterSnapshot.pmUptime === "number" &&
        afterSnapshot.pmUptime > beforeSnapshot.pmUptime
    ) {
        return true;
    }
    if (
        typeof beforeSnapshot.pid === "number" &&
        typeof afterSnapshot.pid === "number" &&
        afterSnapshot.pid !== beforeSnapshot.pid
    ) {
        return true;
    }
    return false;
}

async function pm2ProcessSnapshotRead(processName: string): Promise<Pm2ProcessSnapshot | null> {
    try {
        const output = await commandOutput("pm2", ["jlist"]);
        return pm2ProcessSnapshotParse(output, processName);
    } catch {
        return null;
    }
}

function commandOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                const withOutput = error as Error & {
                    stdout?: string;
                    stderr?: string;
                };
                withOutput.stdout = stdout;
                withOutput.stderr = stderr;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function pm2ProcessSnapshotParse(jlistOutput: string, processName: string): Pm2ProcessSnapshot | null {
    let parsed: unknown[];
    try {
        parsed = JSON.parse(jlistOutput);
    } catch {
        return null;
    }
    if (!Array.isArray(parsed)) {
        return null;
    }
    const entry = parsed.find(
        (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            "name" in item &&
            (item as Record<string, unknown>).name === processName
    ) as Record<string, unknown> | undefined;
    if (!entry) {
        return null;
    }
    const pm2Env = entry.pm2_env as Record<string, unknown> | undefined;
    return {
        pid: typeof entry.pid === "number" ? entry.pid : null,
        status: typeof pm2Env?.status === "string" ? pm2Env.status : null,
        pmUptime: typeof pm2Env?.pm_uptime === "number" ? pm2Env.pm_uptime : null,
        restartCount: typeof pm2Env?.restart_time === "number" ? pm2Env.restart_time : null
    };
}
