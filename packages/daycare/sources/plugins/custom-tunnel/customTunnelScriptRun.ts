import { execFile } from "node:child_process";

/**
 * Executes a custom tunnel helper script and returns trimmed stdout.
 * Expects: script path points to an executable command.
 */
export async function customTunnelScriptRun(
  scriptPath: string,
  args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(scriptPath, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || stdout?.trim() || error.message;
        reject(new Error(message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
