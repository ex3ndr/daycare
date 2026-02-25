import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import type { Connector } from "@/types";
import { toolListContextBuild } from "./toolListContextBuild.js";

const baseTools = [
    { name: "run_python", description: "", parameters: {} },
    { name: "read_json", description: "", parameters: {} },
    { name: "cron_add", description: "", parameters: {} },
    { name: "send_file", description: "", parameters: {} },
    { name: "set_reaction", description: "", parameters: {} },
    { name: "generate_image", description: "", parameters: {} },
    { name: "media_analyze", description: "", parameters: {} },
    { name: "send_user_message", description: "", parameters: {} },
    { name: "agent_reset", description: "", parameters: {} },
    { name: "agent_compact", description: "", parameters: {} },
    { name: "other", description: "", parameters: {} }
] as unknown as Tool[];

describe("toolListContextBuild", () => {
    it("hides read_json outside rlm mode", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("read_json");
    });

    it("does not filter cron tools by source", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).toContain("cron_add");
    });

    it("removes background denylist tools", () => {
        const connector: Connector = {
            capabilities: { sendText: true, reactions: true, sendFiles: { modes: ["photo"] } },
            onMessage: () => () => undefined,
            sendMessage: async () => undefined
        };
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            agentKind: "background",
            connectorRegistry: {
                get: () => connector,
                list: () => ["slack"]
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("send_file");
        expect(names).not.toContain("set_reaction");
        expect(names).not.toContain("agent_reset");
        expect(names).not.toContain("agent_compact");
    });

    it("keeps agent session control tools for foreground agents", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            agentKind: "foreground",
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).toContain("agent_reset");
        expect(names).toContain("agent_compact");
    });

    it("hides file and reaction tools when unsupported", () => {
        const connector: Connector = {
            capabilities: { sendText: true },
            onMessage: () => () => undefined,
            sendMessage: async () => undefined
        };
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            connectorRegistry: {
                get: () => connector,
                list: () => ["slack"]
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("send_file");
        expect(names).not.toContain("set_reaction");
    });

    it("removes image tools when no providers", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("generate_image");
    });

    it("removes media analysis tool when no providers", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("media_analyze");
    });

    it("removes send_user_message for foreground agents", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            agentKind: "foreground",
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).not.toContain("send_user_message");
        expect(names).toContain("other");
    });

    it("keeps send_user_message for background agents", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            agentKind: "background",
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        const names = result.map((tool) => tool.name);
        expect(names).toContain("send_user_message");
    });

    it("returns no tools in noTools mode", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            noTools: true,
            rlm: true,
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        expect(result).toEqual([]);
    });

    it("returns run_python and skip in rlm mode", () => {
        const toolsWithSkip = [
            ...baseTools,
            { name: "skip", description: "Skip turn.", parameters: {} }
        ] as unknown as Tool[];
        const result = toolListContextBuild({
            tools: toolsWithSkip,
            source: "slack",
            rlm: true,
            rlmToolDescription: [
                "Execute Python code to complete the task.",
                "",
                "The following functions are available:",
                "```python",
                "def other() -> str:",
                "    ...",
                "```"
            ].join("\n"),
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        expect(result.map((tool) => tool.name)).toEqual(["run_python", "skip"]);
        expect(result[0]?.description).toContain("The following functions are available:");
        expect(result[0]?.description).toContain("def other() -> str:");
    });

    it("returns only run_python in rlm mode when skip is not registered", () => {
        const result = toolListContextBuild({
            tools: baseTools,
            source: "slack",
            rlm: true,
            connectorRegistry: {
                get: () => null,
                list: () => []
            },
            imageRegistry: { list: () => [] },
            mediaRegistry: { list: () => [] }
        });

        expect(result.map((tool) => tool.name)).toEqual(["run_python"]);
    });
});
