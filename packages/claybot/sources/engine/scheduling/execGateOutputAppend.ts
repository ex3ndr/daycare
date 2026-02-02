import type { ExecGateCheckResult } from "./execGateCheck.js";

/**
 * Appends trimmed gate output to a prompt when available.
 * Returns the original prompt when there is no output.
 */
export function execGateOutputAppend(
  prompt: string,
  result: ExecGateCheckResult
): string {
  const output = formatGateOutput(result.stdout, result.stderr);
  if (!output) {
    return prompt;
  }
  const base = prompt.trim();
  const suffix = `[Gate output]\n${output}`;
  if (!base) {
    return suffix;
  }
  return `${base}\n\n${suffix}`;
}

function formatGateOutput(stdout: string, stderr: string): string {
  const parts = [stdout, stderr]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parts.join("\n").trim();
}
