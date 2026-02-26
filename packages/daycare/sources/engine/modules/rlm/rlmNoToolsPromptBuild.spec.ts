import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { configResolve } from "../../../config/configResolve.js";
import { bundledExamplesDirResolve } from "../../agents/ops/bundledExamplesDirResolve.js";
import { Engine } from "../../engine.js";
import { EngineEventBus } from "../../ipc/events.js";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";

describe("rlmNoToolsPromptBuild", () => {
    it("renders run_python tool-calling instructions with generated stubs", async () => {
        const tools = [
            { name: "run_python", description: "", parameters: {} },
            { name: "echo", description: "Echo text", parameters: {} },
            { name: "say", description: "Say text", parameters: {} },
            { name: "skill", description: "Load skill", parameters: {} }
        ] as unknown as Tool[];

        const prompt = await rlmNoToolsPromptBuild(tools);

        expect(prompt).toContain("This mode exposes one native tool to the model: `run_python`.");
        expect(prompt).toContain("call `run_python` with a string argument `code`");
        expect(prompt).toContain("You may include multiple `run_python` tool calls in one response.");
        expect(prompt).toContain("executed sequentially from top to bottom");
        expect(prompt).toContain("all remaining `run_python` calls in that response are skipped");
        expect(prompt).toContain("minimal Python runtime with strict typing");
        expect(prompt).toContain(bundledExamplesDirResolve());
        expect(prompt).toContain("prefer it for user-visible replies");
        expect(prompt).toContain("respond to the user with plain text");
        expect(prompt).toContain("```python");
        expect(prompt).toContain('EchoResponse = TypedDict("EchoResponse", {})');
        expect(prompt).toContain("def echo() -> EchoResponse:");
        expect(prompt).toContain("def skip() -> SkipResponse:");
        expect(prompt).not.toContain("Available skills");
        expect(prompt).toContain("Execution results are sent back as `run_python` tool results.");
        expect(prompt).toContain("do not use `print()` for the final return value");
        expect(prompt.indexOf("Call tool functions directly (no `await`).")).toBeLessThan(
            prompt.indexOf("Available functions:")
        );
        expect(prompt.match(/Use `try\/except ToolError` for tool failures\./g)?.length ?? 0).toBe(1);
    });

    it("omits foreground-only plain-text follow-up instructions for non-foreground agents", async () => {
        const tools = [
            { name: "run_python", description: "", parameters: {} },
            { name: "echo", description: "Echo text", parameters: {} }
        ] as unknown as Tool[];

        const prompt = await rlmNoToolsPromptBuild(tools, { isForeground: false });

        expect(prompt).not.toContain("prefer it for user-visible replies");
        expect(prompt).not.toContain("respond to the user with plain text");
        expect(prompt).toContain("run_python");
    });

    it("generates python stubs for all registered runtime tools", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-rlm-no-tools-prompt-"));
        let engine: Engine | null = null;
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const tools = engine.modules.tools.listTools();
            const prompt = await rlmNoToolsPromptBuild(tools);
            expect(prompt).toContain("def skip() -> SkipResponse:");

            for (const tool of tools) {
                const signaturePrefix = `def ${tool.name}(`;
                if (tool.name === "run_python" || !pythonIdentifierIs(tool.name)) {
                    expect(prompt).not.toContain(signaturePrefix);
                    continue;
                }
                expect(prompt).toContain(signaturePrefix);
            }
        } finally {
            if (engine) {
                await engine.shutdown();
            }
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function pythonIdentifierIs(value: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}
