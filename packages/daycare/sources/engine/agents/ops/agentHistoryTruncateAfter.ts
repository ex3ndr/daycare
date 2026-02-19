import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config } from "@/types";
import { agentPath } from "./agentPath.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

export type TruncateResult = {
  success: boolean;
  deletedCount: number;
};

/**
 * Truncates agent history after a specific messageId.
 * Keeps all records up to and including the user_message with the given messageId,
 * removes everything after, and appends a truncation marker.
 * 
 * Expects: messageId is a non-empty string.
 * Returns: { success: boolean, deletedCount: number }
 */
export async function agentHistoryTruncateAfter(
  config: Config,
  agentId: string,
  messageId: string,
  reason?: string
): Promise<TruncateResult> {
  if (!messageId || messageId.trim().length === 0) {
    return { success: false, deletedCount: 0 };
  }

  const records = await agentHistoryRecordsLoad(config, agentId);
  if (records.length === 0) {
    return { success: false, deletedCount: 0 };
  }

  // Find the index of the user_message with the target messageId
  let cutIndex = -1;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.type === "user_message" && record.messageId === messageId) {
      cutIndex = i;
      break;
    }
  }

  if (cutIndex === -1) {
    return { success: false, deletedCount: 0 };
  }

  const deletedCount = records.length - cutIndex - 1;
  if (deletedCount <= 0) {
    return { success: false, deletedCount: 0 };
  }

  // Keep records up to and including the target
  const kept = records.slice(0, cutIndex + 1);

  // Add a truncation marker note
  const truncationNote: AgentHistoryRecord = {
    type: "note",
    at: Date.now(),
    text: reason 
      ? `[${deletedCount} message(s) deleted: ${reason}]`
      : `[${deletedCount} message(s) deleted]`
  };

  const updatedRecords = [...kept, truncationNote];

  const basePath = agentPath(config, agentId);
  const filePath = path.join(basePath, "history.jsonl");

  const lines = updatedRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await fs.writeFile(filePath, lines, "utf8");

  return { success: true, deletedCount };
}
