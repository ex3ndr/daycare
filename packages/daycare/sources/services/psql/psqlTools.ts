import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract, ToolResultValue } from "@/types";
import { toolExecutionResultOutcomeWithTyped } from "../../engine/modules/tools/toolReturnOutcome.js";
import type { PsqlService } from "./PsqlService.js";

const psqlColumnSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        comment: Type.String({ minLength: 1 }),
        type: Type.Union([
            Type.Literal("text"),
            Type.Literal("integer"),
            Type.Literal("real"),
            Type.Literal("boolean"),
            Type.Literal("jsonb")
        ]),
        nullable: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const psqlDataOperationSchema = Type.Union([
    Type.Object(
        {
            op: Type.Literal("add"),
            table: Type.String({ minLength: 1 }),
            data: Type.Object({}, { additionalProperties: Type.Any() })
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            op: Type.Literal("update"),
            table: Type.String({ minLength: 1 }),
            id: Type.String({ minLength: 1 }),
            data: Type.Object({}, { additionalProperties: Type.Any() })
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            op: Type.Literal("delete"),
            table: Type.String({ minLength: 1 }),
            id: Type.String({ minLength: 1 })
        },
        { additionalProperties: false }
    )
]);

const createParametersSchema = Type.Object(
    {
        name: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type PsqlDbCreateArgs = Static<typeof createParametersSchema>;

const createResultSchema = Type.Object(
    {
        summary: Type.String(),
        database: Type.Object(
            {
                id: Type.String(),
                userId: Type.String(),
                name: Type.String(),
                createdAt: Type.Number()
            },
            { additionalProperties: false }
        )
    },
    { additionalProperties: false }
);

type PsqlDbCreateResult = Static<typeof createResultSchema>;

const createReturns: ToolResultContract<PsqlDbCreateResult> = {
    schema: createResultSchema,
    toLLMText: (result) => result.summary
};

const listParametersSchema = Type.Object({}, { additionalProperties: false });
type PsqlDbListArgs = Static<typeof listParametersSchema>;

const listResultSchema = Type.Object(
    {
        summary: Type.String(),
        databases: Type.Array(
            Type.Object(
                {
                    id: Type.String(),
                    userId: Type.String(),
                    name: Type.String(),
                    createdAt: Type.Number()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
);

type PsqlDbListResult = Static<typeof listResultSchema>;

const listReturns: ToolResultContract<PsqlDbListResult> = {
    schema: listResultSchema,
    toLLMText: (result) => result.summary
};

const schemaParametersSchema = Type.Object(
    {
        dbId: Type.String({ minLength: 1 }),
        table: Type.String({ minLength: 1 }),
        comment: Type.String({ minLength: 1 }),
        fields: Type.Array(psqlColumnSchema)
    },
    { additionalProperties: false }
);

type PsqlSchemaArgs = Static<typeof schemaParametersSchema>;

const schemaResultSchema = Type.Object(
    {
        summary: Type.String(),
        changes: Type.Number(),
        errors: Type.Array(Type.String())
    },
    { additionalProperties: false }
);

type PsqlSchemaResult = Static<typeof schemaResultSchema>;

const schemaReturns: ToolResultContract<PsqlSchemaResult> = {
    schema: schemaResultSchema,
    toLLMText: (result) => result.summary
};

const dataParametersSchema = Type.Object(
    {
        dbId: Type.String({ minLength: 1 }),
        op: psqlDataOperationSchema
    },
    { additionalProperties: false }
);

type PsqlDataArgs = Static<typeof dataParametersSchema>;

const dataResultSchema = Type.Object(
    {
        summary: Type.String(),
        row: Type.Any()
    },
    { additionalProperties: false }
);

type PsqlDataResult = Static<typeof dataResultSchema>;

const dataReturns: ToolResultContract<PsqlDataResult> = {
    schema: dataResultSchema,
    toLLMText: (result) => result.summary
};

const queryParametersSchema = Type.Object(
    {
        dbId: Type.String({ minLength: 1 }),
        sql: Type.String({ minLength: 1 }),
        params: Type.Optional(Type.Array(Type.Any()))
    },
    { additionalProperties: false }
);

type PsqlQueryArgs = Static<typeof queryParametersSchema>;

const queryResultSchema = Type.Object(
    {
        summary: Type.String(),
        rows: Type.Array(Type.Any())
    },
    { additionalProperties: false }
);

type PsqlQueryResult = Static<typeof queryResultSchema>;

const queryReturns: ToolResultContract<PsqlQueryResult> = {
    schema: queryResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds core psql tools backed by the psql service facade.
 * Expects: service is initialized once for the engine lifecycle.
 */
export function psqlToolsBuild(service: PsqlService): ToolDefinition[] {
    const createTool: ToolDefinition = {
        tool: {
            name: "psql_db_create",
            description: "Create a new user-scoped structured PostgreSQL (PGlite) database.",
            parameters: createParametersSchema
        },
        returns: createReturns,
        hiddenByDefault: true,
        execute: async (args, context, toolCall) => {
            const payload = args as PsqlDbCreateArgs;
            const database = await service.createDatabase(context.ctx, payload.name);
            const summary = `Created database ${database.name} (${database.id}).`;
            const toolMessage = toolMessageBuild(toolCall.id, toolCall.name, summary, false);
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                database
            });
        }
    };

    const listTool: ToolDefinition = {
        tool: {
            name: "psql_db_list",
            description: "List structured PostgreSQL (PGlite) databases available to the current user.",
            parameters: listParametersSchema
        },
        returns: listReturns,
        hiddenByDefault: true,
        execute: async (_args, context, toolCall) => {
            const payload = _args as PsqlDbListArgs;
            void payload;
            const databases = await service.listDatabases(context.ctx);
            const summary =
                databases.length === 0
                    ? "No databases found."
                    : `Found ${databases.length} database${databases.length === 1 ? "" : "s"}.`;
            const toolMessage = toolMessageBuild(toolCall.id, toolCall.name, summary, false);
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                databases
            });
        }
    };

    const schemaTool: ToolDefinition = {
        tool: {
            name: "psql_schema",
            description:
                "Apply additive schema declarations for a single table. The table comment and every field comment are required and must be non-empty.",
            parameters: schemaParametersSchema
        },
        returns: schemaReturns,
        hiddenByDefault: true,
        execute: async (args, context, toolCall) => {
            const payload = args as PsqlSchemaArgs;
            const result = await service.applySchema(context.ctx, payload.dbId, {
                table: payload.table,
                comment: payload.comment,
                fields: payload.fields
            });
            const isError = result.errors.length > 0;
            const summary = isError
                ? `Schema rejected: ${result.errors.join("; ")}`
                : `Schema applied with ${result.changes.length} change${result.changes.length === 1 ? "" : "s"}.`;
            const toolMessage = toolMessageBuild(toolCall.id, toolCall.name, summary, isError);
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                changes: result.changes.length,
                errors: result.errors
            });
        }
    };

    const dataTool: ToolDefinition = {
        tool: {
            name: "psql_data",
            description: "Execute structured add/update/delete operations with versioned row history.",
            parameters: dataParametersSchema
        },
        returns: dataReturns,
        hiddenByDefault: true,
        execute: async (args, context, toolCall) => {
            const payload = args as PsqlDataArgs;
            let row: unknown;
            if (payload.op.op === "add") {
                row = await service.add(context.ctx, payload.dbId, payload.op.table, payload.op.data);
            } else if (payload.op.op === "update") {
                row = await service.update(context.ctx, payload.dbId, payload.op.table, payload.op.id, payload.op.data);
            } else {
                row = await service.delete(context.ctx, payload.dbId, payload.op.table, payload.op.id);
            }

            const summary = `psql_data ${payload.op.op} completed for table ${payload.op.table}.`;
            const toolMessage = toolMessageBuild(toolCall.id, toolCall.name, summary, false);
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                row: row as unknown as ToolResultValue
            });
        }
    };

    const queryTool: ToolDefinition = {
        tool: {
            name: "psql_query",
            description: "Run read-only SQL queries against a structured database.",
            parameters: queryParametersSchema
        },
        returns: queryReturns,
        hiddenByDefault: true,
        execute: async (args, context, toolCall) => {
            const payload = args as PsqlQueryArgs;
            const rows = await service.query(context.ctx, payload.dbId, payload.sql, payload.params ?? []);
            const summary = `Query returned ${rows.length} row${rows.length === 1 ? "" : "s"}.`;
            const toolMessage = toolMessageBuild(toolCall.id, toolCall.name, summary, false);
            return toolExecutionResultOutcomeWithTyped(toolMessage, {
                summary,
                rows: rows as unknown as ToolResultValue
            });
        }
    };

    return [createTool, listTool, schemaTool, dataTool, queryTool];
}

function toolMessageBuild(toolCallId: string, toolName: string, text: string, isError: boolean): ToolResultMessage {
    return {
        role: "toolResult",
        toolCallId,
        toolName,
        content: [{ type: "text", text }],
        isError,
        timestamp: Date.now()
    };
}
