import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import { z } from "zod";

import type { Config } from "@/types";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { agentPath } from "./agentPath.js";

const fileReferenceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number(),
    path: z.string().min(1)
  })
  .strict();

const toolExecutionResultSchema = z
  .object({
    toolMessage: z.unknown(),
    files: z.array(fileReferenceSchema)
  })
  .strict();

const tokenSizeSchema = z
  .object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    cacheRead: z.number().int().nonnegative(),
    cacheWrite: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  })
  .strict();

const tokenSnapshotSizeSchema = tokenSizeSchema;

const tokenEntrySchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    size: tokenSnapshotSizeSchema
  })
  .strict()
  .nullable();

const historyRecordSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("start"),
      at: z.number().int()
    })
    .strict(),
  z
    .object({
      type: z.literal("reset"),
      at: z.number().int(),
      message: z.string().optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("user_message"),
      at: z.number().int(),
      text: z.string(),
      files: z.array(fileReferenceSchema)
    })
    .strict(),
  z
    .object({
      type: z.literal("assistant_message"),
      at: z.number().int(),
      text: z.string(),
      files: z.array(fileReferenceSchema),
      toolCalls: z.array(z.unknown()),
      tokens: tokenEntrySchema
    })
    .strict(),
  z
    .object({
      type: z.literal("tool_result"),
      at: z.number().int(),
      toolCallId: z.string().min(1),
      output: toolExecutionResultSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("rlm_start"),
      at: z.number().int(),
      toolCallId: z.string().min(1),
      code: z.string(),
      preamble: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal("rlm_tool_call"),
      at: z.number().int(),
      toolCallId: z.string().min(1),
      snapshot: z.string().min(1),
      printOutput: z.array(z.string()),
      toolCallCount: z.number().int().nonnegative(),
      toolName: z.string().min(1),
      toolArgs: z.unknown()
    })
    .strict(),
  z
    .object({
      type: z.literal("rlm_tool_result"),
      at: z.number().int(),
      toolCallId: z.string().min(1),
      toolName: z.string().min(1),
      toolResult: z.string(),
      toolIsError: z.boolean()
    })
    .strict(),
  z
    .object({
      type: z.literal("rlm_complete"),
      at: z.number().int(),
      toolCallId: z.string().min(1),
      output: z.string(),
      printOutput: z.array(z.string()),
      toolCallCount: z.number().int().nonnegative(),
      isError: z.boolean(),
      error: z.string().optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("assistant_rewrite"),
      at: z.number().int(),
      assistantAt: z.number().int(),
      text: z.string(),
      reason: z.enum(["run_python_say_after_trim", "run_python_failure_trim"])
    })
    .strict(),
  z
    .object({
      type: z.literal("note"),
      at: z.number().int(),
      text: z.string()
    })
    .strict()
]);

/**
 * Loads and validates all persisted history records for one agent.
 * Expects: history file is newline-delimited JSON at `<agent>/history.jsonl`.
 */
export async function agentHistoryRecordsLoad(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  const basePath = agentPath(config, agentId);
  const filePath = path.join(basePath, "history.jsonl");
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const records: AgentHistoryRecord[] = [];
  const reader = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const result = historyRecordSchema.safeParse(parsed);
    if (result.success) {
      records.push(result.data as AgentHistoryRecord);
    }
  }

  return records;
}
