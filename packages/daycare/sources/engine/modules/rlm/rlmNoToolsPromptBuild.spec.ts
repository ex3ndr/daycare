import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { configResolve } from "../../../config/configResolve.js";
import { Engine } from "../../engine.js";
import { EngineEventBus } from "../../ipc/events.js";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";

describe("rlmNoToolsPromptBuild", () => {
    it("renders no-tools run_python tag instructions with generated stubs", async () => {
        const tools = [
            { name: "run_python", description: "", parameters: {} },
            { name: "echo", description: "Echo text", parameters: {} },
            { name: "skill", description: "Load skill", parameters: {} }
        ] as unknown as Tool[];

        const prompt = await rlmNoToolsPromptBuild(tools);

        expect(prompt).toContain("This mode exposes zero tools to the model.");
        expect(prompt).toContain("<run_python>...</run_python>");
        expect(prompt).toContain("You may include multiple `<run_python>` blocks in one response.");
        expect(prompt).toContain("executed sequentially from top to bottom");
        expect(prompt).toContain("all remaining `<run_python>` blocks in that response are skipped");
        expect(prompt).toContain("Tools return plain LLM strings");
        expect(prompt).toContain("Any `<say>` block after the first `<run_python>` is trimmed and not delivered");
        expect(prompt).not.toContain("<say> after <run_python> was ignored");
        expect(prompt).toContain("```python");
        expect(prompt).toContain('EchoResponse = TypedDict("EchoResponse", {})');
        expect(prompt).toContain("def echo() -> EchoResponse:");
        expect(prompt).not.toContain("Available skills");
        expect(prompt).toContain("<python_result>...</python_result>");
        expect(prompt).toContain("do not use `print()` for the final return value");
        expect(prompt).toContain("you MUST emit `<say>` with your response");
        expect(prompt.indexOf("Call tool functions directly (no `await`).")).toBeLessThan(
            prompt.indexOf("Available functions:")
        );
        expect(prompt.match(/Use `try\/except ToolError` for tool failures\./g)?.length ?? 0).toBe(1);
    });

    it("omits say-tag instructions for non-foreground agents", async () => {
        const tools = [
            { name: "run_python", description: "", parameters: {} },
            { name: "echo", description: "Echo text", parameters: {} }
        ] as unknown as Tool[];

        const prompt = await rlmNoToolsPromptBuild(tools, { isForeground: false });

        expect(prompt).not.toContain("If you include `<say>` in the same response");
        expect(prompt).not.toContain("you MUST emit `<say>` with your response");
        expect(prompt).not.toContain("<say>Starting checks</say>");
        expect(prompt).toContain("<run_python>...</run_python>");
    });

    it("generates python stubs for all registered runtime tools", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-rlm-no-tools-prompt-"));
        let engine: Engine | null = null;
        try {
            const config = configResolve(
                { features: { rlm: true, noTools: true }, engine: { dataDir: dir } },
                path.join(dir, "settings.json")
            );
            engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const tools = engine.modules.tools.listTools();
            const prompt = await rlmNoToolsPromptBuild(tools);

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
