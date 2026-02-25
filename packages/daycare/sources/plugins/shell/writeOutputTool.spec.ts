import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { buildWriteOutputTool } from "./writeOutputTool.js";

const toolCall = { id: "tool-call-write-output", name: "write_output" };

describe("buildWriteOutputTool", () => {
    let homeDir: string;

    beforeEach(async () => {
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-output-tool-"));
    });

    afterEach(async () => {
        await fs.rm(homeDir, { recursive: true, force: true });
    });

    it("exposes expected schema", () => {
        const tool = buildWriteOutputTool();
        expect(tool.tool.parameters.type).toBe("object");
        expect(tool.tool.parameters.required).toEqual(["name", "content"]);
    });

    it("writes markdown output with base name when no collision exists", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);

        const result = await tool.execute(
            {
                name: "report",
                content: "# Summary"
            },
            context,
            toolCall
        );

        const text = toolMessageText(result.toolMessage);
        expect(text).toContain("~/outputs/report.md");
        expect(await fs.readFile(path.join(homeDir, "outputs", "report.md"), "utf8")).toBe("# Summary");
    });

    it("writes json output when format=json", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);

        const result = await tool.execute(
            {
                name: "report",
                format: "json",
                content: '{"ok":true}'
            },
            context,
            toolCall
        );

        const text = toolMessageText(result.toolMessage);
        expect(text).toContain("~/outputs/report.json");
        expect(await fs.readFile(path.join(homeDir, "outputs", "report.json"), "utf8")).toBe('{"ok":true}');
    });

    it("uses dedup suffix when target already exists", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);
        const outputsDir = path.join(homeDir, "outputs");
        await fs.mkdir(outputsDir, { recursive: true });
        await fs.writeFile(path.join(outputsDir, "report.md"), "old", "utf8");

        const result = await tool.execute(
            {
                name: "report",
                content: "# New Summary"
            },
            context,
            toolCall
        );

        const text = toolMessageText(result.toolMessage);
        expect(text).toContain("~/outputs/report (1).md");
        expect(await fs.readFile(path.join(outputsDir, "report (1).md"), "utf8")).toBe("# New Summary");
    });

    it("uses dedup suffix for json targets", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);
        const outputsDir = path.join(homeDir, "outputs");
        await fs.mkdir(outputsDir, { recursive: true });
        await fs.writeFile(path.join(outputsDir, "report.json"), '{"old":true}', "utf8");

        const result = await tool.execute(
            {
                name: "report",
                format: "json",
                content: '{"ok":true}'
            },
            context,
            toolCall
        );

        const text = toolMessageText(result.toolMessage);
        expect(text).toContain("~/outputs/report (1).json");
        expect(await fs.readFile(path.join(outputsDir, "report (1).json"), "utf8")).toBe('{"ok":true}');
    });

    it("rejects names that already include an extension", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);

        await expect(
            tool.execute(
                {
                    name: "report.md",
                    content: "# Summary"
                },
                context,
                toolCall
            )
        ).rejects.toThrow("name must not include a file extension");
    });
});

function createContext(homeDir: string): ToolExecutionContext {
    const write = vi.fn(async ({ path: targetPath, content }: { path: string; content: string | Buffer }) => {
        const resolvedPath =
            targetPath === "~"
                ? homeDir
                : targetPath.startsWith("~/")
                  ? path.join(homeDir, targetPath.slice(2))
                  : targetPath;
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content);
        return {
            bytes: Buffer.isBuffer(content) ? content.byteLength : Buffer.byteLength(content, "utf8"),
            resolvedPath,
            sandboxPath: targetPath
        };
    });

    return {
        sandbox: {
            homeDir,
            write
        } as unknown as ToolExecutionContext["sandbox"]
    } as ToolExecutionContext;
}

function toolMessageText(message: { content: Array<{ type: string; text?: string }> }): string {
    return message.content
        .filter((entry) => entry.type === "text")
        .map((entry) => entry.text ?? "")
        .join("\n");
}
