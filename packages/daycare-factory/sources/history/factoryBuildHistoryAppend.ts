import { appendFile } from "node:fs/promises";

interface JsonRecord {
    [key: string]: unknown;
}

/**
 * Appends one structured history record to build.jsonl.
 * Expects: historyPath points to a writable file location.
 */
export async function factoryBuildHistoryAppend(historyPath: string, entry: JsonRecord): Promise<void> {
    const record = {
        timestamp: Date.now(),
        ...entry
    };

    const line = `${factoryJsonSerializeSafe(record)}\n`;
    await appendFile(historyPath, line, "utf-8");
}

function factoryJsonSerializeSafe(value: unknown): string {
    try {
        return JSON.stringify(value, (_, fieldValue) => {
            if (typeof fieldValue === "bigint") {
                return fieldValue.toString();
            }
            if (fieldValue instanceof Error) {
                return {
                    name: fieldValue.name,
                    message: fieldValue.message
                };
            }
            return fieldValue;
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "failed to serialize history";
        return JSON.stringify({
            timestamp: Date.now(),
            type: "history.serialize_error",
            message
        });
    }
}
