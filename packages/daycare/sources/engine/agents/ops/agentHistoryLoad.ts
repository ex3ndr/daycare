import type { Config } from "@/types";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";

/**
 * Loads history records after the most recent start/reset marker.
 * Expects: records are ordered chronologically from oldest to newest.
 */
export async function agentHistoryLoad(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  const records = await agentHistoryRecordsLoad(config, agentId);
  if (records.length === 0) {
    return [];
  }

  const lastMarkerIndex = records.reduce((acc, record, index) => {
    if (record.type === "start" || record.type === "reset") {
      return index;
    }
    return acc;
  }, -1);
  if (lastMarkerIndex < 0) {
    return records;
  }

  const tail = records.slice(lastMarkerIndex + 1);
  const marker = records[lastMarkerIndex];
  if (marker?.type === "reset" && marker.message && marker.message.trim().length > 0) {
    return [marker, ...tail];
  }
  return tail;
}
