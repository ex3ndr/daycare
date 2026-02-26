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

    it("writes markdown output with date-prefixed name when no collision exists", async () => {
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
        // Path should contain date prefix: ~/outputs/YYYYMMDDHHMMSS-report.md
        expect(text).toMatch(/~\/outputs\/\d{14}-report\.md/);
        const files = await fs.readdir(path.join(homeDir, "outputs"));
        const reportFile = files.find((f) => f.endsWith("-report.md"));
        expect(reportFile).toBeDefined();
        expect(reportFile).toMatch(/^\d{14}-report\.md$/);
        expect(await fs.readFile(path.join(homeDir, "outputs", reportFile!), "utf8")).toBe("# Summary");
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
        expect(text).toMatch(/~\/outputs\/\d{14}-report\.json/);
        const files = await fs.readdir(path.join(homeDir, "outputs"));
        const reportFile = files.find((f) => f.endsWith("-report.json"));
        expect(reportFile).toBeDefined();
        expect(await fs.readFile(path.join(homeDir, "outputs", reportFile!), "utf8")).toBe('{"ok":true}');
    });

    it("uses dedup suffix when target already exists", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

        try {
            // Write first file to create collision
            await tool.execute({ name: "report", content: "old" }, context, toolCall);

            // Write second file with same name
            const result = await tool.execute({ name: "report", content: "# New Summary" }, context, toolCall);

            const text = toolMessageText(result.toolMessage);
            // Should have -1 suffix for collision
            expect(text).toMatch(/~\/outputs\/\d{14}-report-1\.md/);
            const files = await fs.readdir(path.join(homeDir, "outputs"));
            const dedupFile = files.find((f) => /-report-1\.md$/.test(f));
            expect(dedupFile).toBeDefined();
            expect(await fs.readFile(path.join(homeDir, "outputs", dedupFile!), "utf8")).toBe("# New Summary");
        } finally {
            nowSpy.mockRestore();
        }
    });

    it("uses dedup suffix for json targets", async () => {
        const tool = buildWriteOutputTool();
        const context = createContext(homeDir);
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

        try {
            // Write first file to create collision
            await tool.execute({ name: "report", format: "json", content: '{"old":true}' }, context, toolCall);

            // Write second file with same name
            const result = await tool.execute(
                { name: "report", format: "json", content: '{"ok":true}' },
                context,
                toolCall
            );

            const text = toolMessageText(result.toolMessage);
            expect(text).toMatch(/~\/outputs\/\d{14}-report-1\.json/);
            const files = await fs.readdir(path.join(homeDir, "outputs"));
            const dedupFile = files.find((f) => /-report-1\.json$/.test(f));
            expect(dedupFile).toBeDefined();
            expect(await fs.readFile(path.join(homeDir, "outputs", dedupFile!), "utf8")).toBe('{"ok":true}');
        } finally {
            nowSpy.mockRestore();
        }
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
    const write = vi.fn(
        async ({
            path: targetPath,
            content,
            exclusive
        }: {
            path: string;
            content: string | Buffer;
            exclusive?: boolean;
        }) => {
            const resolvedPath =
                targetPath === "~"
                    ? homeDir
                    : targetPath.startsWith("~/")
                      ? path.join(homeDir, targetPath.slice(2))
                      : targetPath;
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            if (exclusive === true) {
                try {
                    await fs.access(resolvedPath);
                    throw Object.assign(new Error(`EEXIST: file already exists, open '${resolvedPath}'`), {
                        code: "EEXIST"
                    });
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                        throw error;
                    }
                }
            }
            await fs.writeFile(resolvedPath, content);
            return {
                bytes: Buffer.isBuffer(content) ? content.byteLength : Buffer.byteLength(content, "utf8"),
                resolvedPath,
                sandboxPath: targetPath
            };
        }
    );

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
