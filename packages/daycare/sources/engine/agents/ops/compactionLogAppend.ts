import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { AssistantMessage, Context } from "@mariozechner/pi-ai";

import type { ProviderSettings } from "../../../settings.js";

type CompactionLogAppendOptions = {
  agentsDir: string;
  agentId: string;
  startedAt: number;
  finishedAt: number;
  sessionId: string;
  requestContext: Context;
  providersOverride: ProviderSettings[];
  providerId?: string;
  modelId?: string;
  responseMessage?: AssistantMessage;
  summaryText?: string;
  error?: unknown;
};

/**
 * Appends a full compaction inference trace to the per-agent daily markdown log.
 * Expects: startedAt/finishedAt are unix timestamps in milliseconds.
 */
export async function compactionLogAppend(options: CompactionLogAppendOptions): Promise<void> {
  const {
    agentsDir,
    agentId,
    startedAt,
    finishedAt,
    sessionId,
    requestContext,
    providersOverride,
    providerId,
    modelId,
    responseMessage,
    summaryText,
    error
  } = options;
  const startedIso = new Date(startedAt).toISOString();
  const dateStamp = startedIso.slice(0, 10).replaceAll("-", "");
  const logPath = path.join(agentsDir, agentId, `compaction_${dateStamp}.md`);
  const durationMs = Math.max(0, finishedAt - startedAt);

  await mkdir(path.dirname(logPath), { recursive: true });

  const entry = [
    `## ${startedIso}`,
    "",
    `- agentId: \`${agentId}\``,
    `- sessionId: \`${sessionId}\``,
    `- startedAt: \`${startedAt}\``,
    `- finishedAt: \`${finishedAt}\``,
    `- durationMs: \`${durationMs}\``,
    `- providerId: \`${providerId ?? "unknown"}\``,
    `- modelId: \`${modelId ?? "unknown"}\``,
    `- hasError: \`${error ? "true" : "false"}\``,
    `- summaryLength: \`${summaryText?.length ?? 0}\``,
    "",
    "### Request Context",
    "```json",
    stringifySafe(requestContext),
    "```",
    "",
    "### Providers Override",
    "```json",
    stringifySafe(providersOverride),
    "```",
    "",
    "### Inference Response",
    "```json",
    stringifySafe(responseMessage ?? null),
    "```",
    "",
    "### Summary",
    "```text",
    summaryText ?? "",
    "```"
  ];

  if (error) {
    entry.push(
      "",
      "### Error",
      "```json",
      stringifySafe(errorNormalize(error)),
      "```"
    );
  }

  entry.push("");
  await appendFile(logPath, `${entry.join("\n")}\n`, "utf8");
}

function stringifySafe(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: "Failed to serialize value",
      detail: errorNormalize(error)
    }, null, 2);
  }
}

function errorNormalize(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? ""
    };
  }
  return {
    name: "UnknownError",
    message: String(error)
  };
}
