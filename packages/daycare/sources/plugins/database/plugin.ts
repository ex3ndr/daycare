import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import { z } from "zod";
import type { ToolResultContract } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";

const settingsSchema = z.object({}).passthrough();

const paramSchema = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]);

const querySchema = Type.Object(
    {
        sql: Type.String({ minLength: 1 }),
        params: Type.Optional(Type.Array(paramSchema)),
        description: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type QueryArgs = Static<typeof querySchema>;

const queryResultSchema = Type.Object(
    {
        summary: Type.String(),
        sqlType: Type.String(),
        rows: Type.Number(),
        affectedRows: Type.Number()
    },
    { additionalProperties: false }
);

type QueryResult = Static<typeof queryResultSchema>;

const queryReturns: ToolResultContract<QueryResult> = {
    schema: queryResultSchema,
    toLLMText: (result) => result.summary
};

const DB_TEMPLATE = `# Database Memory

This file describes the Postgres (PGlite) database used by the database plugin.

## Schema
<!-- schema:start -->
No tables yet.
<!-- schema:end -->

## Recent Changes
<!-- changes:start -->
- (none)
<!-- changes:end -->
`;

const SCHEMA_START = "<!-- schema:start -->";
const SCHEMA_END = "<!-- schema:end -->";
const CHANGES_START = "<!-- changes:start -->";
const CHANGES_END = "<!-- changes:end -->";

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        type UserDatabaseRuntime = {
            dbPath: string;
            docPath: string;
            db: PGlite | null;
        };

        const runtimeByUserId = new Map<string, UserDatabaseRuntime>();

        const runtimeForUser = (userId: string): UserDatabaseRuntime => {
            const normalizedUserId = userId.trim();
            if (!normalizedUserId) {
                throw new Error("db_sql requires a user-scoped context.");
            }
            const existing = runtimeByUserId.get(normalizedUserId);
            if (existing) {
                return existing;
            }
            // Use a filesystem-safe folder while preserving one database per logical user.
            const userDir = path.join(api.dataDir, "users", encodeURIComponent(normalizedUserId));
            const runtime: UserDatabaseRuntime = {
                dbPath: path.join(userDir, "db.pglite"),
                docPath: path.join(userDir, "db.md"),
                db: null
            };
            runtimeByUserId.set(normalizedUserId, runtime);
            return runtime;
        };

        const openDb = async (userId: string) => {
            const runtime = runtimeForUser(userId);
            if (!runtime.db) {
                await fs.mkdir(runtime.dbPath, { recursive: true });
                runtime.db = new PGlite(runtime.dbPath);
                await runtime.db.waitReady;
            }
            return runtime.db;
        };

        const ensureDocs = async (userId: string) => {
            const runtime = runtimeForUser(userId);
            await fs.mkdir(path.dirname(runtime.dbPath), { recursive: true });
            try {
                await fs.access(runtime.dbPath);
            } catch (error) {
                const code = (error as NodeJS.ErrnoException).code;
                if (code !== "ENOENT") {
                    throw error;
                }
                await openDb(userId);
            }

            try {
                await fs.access(runtime.docPath);
            } catch (error) {
                const code = (error as NodeJS.ErrnoException).code;
                if (code !== "ENOENT") {
                    throw error;
                }
                await fs.writeFile(runtime.docPath, DB_TEMPLATE, "utf8");
            }
        };

        const loadDoc = async (userId: string) => {
            const runtime = runtimeForUser(userId);
            try {
                const content = await fs.readFile(runtime.docPath, "utf8");
                return content.trim().length > 0 ? content : DB_TEMPLATE;
            } catch (error) {
                const code = (error as NodeJS.ErrnoException).code;
                if (code !== "ENOENT") {
                    throw error;
                }
                return DB_TEMPLATE;
            }
        };

        const updateDoc = async (userId: string, description?: string) => {
            const runtime = runtimeForUser(userId);
            const current = await loadDoc(userId);
            const schema = await renderSchema(await openDb(userId));
            let next = replaceSection(current, SCHEMA_START, SCHEMA_END, schema);
            if (description) {
                const summary = formatChangeSummary(description);
                next = appendChange(next, summary);
            } else {
                next = replaceSection(
                    next,
                    CHANGES_START,
                    CHANGES_END,
                    ensureChangeBody(readSection(next, CHANGES_START, CHANGES_END))
                );
            }
            await fs.writeFile(runtime.docPath, next, "utf8");
        };

        return {
            load: async () => {
                api.registrar.registerTool({
                    tool: {
                        name: "db_sql",
                        description:
                            "Execute SQL against the plugin Postgres (PGlite) database. Provide an optional description to document the change.",
                        parameters: querySchema
                    },
                    returns: queryReturns,
                    execute: async (args, context, toolCall) => {
                        const payload = args as QueryArgs;
                        const userId = context.ctx.userId;
                        await ensureDocs(userId);
                        const dbInstance = await openDb(userId);
                        const params = payload.params ?? [];
                        let text = "";
                        let details: Record<string, unknown> = {};
                        let rows = 0;
                        let affectedRows = 0;
                        let sqlType = "write";

                        if (isReadSql(payload.sql)) {
                            sqlType = "read";
                            const result = await dbInstance.query(payload.sql, params);
                            const rowList = result.rows ?? [];
                            rows = rowList.length;
                            text = rowList.length === 0 ? "No rows returned." : JSON.stringify(rowList, null, 2);
                            details = { rows: rowList.length };
                        } else {
                            const result = await dbInstance.query(payload.sql, params);
                            affectedRows = result.affectedRows ?? 0;
                            await updateDoc(userId, payload.description ?? summarizeSql(payload.sql));
                            text = `OK. affectedRows=${affectedRows}`;
                            details = {
                                affectedRows
                            };
                        }

                        const summary = text;
                        const toolMessage: ToolResultMessage = {
                            role: "toolResult",
                            toolCallId: toolCall.id,
                            toolName: toolCall.name,
                            content: [{ type: "text", text: summary }],
                            details,
                            isError: false,
                            timestamp: Date.now()
                        };

                        return {
                            toolMessage,
                            typedResult: {
                                summary,
                                sqlType,
                                rows,
                                affectedRows
                            }
                        };
                    }
                });
            },
            unload: async () => {
                api.registrar.unregisterTool("db_sql");
                for (const runtime of runtimeByUserId.values()) {
                    try {
                        await runtime.db?.close();
                    } catch {
                        // ignore close errors
                    }
                    runtime.db = null;
                }
                runtimeByUserId.clear();
            },
            systemPrompt: async (context) => {
                await ensureDocs(context.ctx.userId);
                const runtime = runtimeForUser(context.ctx.userId);
                const doc = await loadDoc(context.ctx.userId);
                return [
                    "Database plugin is active.",
                    `PGlite data directory: ${runtime.dbPath}`,
                    "The db.md file is a living description of the database.",
                    "When you create or modify schema, update db.md with a detailed explanation of tables, fields, types, and expectations.",
                    "",
                    doc
                ].join("\n");
            }
        };
    }
});

function replaceSection(content: string, start: string, end: string, body: string): string {
    if (!content.includes(start) || !content.includes(end)) {
        return `${content.trim()}\n\n${start}\n${body}\n${end}\n`;
    }
    const startIndex = content.indexOf(start) + start.length;
    const endIndex = content.indexOf(end);
    return `${content.slice(0, startIndex)}\n${body}\n${content.slice(endIndex)}`;
}

function readSection(content: string, start: string, end: string): string {
    if (!content.includes(start) || !content.includes(end)) {
        return "";
    }
    const startIndex = content.indexOf(start) + start.length;
    const endIndex = content.indexOf(end);
    return content.slice(startIndex, endIndex).trim();
}

function appendChange(content: string, entry: string): string {
    const existing = readSection(content, CHANGES_START, CHANGES_END);
    const lines = existing
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line !== "- (none)");
    lines.unshift(`- ${entry}`);
    const body = lines.length > 0 ? lines.join("\n") : "- (none)";
    return replaceSection(content, CHANGES_START, CHANGES_END, body);
}

function ensureChangeBody(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed === "- (none)") {
        return "- (none)";
    }
    return trimmed;
}

function formatChangeSummary(description: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `[${date}] ${description}`;
}

function summarizeSql(sql: string): string {
    const compact = sql.replace(/\s+/g, " ").trim();
    if (compact.length <= 120) {
        return compact;
    }
    return `${compact.slice(0, 117)}...`;
}

function isReadSql(sql: string): boolean {
    const normalized = sql.trim().toLowerCase();
    return (
        normalized.startsWith("select") ||
        normalized.startsWith("pragma") ||
        normalized.startsWith("with") ||
        normalized.startsWith("explain")
    );
}

async function renderSchema(db: PGlite): Promise<string> {
    const tablesResult = await db.query<{ table_name: string }>(
        `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `
    );
    const tables = tablesResult.rows ?? [];

    if (tables.length === 0) {
        return "No tables yet.";
    }

    const parts: string[] = [];
    for (const table of tables) {
        const tableName = table.table_name;
        const columnsResult = await db.query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
        }>(
            `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
      `,
            [tableName]
        );
        const columns = columnsResult.rows ?? [];
        const pkResult = await db.query<{ column_name: string }>(
            `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ORDER BY kcu.ordinal_position
      `,
            [tableName]
        );
        const pkColumns = new Set(pkResult.rows?.map((row) => row.column_name) ?? []);
        parts.push(`### ${tableName}`);
        if (columns.length === 0) {
            parts.push("- (no columns found)");
            parts.push("");
            continue;
        }
        for (const column of columns) {
            const flags: string[] = [];
            if (column.is_nullable === "NO") {
                flags.push("not null");
            }
            if (pkColumns.has(column.column_name)) {
                flags.push("primary key");
            }
            if (column.column_default !== null && column.column_default !== undefined) {
                flags.push(`default ${String(column.column_default)}`);
            }
            const detail = flags.length > 0 ? ` (${flags.join(", ")})` : "";
            parts.push(`- ${column.column_name}: ${column.data_type || "unknown"}${detail}`);
        }
        parts.push("");
    }
    return parts.join("\n").trim();
}
