import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { ContextCompactionStatus } from "./contextCompactionStatusBuild.js";

/**
 * Builds the system compaction notice with the embedded compaction prompt.
 * Expects: status was computed from the current session history.
 */
export async function contextCompactionNoticeBuild(
  status: ContextCompactionStatus
): Promise<string> {
  const percent = Math.round(status.utilization * 100);
  const remaining = status.emergencyLimit - status.estimatedTokens;
  const targetRatio = status.severity === "critical" ? 0.4 : 0.5;
  const targetTokens = Math.max(1, Math.floor(status.emergencyLimit * targetRatio));
  const noticeTemplate = (await agentPromptBundledRead("COMPACTION_NOTICE.md")).trim();
  const compactionPrompt = (await agentPromptBundledRead("COMPACTION.md")).trim();

  return applyTemplate(noticeTemplate, {
    estimatedTokens: status.estimatedTokens,
    percent,
    emergencyLimit: status.emergencyLimit,
    warningLimit: status.warningLimit,
    criticalLimit: status.criticalLimit,
    remaining,
    severity: status.severity,
    targetTokens,
    compactionPrompt
  });
}

function applyTemplate(template: string, values: Record<string, string | number>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, String(value));
  }
  return output;
}
