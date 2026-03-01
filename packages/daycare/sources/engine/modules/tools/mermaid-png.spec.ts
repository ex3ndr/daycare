import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { buildMermaidPngTool } from "./mermaid-png.js";

const mocks = vi.hoisted(() => ({
    renderToPng: vi.fn(async () => Buffer.from("png"))
}));

vi.mock("../../../util/renderToPng.js", () => ({
    renderToPng: mocks.renderToPng
}));

describe("buildMermaidPngTool", () => {
    it("renders a png file from mermaid source", async () => {
        const write = vi.fn(async (_args: { path: string; content: Buffer }) => ({
            bytes: 3,
            resolvedPath: "/tmp/home/downloads/pipeline.png",
            sandboxPath: "~/downloads/pipeline.png"
        }));

        const tool = buildMermaidPngTool();
        const result = await tool.execute(
            {
                mermaid: "graph LR\n  A --> B",
                name: "pipeline"
            },
            contextBuild(write),
            { id: "call-1", name: "generate_mermaid_png" }
        );

        expect(write).toHaveBeenCalledTimes(1);
        expect(mocks.renderToPng).toHaveBeenCalledTimes(1);
        expect(write.mock.calls[0]?.[0]).toMatchObject({
            path: "~/downloads/pipeline.png"
        });
        expect(result.toolMessage.isError).toBe(false);
        expect(result.toolMessage.content).toEqual([
            {
                type: "text",
                text: "Generated Mermaid PNG: ~/downloads/pipeline.png"
            }
        ]);
    });

    it("rejects fenced markdown input", async () => {
        const write = vi.fn();
        const tool = buildMermaidPngTool();

        await expect(
            tool.execute(
                {
                    mermaid: "```mermaid\ngraph LR\n  A --> B\n```"
                },
                contextBuild(write),
                { id: "call-1", name: "generate_mermaid_png" }
            )
        ).rejects.toThrow("raw Mermaid source without ``` fences");

        expect(write).not.toHaveBeenCalled();
    });

    it("rejects unknown theme", async () => {
        const write = vi.fn();
        const tool = buildMermaidPngTool();

        await expect(
            tool.execute(
                {
                    mermaid: "graph LR\n  A --> B",
                    theme: "not-a-theme"
                },
                contextBuild(write),
                { id: "call-1", name: "generate_mermaid_png" }
            )
        ).rejects.toThrow("Unknown Mermaid theme");

        expect(write).not.toHaveBeenCalled();
    });
});

function contextBuild(
    write: (options: { path: string; content: Buffer }) => Promise<{
        bytes: number;
        resolvedPath: string;
        sandboxPath: string;
    }>
): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            homeDir: "/tmp/home",
            write
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-test" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {} as unknown as ToolExecutionContext["messageContext"],
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
