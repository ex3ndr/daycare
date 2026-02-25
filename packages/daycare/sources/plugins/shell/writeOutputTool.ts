import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import { writeOutputFileNameResolve } from "./writeOutputFileNameResolve.js";

const OUTPUTS_HOME_RELATIVE_DIR = "~/outputs";
const writeOutputFormatSchema = Type.Union([Type.Literal("markdown"), Type.Literal("json")]);

const writeOutputSchema = Type.Object(
    {
        name: Type.String({ minLength: 1, description: "File name without extension" }),
        content: Type.String({ description: "File content to write" }),
        format: Type.Optional(writeOutputFormatSchema)
    },
    { additionalProperties: false }
);

type WriteOutputArgs = Static<typeof writeOutputSchema>;
type WriteOutputFormat = Static<typeof writeOutputFormatSchema>;

const writeOutputResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        path: Type.String(),
        bytes: Type.Number(),
        format: writeOutputFormatSchema
    },
    { additionalProperties: false }
);

type WriteOutputResult = Static<typeof writeOutputResultSchema>;

const writeOutputReturns: ToolResultContract<WriteOutputResult> = {
    schema: writeOutputResultSchema,
    toLLMText: (result) => `${result.summary} Use this path to read the file back.`
};

export function buildWriteOutputTool(): ToolDefinition {
    return {
        tool: {
            name: "write_output",
            description:
                "Write markdown or json output under ~/outputs with date-prefixed collision-safe naming (`YYYYMMDDHHMMSS-name.md`, `YYYYMMDDHHMMSS-name-1.md`, ...). Returns the unique path where the file was written — always print it, since the path includes a timestamp and is not predictable.",
            parameters: writeOutputSchema
        },
        returns: writeOutputReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as WriteOutputArgs;
            const format = payload.format ?? "markdown";
            const extension = outputExtensionResolve(format);
            const normalizedName = outputNameNormalize(payload.name);
            const outputsHostDir = path.join(toolContext.sandbox.homeDir, "outputs");
            const existingFileNames = await outputFileNamesList(outputsHostDir);
            const fileName = writeOutputFileNameResolve(normalizedName, existingFileNames, extension);
            const targetPath = path.posix.join(OUTPUTS_HOME_RELATIVE_DIR, fileName);
            const writeResult = await toolContext.sandbox.write({
                path: targetPath,
                content: payload.content
            });
            const outputPath = path.posix.join(OUTPUTS_HOME_RELATIVE_DIR, fileName);
            const summary = `Wrote ${writeResult.bytes} bytes to ${outputPath}.`;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "write_output",
                path: outputPath,
                bytes: writeResult.bytes,
                format
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "write_output",
                isError: false,
                path: outputPath,
                bytes: writeResult.bytes,
                format
            });
        }
    };
}

function outputNameNormalize(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error("name must be a non-empty file name.");
    }
    if (trimmed === "." || trimmed === "..") {
        throw new Error("name must not be '.' or '..'.");
    }
    if (trimmed.toLowerCase().endsWith(".md") || trimmed.toLowerCase().endsWith(".json")) {
        throw new Error("name must not include a file extension.");
    }
    if (trimmed.includes("/") || trimmed.includes("\\")) {
        throw new Error("name must be a file name, not a path.");
    }
    return trimmed;
}

function outputExtensionResolve(format: WriteOutputFormat): "md" | "json" {
    return format === "json" ? "json" : "md";
}

async function outputFileNamesList(outputsHostDir: string): Promise<Set<string>> {
    try {
        const entries = await fs.readdir(outputsHostDir, { withFileTypes: true });
        const names = new Set<string>();
        for (const entry of entries) {
            if (entry.isFile()) {
                names.add(entry.name);
            }
        }
        return names;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return new Set<string>();
        }
        throw error;
    }
}

function buildToolMessage(
    toolCall: { id: string; name: string },
    text: string,
    isError: boolean,
    details?: Record<string, unknown>
): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details,
        isError,
        timestamp: Date.now()
    };
}
