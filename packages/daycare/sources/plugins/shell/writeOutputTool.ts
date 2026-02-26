import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import { writeOutputFileNameResolve } from "./writeOutputFileNameResolve.js";

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
type WriteOutputExtension = "md" | "json";

const WRITE_OUTPUT_MAX_SUFFIX = 99;

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
            const writeResult = await outputWriteWithUniqueName(toolContext.sandbox, {
                name: normalizedName,
                extension,
                content: payload.content
            });
            const summary = `Wrote ${writeResult.bytes} bytes to ${writeResult.path}.`;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "write_output",
                path: writeResult.path,
                bytes: writeResult.bytes,
                format
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "write_output",
                isError: false,
                path: writeResult.path,
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

function outputExtensionResolve(format: WriteOutputFormat): WriteOutputExtension {
    return format === "json" ? "json" : "md";
}

async function outputWriteWithUniqueName(
    sandbox: ToolExecutionContext["sandbox"],
    input: { name: string; extension: WriteOutputExtension; content: string }
): Promise<{ path: string; bytes: number }> {
    const now = Date.now();
    const collisions = new Set<string>();

    for (let attempt = 0; attempt <= WRITE_OUTPUT_MAX_SUFFIX; attempt += 1) {
        const fileName = writeOutputFileNameResolve(
            input.name,
            collisions,
            input.extension,
            WRITE_OUTPUT_MAX_SUFFIX,
            now
        );
        const outputPath = `~/outputs/${fileName}`;
        try {
            const result = await sandbox.write({
                path: outputPath,
                content: input.content,
                exclusive: true
            });
            return { path: outputPath, bytes: result.bytes };
        } catch (error) {
            if (outputWriteCollisionErrorIs(error)) {
                collisions.add(fileName);
                continue;
            }
            throw error;
        }
    }

    throw new Error(
        `Could not resolve unique output name for "${input.name}" after ${WRITE_OUTPUT_MAX_SUFFIX} attempts.`
    );
}

function outputWriteCollisionErrorIs(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EEXIST";
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
