import type { AgentHistoryRecord } from "@/lib/engine-client";

/**
 * Serializes agent history records to newline-delimited JSON.
 * Expects records to be pre-sorted by caller in the desired output order.
 */
export function agentHistoryExportJsonl(records: AgentHistoryRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}
