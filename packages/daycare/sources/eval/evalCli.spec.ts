import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

    it("resolves relative scenario paths from an explicit cwd", async () => {
        const rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-eval-cli-root-"));

        try {
            const scenarioPath = path.join(rootDir, ".context", "scenario.json");
            const outputPath = path.join(rootDir, ".context", "cli-relative.trace.md");
            const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

            await mkdir(path.dirname(scenarioPath), { recursive: true });
            await writeFile(
                scenarioPath,
                JSON.stringify({
                    name: "cli-relative",
                    agent: {
                        kind: "agent",
                        path: "eval-agent"
                    },
                    turns: [{ role: "user", text: "Hello there" }]
                }),
                "utf8"
            );

            const result = await evalCli(".context/scenario.json", undefined, { cwd: rootDir });
            const markdown = await readFile(outputPath, "utf8");

            expect(result.outputPath).toBe(outputPath);
            expect(markdown).toContain("# Eval Trace: cli-relative");
            expect(consoleSpy).toHaveBeenCalledWith(`Output: ${outputPath}`);
        } finally {
            await rm(rootDir, { recursive: true, force: true });
        }
    });

    it("runs scripted inference from the scenario and renders tool calls in the trace", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-eval-cli-scripted-"));
        try {
            const scenarioPath = path.join(dir, "scenario.json");
            const outputPath = path.join(dir, "subagent-first.trace.md");
            vi.spyOn(console, "log").mockImplementation(() => undefined);

            await writeFile(
                scenarioPath,
                JSON.stringify({
                    name: "subagent-first",
                    agent: {
                        kind: "connector",
                        path: "telegram"
                    },
                    turns: [{ role: "user", text: "Investigate the onboarding failures and report back." }],
                    inference: {
                        type: "scripted",
                        calls: [
                            {
                                branches: [
                                    {
                                        whenSystemPromptIncludes: [
                                            "be subagent-first for almost every non-trivial request",
                                            "use `start_background_agent` before doing the substantive work yourself"
                                        ],
                                        toolCall: {
                                            id: "tool-1",
                                            name: "start_background_agent",
                                            arguments: {
                                                name: "onboarding-diagnosis",
                                                prompt: "Investigate the onboarding failures and report back."
                                            }
                                        }
                                    },
                                    {
                                        message:
                                            "I can investigate inline, but I am not being pushed strongly enough toward a background subagent."
                                    }
                                ]
                            },
                            {
                                branches: [
                                    {
                                        message:
                                            "Started a background subagent to investigate the onboarding failures and report back."
                                    }
                                ]
                            }
                        ]
                    }
                }),
                "utf8"
            );

            const result = await evalCli(scenarioPath, outputPath);
            const markdown = await readFile(outputPath, "utf8");

            expect(markdown).toContain(
                '> Tool Call: start_background_agent({"name":"onboarding-diagnosis","prompt":"Investigate the onboarding failures and report back."})'
            );
            expect(markdown).toContain("Started a background subagent to investigate the onboarding failures");
            expect(result.trace.turnResults[0]?.result).toEqual({
                type: "message",
                responseText: "Started a background subagent to investigate the onboarding failures and report back."
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
