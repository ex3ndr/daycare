import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config } from "@/types";
import { agentPath } from "./agentPath.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";

/**
 * Redacts a message from agent history by messageId.
 * Replaces the message text with <deleted> to maintain conversation flow.
 * Expects: messageId is a non-empty string.
 * Returns: true if a record was found and redacted, false otherwise.
 */
export async function agentHistoryRedactMessage(
  config: Config,
  agentId: string,
  messageId: string
): Promise<boolean> {
  if (!messageId || messageId.trim().length === 0) {
    return false;
  }

  const records = await agentHistoryRecordsLoad(config, agentId);
  if (records.length === 0) {
    return false;
  }

  let found = false;
  const updatedRecords = records.map((record) => {
    if (record.type === "user_message" && record.messageId === messageId) {
      found = true;
      return {
        ...record,
        text: "<deleted>"
      };
    }
    return record;
  });

  if (!found) {
    return false;
  }

  const basePath = agentPath(config, agentId);
  const filePath = path.join(basePath, "history.jsonl");

  const lines = updatedRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await fs.writeFile(filePath, lines, "utf8");

  return true;
}
