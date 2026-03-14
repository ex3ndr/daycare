import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { evalCli } from "./evalCli.js";

describe("evalCli", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("reads a scenario file and writes a markdown trace next to it by default", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-eval-cli-"));
        try {
            const scenarioPath = path.join(dir, "scenario.json");
            const outputPath = path.join(dir, "cli-test.trace.md");
            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

            await writeFile(
                scenarioPath,
                JSON.stringify({
                    name: "cli-test",
                    agent: {
                        kind: "agent",
                        path: "eval-agent"
                    },
                    turns: [{ role: "user", text: "Hello there" }]
                }),
                "utf8"
            );

            const result = await evalCli(scenarioPath);
            const markdown = await readFile(outputPath, "utf8");

            expect(result.outputPath).toBe(outputPath);
            expect(markdown).toContain("# Eval Trace: cli-test");
            expect(markdown).toContain("### Assistant");
            expect(consoleSpy).toHaveBeenCalledWith("Scenario: cli-test");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
