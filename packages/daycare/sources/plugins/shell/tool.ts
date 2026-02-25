import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract, ToolResultValue } from "@/types";
import {
    toolExecutionResultOutcomeWithTyped,
    toolMessageTextExtract
} from "../../engine/modules/tools/toolReturnOutcome.js";
import { stringTruncateTail } from "../../utils/stringTruncateTail.js";

const READ_MAX_LINES = 2000;
const READ_MAX_BYTES = 50 * 1024;
const MAX_EXEC_STREAM_OUTPUT_CHARS = 8_000;

const editItemSchema = Type.Object(
    {
        search: Type.String({ minLength: 1 }),
        replace: Type.String(),
        replaceAll: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const readSchema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        offset: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1 }))
    },
    { additionalProperties: false }
);

const writeSchema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        content: Type.String(),
        append: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const editSchema = Type.Object(
    {
        path: Type.String({ minLength: 1 }),
        edits: Type.Array(editItemSchema, { minItems: 1 })
    },
    { additionalProperties: false }
);

type ReadArgs = Static<typeof readSchema>;
type WriteArgs = Static<typeof writeSchema>;
type EditArgs = Static<typeof editSchema>;
type EditSpec = Static<typeof editItemSchema>;

const envSchema = Type.Record(
    Type.String({ minLength: 1 }),
    Type.Union([Type.String(), Type.Number(), Type.Boolean()])
);

const execSchema = Type.Object(
    {
        command: Type.String({ minLength: 1 }),
        cwd: Type.Optional(Type.String({ minLength: 1 })),
        timeoutMs: Type.Optional(Type.Number({ minimum: 100, maximum: 300_000 })),
        env: Type.Optional(envSchema),
        packageManagers: Type.Optional(
            Type.Array(
                Type.Union([
                    Type.Literal("dart"),
                    Type.Literal("dotnet"),
                    Type.Literal("go"),
                    Type.Literal("java"),
                    Type.Literal("node"),
                    Type.Literal("php"),
                    Type.Literal("python"),
                    Type.Literal("ruby"),
                    Type.Literal("rust")
                ]),
                { minItems: 1 }
            )
        ),
        allowedDomains: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }))
    },
    { additionalProperties: false }
);

type ExecArgs = Static<typeof execSchema>;

const shellResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        content: Type.Optional(Type.String()),
        path: Type.Optional(Type.String()),
        cwd: Type.Optional(Type.String()),
        bytes: Type.Optional(Type.Number()),
        size: Type.Optional(Type.Number()),
        count: Type.Optional(Type.Number()),
        exitCode: Type.Optional(Type.Number()),
        signal: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type ShellResult = Static<typeof shellResultSchema>;
const readJsonResultSchema = Type.Object(
    {
        summary: Type.String(),
        action: Type.String(),
        isError: Type.Boolean(),
        path: Type.String(),
        bytes: Type.Number(),
        value: Type.Any()
    },
    { additionalProperties: false }
);
type ReadJsonResult = {
    summary: string;
    action: string;
    isError: boolean;
    path: string;
    bytes: number;
    value: ToolResultValue;
};

const shellReturns: ToolResultContract<ShellResult> = {
    schema: shellResultSchema,
    toLLMText: (result) => result.summary
};
const readJsonReturns: ToolResultContract<ReadJsonResult> = {
    schema: readJsonResultSchema,
    toLLMText: (result) => result.summary
};

export function buildWorkspaceReadTool(): ToolDefinition {
    return {
        tool: {
            name: "read",
            description: `Read file contents (text or images). Supports relative and absolute paths and offset/limit pagination. Normal mode truncates text output at ${READ_MAX_LINES} lines or ${Math.floor(READ_MAX_BYTES / 1024)}KB (whichever comes first). Python execution mode returns unbounded text for the selected range.`,
            parameters: readSchema
        },
        returns: shellReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ReadArgs;
            const isPythonExecution = toolContext.pythonExecution === true;
            const readResult = await toolContext.sandbox.read({
                path: payload.path,
                offset: payload.offset,
                limit: payload.limit,
                raw: isPythonExecution
            });

            if (readResult.type === "image") {
                const text = `Read image file: ${readResult.displayPath} [${readResult.mimeType}]`;
                const toolMessage = buildToolMessage(toolCall, text, false, {
                    action: "read",
                    path: readResult.displayPath,
                    bytes: readResult.bytes,
                    mimeType: readResult.mimeType
                });
                toolMessage.content = [
                    { type: "text", text },
                    { type: "image", data: readResult.content.toString("base64"), mimeType: readResult.mimeType }
                ];
                return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "read"));
            }
            if (readResult.type !== "text") {
                throw new Error("Path is not a text or image file.");
            }

            const toolMessage = buildToolMessage(toolCall, readResult.content, false, {
                action: "read",
                path: readResult.displayPath,
                bytes: readResult.bytes,
                truncated: readResult.truncated,
                truncatedBy: readResult.truncatedBy,
                offset: payload.offset ?? null,
                limit: payload.limit ?? null
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "read"));
        }
    };
}

export function buildWorkspaceReadJsonTool(): ToolDefinition {
    return {
        tool: {
            name: "read_json",
            description:
                "Read and parse JSON from a file. Supports relative and absolute paths plus offset/limit pagination before parsing.",
            parameters: readSchema
        },
        returns: readJsonReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ReadArgs;
            const readResult = await toolContext.sandbox.read({
                path: payload.path,
                offset: payload.offset,
                limit: payload.limit,
                raw: true
            });
            if (readResult.type !== "text") {
                throw new Error("Path is not a text file.");
            }

            let value: unknown;
            try {
                value = JSON.parse(readResult.content);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Invalid JSON in ${readResult.displayPath}: ${message}`);
            }
            if (!jsonValueIs(value)) {
                throw new Error(`Invalid JSON in ${readResult.displayPath}: parsed value is unsupported.`);
            }

            const summary = `Read JSON from ${readResult.displayPath}.`;
            const toolMessage = buildToolMessage(toolCall, summary, false, {
                action: "read_json",
                path: readResult.displayPath,
                bytes: readResult.bytes
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                action: "read_json",
                isError: false,
                path: readResult.displayPath,
                bytes: readResult.bytes,
                value
            });
        }
    };
}

export function buildWorkspaceWriteTool(): ToolDefinition {
    return {
        tool: {
            name: "write",
            description:
                "Write UTF-8 text to a file within the agent workspace or an allowed write directory. Creates parent directories as needed. If append is true, appends to the file. Paths must be absolute and within the allowed write set.",
            parameters: writeSchema
        },
        returns: shellReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as WriteArgs;
            const writeResult = await toolContext.sandbox.write({
                path: payload.path,
                content: payload.content,
                append: payload.append ?? false
            });
            const text = `${payload.append ? "Appended" : "Wrote"} ${writeResult.bytes} bytes to ${writeResult.sandboxPath}.`;
            const toolMessage = buildToolMessage(toolCall, text, false, {
                action: "write",
                path: writeResult.sandboxPath,
                bytes: writeResult.bytes,
                append: payload.append ?? false
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "write"));
        }
    };
}

export function buildWorkspaceEditTool(): ToolDefinition {
    return {
        tool: {
            name: "edit",
            description:
                "Apply one or more find/replace edits to a file in the agent workspace or an allowed write directory. Edits are applied sequentially and must match at least once. Paths must be absolute and within the allowed write set.",
            parameters: editSchema
        },
        returns: shellReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as EditArgs;
            ensureAbsolutePath(payload.path);
            const readResult = await toolContext.sandbox.read({ path: payload.path, raw: true });
            if (readResult.type !== "text") {
                throw new Error("Path is not a text file.");
            }

            let updated = readResult.content;
            const counts: number[] = [];
            for (const edit of payload.edits) {
                const { next, count } = applyEdit(updated, edit);
                if (count === 0) {
                    const preview = edit.search.length > 80 ? `${edit.search.slice(0, 77)}...` : edit.search;
                    throw new Error(`Edit not applied: "${preview}" not found.`);
                }
                counts.push(count);
                updated = next;
            }

            await toolContext.sandbox.write({ path: payload.path, content: updated });
            const summary = counts
                .map((count, index) => `edit ${index + 1}: ${count} replacement${count === 1 ? "" : "s"}`)
                .join(", ");
            const text = `Updated ${readResult.displayPath} (${summary}).`;
            const toolMessage = buildToolMessage(toolCall, text, false, {
                action: "edit",
                path: readResult.displayPath,
                edits: counts
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "edit"));
        }
    };
}

export function buildExecTool(): ToolDefinition {
    return {
        tool: {
            name: "exec",
            description:
                "Execute a shell command inside the agent workspace (or a subdirectory). The cwd, if provided, must resolve inside the workspace. Exec uses the caller's granted write directories and global read access with a protected deny-list. Optional packageManagers language presets auto-allow ecosystem hosts (dart/dotnet/go/java/node/php/python/ruby/rust). Optional allowedDomains enables outbound access to specific domains (supports subdomain wildcards like *.example.com, no global wildcard). Returns stdout/stderr and failure details.",
            parameters: execSchema
        },
        returns: shellReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ExecArgs;
            const workingDir = toolContext.sandbox.workingDir;
            const result = await toolContext.sandbox.exec({
                command: payload.command,
                cwd: payload.cwd,
                timeoutMs: payload.timeoutMs,
                env: payload.env,
                packageManagers: payload.packageManagers,
                allowedDomains: payload.allowedDomains
            });
            const text = formatExecOutput(result.stdout, result.stderr, result.failed);
            const toolMessage = buildToolMessage(toolCall, text, result.failed, {
                cwd: path.relative(workingDir, result.cwd) || ".",
                exitCode: result.exitCode,
                signal: result.signal
            });
            return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "exec"));
        }
    };
}

function ensureAbsolutePath(target: string): void {
    if (!path.isAbsolute(target)) {
        throw new Error("Path must be absolute.");
    }
}

function applyEdit(input: string, edit: EditSpec): { next: string; count: number } {
    if (edit.replaceAll) {
        const parts = input.split(edit.search);
        const count = parts.length - 1;
        return {
            next: parts.join(edit.replace),
            count
        };
    }
    const index = input.indexOf(edit.search);
    if (index === -1) {
        return { next: input, count: 0 };
    }
    const next = input.slice(0, index) + edit.replace + input.slice(index + edit.search.length);
    return { next, count: 1 };
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

function shellResultBuild(toolMessage: ToolResultMessage, fallbackAction: string): ShellResult {
    const details = detailRecordGet(toolMessage.details);
    const pathValue = detailStringGet(details, "path");
    const cwd = detailStringGet(details, "cwd");
    const bytes = detailNumberGet(details, "bytes");
    const count = detailNumberGet(details, "count");
    const exitCode = detailNumberGet(details, "exitCode");
    const signal = detailStringGet(details, "signal");
    return {
        summary: toolMessageTextExtract(toolMessage),
        action: detailStringGet(details, "action") ?? fallbackAction,
        isError: Boolean(toolMessage.isError),
        ...(fallbackAction === "read" ? { content: toolMessageTextExtract(toolMessage) } : {}),
        ...(pathValue ? { path: pathValue } : {}),
        ...(cwd ? { cwd } : {}),
        ...(bytes !== undefined ? { bytes } : {}),
        ...(bytes !== undefined ? { size: bytes } : {}),
        ...(count !== undefined ? { count } : {}),
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(signal ? { signal } : {})
    };
}

function detailRecordGet(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function detailStringGet(details: Record<string, unknown>, key: string): string | undefined {
    const value = details[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function detailNumberGet(details: Record<string, unknown>, key: string): number | undefined {
    const value = details[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function jsonValueIs(value: unknown): value is ToolResultValue {
    if (value === null) {
        return true;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every((entry) => jsonValueIs(entry));
    }
    if (typeof value === "object") {
        return Object.values(value as Record<string, unknown>).every((entry) => jsonValueIs(entry));
    }
    return false;
}

export function formatExecOutput(stdout: string, stderr: string, failed: boolean): string {
    const parts: string[] = [];
    const stdoutPart = formatExecStream("stdout", stdout);
    if (stdoutPart) {
        parts.push(stdoutPart);
    }
    const stderrPart = formatExecStream("stderr", stderr);
    if (stderrPart) {
        parts.push(stderrPart);
    }
    if (parts.length === 0) {
        return failed ? "Command failed with no output." : "Command completed with no output.";
    }
    return parts.join("\n\n");
}

function formatExecStream(stream: "stdout" | "stderr", value: string): string | null {
    if (value.trim().length === 0) {
        return null;
    }
    const text = stringTruncateTail(value.trimEnd(), MAX_EXEC_STREAM_OUTPUT_CHARS, stream);
    return `${stream}:\n${text}`;
}
