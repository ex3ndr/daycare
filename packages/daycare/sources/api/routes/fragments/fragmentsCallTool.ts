import type { Context } from "@/types";
import type { DocumentsRepository } from "../../../storage/documentsRepository.js";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import type { PsqlService } from "../../../services/psql/PsqlService.js";
import { todoTreeFormat } from "../../../utils/todoTreeFormat.js";
import {
    fragmentToolAllowed,
    fragmentToolAllowlistDescribe
} from "../../../fragments/fragmentToolAllowlist.js";

export type FragmentsCallToolInput = {
    ctx: Context;
    fragmentId: string;
    tool: string;
    args: Record<string, unknown>;
    fragments: FragmentsRepository;
    services: FragmentToolServices;
};

/**
 * Services available for fragment tool execution.
 * These are service-level implementations, not the full agent tool executor.
 */
export type FragmentToolServices = {
    psql: PsqlService | null;
    todos: TodosRepository | null;
    documents: DocumentsRepository | null;
};

export type FragmentsCallToolResult =
    | { ok: true; result: unknown }
    | { ok: false; error: string };

/**
 * Executes a scoped tool call on behalf of a mini app fragment.
 * Validates fragment ownership and tool allowlist before execution.
 * Uses service-level implementations for read-only operations.
 *
 * Expects:
 * - fragmentId is a valid fragment id belonging to the user
 * - tool is the name of the tool to call
 * - args is the arguments object for the tool
 */
export async function fragmentsCallTool(input: FragmentsCallToolInput): Promise<FragmentsCallToolResult> {
    const { ctx, fragmentId, tool, args, fragments, services } = input;

    // Validate fragment id
    const id = fragmentId.trim();
    if (!id) {
        return { ok: false, error: "fragmentId is required." };
    }

    // Validate tool name
    const toolName = tool.trim();
    if (!toolName) {
        return { ok: false, error: "tool is required." };
    }

    // Check tool allowlist
    if (!fragmentToolAllowed(toolName)) {
        return {
            ok: false,
            error: `Tool "${toolName}" is not allowed for fragments. Allowed tools: ${fragmentToolAllowlistDescribe()}`
        };
    }

    // Verify fragment exists and belongs to user
    const fragment = await fragments.findAnyById(ctx, id);
    if (!fragment) {
        return { ok: false, error: "Fragment not found." };
    }

    // Execute the tool using service-level implementations
    try {
        const result = await fragmentToolExecute(ctx, toolName, args, services);
        return { ok: true, result };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed.";
        return { ok: false, error: message };
    }
}

/**
 * Executes a tool using service-level implementations.
 * This bypasses the full ToolResolver/ToolExecutionContext for simplicity.
 */
async function fragmentToolExecute(
    ctx: Context,
    toolName: string,
    args: Record<string, unknown>,
    services: FragmentToolServices
): Promise<unknown> {
    switch (toolName) {
        case "psql_query": {
            if (!services.psql) {
                throw new Error("PSQL service is unavailable.");
            }
            const dbId = stringArg(args, "dbId");
            const sql = stringArg(args, "sql");
            const params = arrayArg(args, "params");
            const rows = await services.psql.query(ctx, dbId, sql, params);
            return { rows };
        }

        case "psql_db_list": {
            if (!services.psql) {
                throw new Error("PSQL service is unavailable.");
            }
            const databases = await services.psql.listDatabases(ctx);
            return { databases };
        }

        case "todo_list": {
            if (!services.todos) {
                throw new Error("Todos service is unavailable.");
            }
            const rootId = optionalStringArg(args, "rootId");
            const depth = optionalNumberArg(args, "depth");
            const todos = await services.todos.findTree(ctx, rootId, depth);
            const summary = todoTreeFormat(todos);
            return { summary, todoCount: todos.length };
        }

        case "document_read": {
            if (!services.documents) {
                throw new Error("Documents service is unavailable.");
            }
            const documentId = optionalStringArg(args, "documentId");
            const path = optionalStringArg(args, "path");

            if (!documentId && !path) {
                // List root documents
                const docs = await services.documents.findRoots(ctx);
                return {
                    found: true,
                    documents: docs.map((d) => ({
                        id: d.id,
                        slug: d.slug,
                        title: d.title,
                        description: d.description
                    }))
                };
            }

            let doc;
            if (documentId) {
                doc = await services.documents.findById(ctx, documentId);
            } else if (path) {
                // Parse doc:// path
                const docPath = path.startsWith("doc://") ? path.slice(6) : path;
                doc = await services.documents.findBySlugPath(ctx, docPath);
            }

            if (!doc) {
                return { found: false };
            }

            return {
                found: true,
                document: {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description,
                    body: doc.body,
                    version: doc.version
                }
            };
        }

        case "json_parse": {
            const text = stringArg(args, "text");
            return { value: JSON.parse(text) };
        }

        case "json_stringify": {
            const value = args.value;
            const pretty = booleanArg(args, "pretty");
            return { value: JSON.stringify(value, null, pretty ? 2 : undefined) };
        }

        default:
            throw new Error(`Tool "${toolName}" is not implemented for fragments.`);
    }
}

function stringArg(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${key} is required and must be a non-empty string.`);
    }
    return value.trim();
}

function optionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`${key} must be a string when provided.`);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumberArg(args: Record<string, unknown>, key: string): number | undefined {
    const value = args[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${key} must be a number when provided.`);
    }
    return value;
}

function arrayArg(args: Record<string, unknown>, key: string): unknown[] {
    const value = args[key];
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error(`${key} must be an array when provided.`);
    }
    return value;
}

function booleanArg(args: Record<string, unknown>, key: string): boolean {
    const value = args[key];
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value !== "boolean") {
        throw new Error(`${key} must be a boolean when provided.`);
    }
    return value;
}
