import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { fileResolve } from "./fileResolve.js";

describe("fileResolve", () => {
    it("resolves and persists a file reference from sandbox path", async () => {
        const context = contextBuild({
            read: async () => ({
                type: "binary",
                displayPath: "/tmp/image.png",
                content: Buffer.from("image")
            }),
            write: async () => ({
                sandboxPath: "sandbox:/downloads/image.png",
                resolvedPath: "/tmp/image.png",
                bytes: 5
            })
        });

        const result = await fileResolve({ path: "/tmp/image.png", mimeType: "image/png" }, context);

        expect(result).toEqual({
            id: "sandbox:/downloads/image.png",
            name: "image.png",
            mimeType: "image/png",
            size: 5,
            path: "/tmp/image.png"
        });
    });

    it("throws when path is missing", async () => {
        const context = contextBuild({});
        await expect(fileResolve({ path: "", mimeType: "text/plain" }, context)).rejects.toThrow("path is required");
    });

    it("throws when sandbox path is not a binary file", async () => {
        const context = contextBuild({
            read: async () => ({
                type: "text",
                displayPath: "/tmp/report.txt",
                content: "text"
            })
        });
        await expect(fileResolve({ path: "/tmp/report.txt", mimeType: "text/plain" }, context)).rejects.toThrow(
            "Path is not a file"
        );
    });
});

function contextBuild(options: {
    read?: (args: {
        path: string;
        binary: true;
    }) => Promise<
        | { type: "binary"; displayPath: string; content: Buffer }
        | { type: "text"; displayPath: string; content: string }
    >;
    write?: (args: { path: string; content: Buffer }) => Promise<{
        sandboxPath: string;
        resolvedPath: string;
        bytes: number;
    }>;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {
            read:
                options.read ??
                (async ({ path }: { path: string; binary: true }) => ({
                    type: "binary" as const,
                    displayPath: path,
                    content: Buffer.from(path)
                })),
            write:
                options.write ??
                (async ({ path, content }: { path: string; content: Buffer }) => ({
                    sandboxPath: `sandbox:${path}`,
                    resolvedPath: `/tmp/${path.replace("~/downloads/", "")}`,
                    bytes: content.length
                }))
        } as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}
