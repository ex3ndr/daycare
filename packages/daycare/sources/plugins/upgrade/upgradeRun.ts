import { execFile } from "node:child_process";

type UpgradeRunOptions = {
  strategy: "pm2";
  processName: string;
  sendStatus: (text: string) => Promise<void>;
};

/**
 * Runs a full CLI upgrade and restart flow for the configured runtime strategy.
 * Expects: strategy is supported and processName is a non-empty PM2 process identifier.
 */
export async function upgradeRun(options: UpgradeRunOptions): Promise<void> {
  await options.sendStatus("Upgrading Daycare CLI (npm install -g daycare-cli)...");

  try {
    await commandRun("npm", ["install", "-g", "daycare-cli"]);
  } catch (error) {
    const text = `Upgrade failed while installing daycare-cli: ${errorTextBuild(error)}`;
    await options.sendStatus(text);
    throw new Error(text);
  }

  if (options.strategy !== "pm2") {
    const text = `Upgrade failed: unsupported strategy ${options.strategy}`;
    await options.sendStatus(text);
    throw new Error(text);
  }

  await options.sendStatus(`Restarting process \"${options.processName}\" via pm2...`);

  try {
    await commandRun("pm2", ["restart", options.processName]);
  } catch (error) {
    const text = `Upgrade failed while restarting PM2 process \"${options.processName}\": ${errorTextBuild(error)}`;
    await options.sendStatus(text);
    throw new Error(text);
  }

  await options.sendStatus(`Upgrade complete. PM2 process \"${options.processName}\" restarted.`);
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
  const details = [
    String(withOutput.stderr ?? "").trim(),
    String(withOutput.stdout ?? "").trim()
  ].find((entry) => entry.length > 0);
  if (details) {
    return details;
  }
  return error.message || "Unknown error";
}
