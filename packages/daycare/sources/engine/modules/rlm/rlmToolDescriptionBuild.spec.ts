import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { configResolve } from "../../../config/configResolve.js";
import { Engine } from "../../engine.js";
import { EngineEventBus } from "../../ipc/events.js";
import { rlmToolDescriptionBuild } from "./rlmToolDescriptionBuild.js";

describe("rlmToolDescriptionBuild", () => {
    it("renders the bundled template with generated stubs and no embedded skills", async () => {
        const tools = [
            { name: "run_python", description: "", parameters: {} },
            { name: "skill", description: "Load skill", parameters: {} }
        ] as unknown as Tool[];

        const description = await rlmToolDescriptionBuild(tools);
        expect(description).toContain("Execute Python code to complete the task.");
        expect(description).toContain("Prefer one multi-line Python script for the full task");
        expect(description).toContain("Do not split one task into multiple separate Python scripts");
        expect(description).toContain("minimal Python runtime with strict typing");
        expect(description).toContain("The following functions are available:");
        expect(description).toContain("```python");
        expect(description).toContain('SkillResponse = TypedDict("SkillResponse", {})');
        expect(description).toContain("def skill() -> SkillResponse:");
        expect(description).not.toContain("Available skills");
    });

    it("generates python stubs for all registered runtime tools", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-rlm-tool-description-"));
        let engine: Engine | null = null;
        try {
            const config = configResolve(
                { features: { rlm: true }, engine: { dataDir: dir } },
                path.join(dir, "settings.json")
            );
            engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const tools = engine.modules.tools.listTools();
            const description = await rlmToolDescriptionBuild(tools);

            for (const tool of tools) {
                const signaturePrefix = `def ${tool.name}(`;
                if (tool.name === "run_python" || !pythonIdentifierIs(tool.name)) {
                    expect(description).not.toContain(signaturePrefix);
                    continue;
                }
                expect(description).toContain(signaturePrefix);
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
