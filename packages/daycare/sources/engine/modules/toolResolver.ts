import type { ToolCall, ToolResultMessage, Tool } from "@mariozechner/pi-ai";
import { validateToolCall } from "@mariozechner/pi-ai";
import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getLogger } from "../../log.js";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolResultContract,
  ToolResultPrimitive,
  ToolResultRow,
  ToolResultShallowObject
} from "@/types";
import { toolResultTruncate } from "./tools/toolResultTruncate.js";
import { RLM_TOOL_NAME } from "./rlm/rlmConstants.js";

type RegisteredTool = Omit<ToolDefinition, "returns"> & {
  pluginId: string;
  returns: ToolResultContract;
};

const DEFAULT_RETURN_PRIMITIVE_SCHEMA = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  Type.Null()
]);

const DEFAULT_RETURN_ROW_SCHEMA = Type.Object(
  {},
  { additionalProperties: DEFAULT_RETURN_PRIMITIVE_SCHEMA }
);

const DEFAULT_RETURN_SCHEMA = Type.Object(
  {},
  {
    additionalProperties: Type.Union([
      DEFAULT_RETURN_PRIMITIVE_SCHEMA,
      Type.Array(DEFAULT_RETURN_ROW_SCHEMA)
    ])
  }
);

const logger = getLogger("engine.modules");

export class ToolResolver {
  private tools = new Map<string, RegisteredTool>();

  register(pluginId: string, definition: ToolDefinition): void {
    const normalized = toolDefinitionNormalize(definition);
    logger.debug(`register: Registering tool pluginId=${pluginId} toolName=${definition.tool.name}`);
    this.tools.set(definition.tool.name, { ...normalized, pluginId });
    logger.debug(`register: Tool registered totalTools=${this.tools.size}`);
  }

  unregister(name: string): void {
    logger.debug(`unregister: Unregistering tool toolName=${name}`);
    this.tools.delete(name);
  }

  unregisterByPlugin(pluginId: string): void {
    logger.debug(`unregister: Unregistering tools by plugin pluginId=${pluginId}`);
    let count = 0;
    for (const [name, entry] of this.tools.entries()) {
      if (entry.pluginId === pluginId) {
        this.tools.delete(name);
        count++;
      }
    }
    logger.debug(`unregister: Tools unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const argsPreview = JSON.stringify(toolCall.arguments).slice(0, 100);
    logger.debug(`execute: execute() called toolName=${toolCall.name} toolCallId=${toolCall.id} argsPreview=${argsPreview}`);
    const entry = this.tools.get(toolCall.name);
    if (!entry) {
      const availableTools = Array.from(this.tools.keys()).join(",");
      logger.debug(`event: Tool not found toolName=${toolCall.name} availableTools=${availableTools}`);
      return {
        toolMessage: buildToolError(toolCall, `Unknown tool: ${toolCall.name}`)
      };
    }

    try {
      if (context.rlmToolOnly && toolCall.name !== RLM_TOOL_NAME) {
        throw new Error(`RLM mode only allows calling "${RLM_TOOL_NAME}".`);
      }
      logger.debug(`event: Validating tool call arguments toolName=${toolCall.name}`);
      const args = validateToolCall([entry.tool], toolCall);
      logger.debug(`execute: Arguments validated, executing tool toolName=${toolCall.name}`);
      const startTime = Date.now();
      const result = await entry.execute(args, context, toolCall);
      const duration = Date.now() - startTime;
      const typedResult = toolResultTypedResolve(result);
      if (!Value.Check(entry.returns.schema, typedResult)) {
        throw new Error(`Tool "${toolCall.name}" returned data that does not match its return schema.`);
      }
      if (!toolMessageHasText(result.toolMessage)) {
        const text = entry.returns.toLlmText(typedResult);
        if (text.trim().length > 0) {
          result.toolMessage.content = toolMessageAppendText(result.toolMessage, text);
        }
      }
      logger.debug(`event: Tool execution completed toolName=${toolCall.name} durationMs=${duration} isError=${result.toolMessage.isError}`);
      if (!result.toolMessage.toolCallId) {
        result.toolMessage.toolCallId = toolCall.id;
      }
      if (!result.toolMessage.toolName) {
        result.toolMessage.toolName = toolCall.name;
      }
      return toolResultTruncate({
        ...result,
        typedResult
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      logger.debug(`error: Tool execution threw error toolName=${toolCall.name} error=${String(error)}`);
      logger.warn({ tool: toolCall.name, error }, "error: Tool execution failed");
      return { toolMessage: buildToolError(toolCall, message) };
    }
  }
}

export type ToolResolverApi = Pick<ToolResolver, "listTools" | "execute">;

function buildToolError(toolCall: ToolCall, text: string): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError: true,
    timestamp: Date.now()
  };
}

function toolDefinitionNormalize(definition: ToolDefinition): Omit<ToolDefinition, "returns"> & {
  returns: ToolResultContract;
} {
  if (!definition.returns) {
    return {
      ...definition,
      returns: {
        schema: DEFAULT_RETURN_SCHEMA,
        toLlmText: (result) => {
          const text = result.text;
          return typeof text === "string" ? text : toolResultJsonStringify(result);
        }
      }
    };
  }
  toolResultSchemaValidate(definition.tool.name, definition.returns.schema);
  return {
    ...definition,
    returns: definition.returns
  };
}

function toolResultTypedResolve(result: ToolExecutionResult): ToolResultShallowObject {
  if (toolResultShallowObjectIs(result.typedResult)) {
    return result.typedResult;
  }
  if (toolResultShallowObjectIs(result.toolMessage.details)) {
    return result.toolMessage.details;
  }
  return {
    text: toolMessageTextExtract(result.toolMessage)
  };
}

function toolResultSchemaValidate(toolName: string, schema: TSchema): void {
  if (!schemaObjectIs(schema)) {
    throw new Error(`Tool "${toolName}" return schema must be a single-depth object schema.`);
  }
  const properties = schemaPropertyRecordGet(schema);
  for (const propertySchema of Object.values(properties)) {
    if (!toolResultPropertySchemaIs(propertySchema)) {
      throw new Error(
        `Tool "${toolName}" return schema supports primitive values and arrays of shallow objects only.`
      );
    }
  }
}

function toolResultPropertySchemaIs(schema: unknown): boolean {
  if (!schemaObjectIs(schema)) {
    return false;
  }
  if (schemaPrimitiveIs(schema)) {
    return true;
  }
  if (schema.type !== "array") {
    return false;
  }
  if (!schemaObjectIs(schema.items)) {
    return false;
  }
  if (schema.items.type !== "object") {
    return false;
  }
  const itemProperties = schemaPropertyRecordGet(schema.items);
  return Object.values(itemProperties).every((itemProperty) =>
    schemaObjectIs(itemProperty) && schemaPrimitiveIs(itemProperty)
  );
}

function schemaPrimitiveIs(schema: { type?: unknown }): boolean {
  return schema.type === "string"
    || schema.type === "number"
    || schema.type === "integer"
    || schema.type === "boolean"
    || schema.type === "null";
}

function schemaObjectIs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaPropertyRecordGet(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties;
  if (!schemaObjectIs(properties)) {
    return {};
  }
  return properties;
}

function toolResultShallowObjectIs(value: unknown): value is ToolResultShallowObject {
  if (!schemaObjectIs(value)) {
    return false;
  }
  return Object.values(value).every((entry) => toolResultValueIs(entry));
}

function toolResultValueIs(value: unknown): value is ToolResultPrimitive | ToolResultRow[] {
  if (toolResultPrimitiveIs(value)) {
    return true;
  }
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((row) => toolResultRowIs(row));
}

function toolResultRowIs(value: unknown): value is ToolResultRow {
  if (!schemaObjectIs(value)) {
    return false;
  }
  return Object.values(value).every((entry) => toolResultPrimitiveIs(entry));
}

function toolResultPrimitiveIs(value: unknown): value is ToolResultPrimitive {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean";
}

function toolMessageTextExtract(message: ToolResultMessage): string {
  const content = Array.isArray(message.content) ? message.content : [];
  const text = content
    .filter((part) => part?.type === "text" && "text" in part && typeof part.text === "string")
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
  if (text.length > 0) {
    return text;
  }
  return toolResultJsonStringify(content);
}

function toolMessageHasText(message: ToolResultMessage): boolean {
  const content = Array.isArray(message.content) ? message.content : [];
  return content.some(
    (part) => part?.type === "text" && "text" in part && typeof part.text === "string" && part.text.trim().length > 0
  );
}

function toolMessageAppendText(message: ToolResultMessage, text: string): ToolResultMessage["content"] {
  const content = Array.isArray(message.content) ? message.content : [];
  return [...content, { type: "text", text }];
}

function toolResultJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
