import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { factoryBuildHistoryAppend } from "./factoryBuildHistoryAppend.js";

const tempDirectories: string[] = [];

afterEach(async () => {
    for (const directory of tempDirectories.splice(0, tempDirectories.length)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe("factoryBuildHistoryAppend", () => {
    it("appends json lines with timestamp", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-history-"));
        tempDirectories.push(directory);
        const historyPath = join(directory, "build.jsonl");

        await factoryBuildHistoryAppend(historyPath, { type: "first", value: 1 });
        await factoryBuildHistoryAppend(historyPath, { type: "second", value: 2 });

        const contents = await readFile(historyPath, "utf-8");
        const lines = contents.trim().split("\n");

        expect(lines).toHaveLength(2);
        const firstLine = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
        expect(firstLine.type).toBe("first");
        expect(typeof firstLine.timestamp).toBe("number");
    });
});
