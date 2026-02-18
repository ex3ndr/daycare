import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import path from "node:path";
import util from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ToolDefinition, ToolExecutionResult, ToolResultContract } from "@/types";
import { stringTruncate } from "../../utils/stringTruncate.js";

const MAX_OUTPUT_CHARS = 50_000;
const MONTY_PACKAGE = "@pydantic/monty";
const MONTY_INDEX_RELATIVE = path.join("node_modules", "@pydantic", "monty", "index.js");

const limitsSchema = Type.Object(
  {
    maxAllocations: Type.Optional(Type.Number({ minimum: 1 })),
    maxDurationSecs: Type.Optional(Type.Number({ minimum: 0.001, maximum: 300 })),
    maxMemory: Type.Optional(Type.Number({ minimum: 1024 })),
    gcInterval: Type.Optional(Type.Number({ minimum: 1 })),
    maxRecursionDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 10_000 }))
  },
  { additionalProperties: false }
);

const pythonSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    inputs: Type.Optional(Type.Record(Type.String({ minLength: 1 }), Type.Unknown())),
    scriptName: Type.Optional(Type.String({ minLength: 1 })),
    typeCheck: Type.Optional(Type.Boolean()),
    limits: Type.Optional(limitsSchema)
  },
  { additionalProperties: false }
);

type PythonArgs = Static<typeof pythonSchema>;
type MontyLimits = Static<typeof limitsSchema>;

type MontyRuntime = {
  Monty: {
    create: (...args: unknown[]) => unknown;
  };
  MontyException: new (...args: unknown[]) => object;
  MontyTypingError: new (...args: unknown[]) => object;
};

type MontyCreateOptions = {
  scriptName?: string;
  inputs?: string[];
  typeCheck?: boolean;
};

type MontyRunOptions = {
  inputs?: Record<string, unknown>;
  limits?: MontyLimits;
};

type MontyProgram = {
  run: (options?: MontyRunOptions | null) => unknown;
};

type MontyExceptionLike = {
  message?: string;
  display?: (format?: string | null) => string;
  exception?: {
    typeName?: string;
  };
};

type MontyTypingErrorLike = {
  message?: string;
  display?: (format?: string | null, color?: boolean | null) => string;
};

let cachedMontyRuntime: Promise<MontyRuntime> | null = null;

const pythonResultSchema = Type.Object(
  {
    summary: Type.String(),
    isError: Type.Boolean(),
    output: Type.String()
  },
  { additionalProperties: false }
);

type PythonResult = Static<typeof pythonResultSchema>;

const pythonReturns: ToolResultContract<PythonResult> = {
  schema: pythonResultSchema,
  toLLMText: (result) => result.summary
};

export function buildMontyPythonTool(name = "python"): ToolDefinition {
  return {
    tool: {
      name,
      description:
        "Run sandboxed Python code via @pydantic/monty. Supports optional inputs, type checking, and resource limits.",
      parameters: pythonSchema
    },
    returns: pythonReturns,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as PythonArgs;

      try {
        const runtime = await montyRuntimeLoad();
        const createResult = runtime.Monty.create(payload.code, {
          scriptName: payload.scriptName,
          inputs: payload.inputs ? Object.keys(payload.inputs) : undefined,
          typeCheck: payload.typeCheck ?? false
        });

        if (isMontyException(createResult, runtime)) {
          return buildResult(
            toolCall,
            formatMontyException(createResult, "Python parse failed."),
            true
          );
        }

        if (isMontyTypingError(createResult, runtime)) {
          return buildResult(
            toolCall,
            formatMontyTypingError(createResult),
            true
          );
        }

        if (!isMontyProgram(createResult)) {
          return buildResult(toolCall, "Python execution failed: invalid interpreter state.", true);
        }

        const runResult = createResult.run({
          inputs: payload.inputs,
          limits: payload.limits
        });

        if (isMontyException(runResult, runtime)) {
          return buildResult(
            toolCall,
            formatMontyException(runResult, "Python execution failed."),
            true
          );
        }

        const output = formatOutput(runResult);
        return buildResult(toolCall, `Python execution completed.\n\noutput:\n${output}`, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return buildResult(toolCall, `Python execution failed: ${message}`, true);
      }
    }
  };
}

function buildResult(
  toolCall: { id: string; name: string },
  text: string,
  isError: boolean
): ToolExecutionResult {
  const toolMessage: ToolResultMessage = {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError,
    timestamp: Date.now()
  };

  return {
    toolMessage,
    typedResult: {
      summary: text,
      isError,
      output: text
    }
  };
}

function formatMontyException(exception: MontyExceptionLike, fallback: string): string {
  const message = exception.message?.trim() || fallback;
  const typeName = exception.exception?.typeName?.trim();
  const header = typeName ? `${typeName}: ${message}` : message;

  if (typeof exception.display !== "function") {
    return header;
  }

  const details = exception.display("traceback").trim();
  if (!details || details === header) {
    return header;
  }

  return `${header}\n\n${details}`;
}

function formatMontyTypingError(error: MontyTypingErrorLike): string {
  const message = error.message?.trim() || "Python type check failed.";

  if (typeof error.display !== "function") {
    return message;
  }

  const details = error.display("concise", false).trim();
  if (!details || details === message) {
    return message;
  }

  return `Python type check failed.\n\n${details}`;
}

function formatOutput(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return stringTruncate(value, MAX_OUTPUT_CHARS);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (Buffer.isBuffer(value)) {
    return stringTruncate(value.toString("utf8"), MAX_OUTPUT_CHARS);
  }

  try {
    return stringTruncate(JSON.stringify(value, null, 2), MAX_OUTPUT_CHARS);
  } catch {
    const inspected = util.inspect(value, {
      depth: 5,
      maxArrayLength: 100,
      breakLength: 120
    });
    return stringTruncate(inspected, MAX_OUTPUT_CHARS);
  }
}

function isMontyProgram(value: unknown): value is MontyProgram {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("run" in value)) {
    return false;
  }
  return typeof (value as { run?: unknown }).run === "function";
}

function isMontyException(value: unknown, runtime: MontyRuntime): value is MontyExceptionLike {
  return value instanceof runtime.MontyException;
}

function isMontyTypingError(
  value: unknown,
  runtime: MontyRuntime
): value is MontyTypingErrorLike {
  return value instanceof runtime.MontyTypingError;
}

async function montyRuntimeLoad(): Promise<MontyRuntime> {
  if (!cachedMontyRuntime) {
    cachedMontyRuntime = montyRuntimeLoadUncached();
  }
  return cachedMontyRuntime;
}

async function montyRuntimeLoadUncached(): Promise<MontyRuntime> {
  const montyPath = await montyPathResolve();
  const imported = await import(pathToFileURL(montyPath).href);
  const exports = runtimeExportsResolve(imported);

  if (
    !isRuntimeExport(exports.Monty, "create") ||
    typeof exports.MontyException !== "function" ||
    typeof exports.MontyTypingError !== "function"
  ) {
    throw new Error(`Loaded ${MONTY_PACKAGE} but required exports were not found.`);
  }

  return {
    Monty: exports.Monty as MontyRuntime["Monty"],
    MontyException: exports.MontyException as MontyRuntime["MontyException"],
    MontyTypingError: exports.MontyTypingError as MontyRuntime["MontyTypingError"]
  };
}

async function montyPathResolve(): Promise<string> {
  // @pydantic/monty@0.0.3 exports a missing wrapper.js, so resolve index.js directly.
  let cursor = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(cursor, MONTY_INDEX_RELATIVE);
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  throw new Error(
    `${MONTY_PACKAGE} runtime was not found. Install dependencies with 'yarn install'.`
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isRuntimeExport(
  value: unknown,
  method: "create"
): value is { [key in typeof method]: (...args: unknown[]) => unknown } {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }
  return method in value && typeof (value as Record<string, unknown>)[method] === "function";
}

function runtimeExportsResolve(imported: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(imported.default)) {
    return {
      ...imported.default,
      ...imported
    };
  }
  return imported;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
