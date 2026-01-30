import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { exec as execCallback, type ExecException } from "node:child_process";
import { promisify } from "node:util";

import type { ToolDefinition } from "../../engine/tools/types.js";
import { resolveWorkspacePath } from "../../engine/permissions.js";

const exec = promisify(execCallback);

const MAX_READ_BYTES = 200_000;
const MAX_EXEC_BUFFER = 1_000_000;
const DEFAULT_EXEC_TIMEOUT = 30_000;

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
    path: Type.String({ minLength: 1 })
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

const execSchema = Type.Object(
  {
    command: Type.String({ minLength: 1 }),
    cwd: Type.Optional(Type.String({ minLength: 1 })),
    timeoutMs: Type.Optional(Type.Number({ minimum: 100, maximum: 300_000 })),
    env: Type.Optional(Type.Record(Type.String({ minLength: 1 }), Type.String()))
  },
  { additionalProperties: false }
);

type ExecArgs = Static<typeof execSchema>;

export function buildWorkspaceReadTool(): ToolDefinition {
  return {
    tool: {
      name: "read",
      description:
        "Read a UTF-8 text file from the session workspace. The path may be relative to the workspace or an absolute path that still resolves inside it. Access outside the workspace is rejected. Large files are truncated.",
      parameters: readSchema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as ReadArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Session workspace is not configured.");
      }
      return handleRead(payload.path, workingDir, toolCall);
    }
  };
}

export function buildWorkspaceWriteTool(): ToolDefinition {
  return {
    tool: {
      name: "write",
      description:
        "Write UTF-8 text to a file within the session workspace. Creates parent directories as needed. If append is true, appends to the file. Paths must stay inside the workspace.",
      parameters: writeSchema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as WriteArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Session workspace is not configured.");
      }
      return handleWrite(
        payload.path,
        payload.content,
        payload.append ?? false,
        workingDir,
        toolCall
      );
    }
  };
}

export function buildWorkspaceEditTool(): ToolDefinition {
  return {
    tool: {
      name: "edit",
      description:
        "Apply one or more find/replace edits to a file in the session workspace. Edits are applied sequentially and must match at least once. Paths must stay inside the workspace.",
      parameters: editSchema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as EditArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Session workspace is not configured.");
      }
      return handleEdit(payload.path, payload.edits, workingDir, toolCall);
    }
  };
}

export function buildExecTool(): ToolDefinition {
  return {
    tool: {
      name: "exec",
      description:
        "Execute a shell command inside the session workspace (or a subdirectory). The cwd must resolve inside the workspace. Returns stdout/stderr and failure details.",
      parameters: execSchema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as ExecArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Session workspace is not configured.");
      }
      const cwd = payload.cwd
        ? resolveWorkspacePath(workingDir, payload.cwd)
        : workingDir;
      const env = payload.env ? { ...process.env, ...payload.env } : process.env;
      const timeout = payload.timeoutMs ?? DEFAULT_EXEC_TIMEOUT;

      try {
        const result = await exec(payload.command, {
          cwd,
          env,
          timeout,
          maxBuffer: MAX_EXEC_BUFFER,
          encoding: "utf8"
        });
        const stdout = toText(result.stdout);
        const stderr = toText(result.stderr);

        const text = formatExecOutput(stdout, stderr, false);
        const toolMessage = buildToolMessage(toolCall, text, false, {
          cwd: path.relative(workingDir, cwd) || "."
        });
        return { toolMessage };
      } catch (error) {
        const execError = error as ExecException & {
          stdout?: string | Buffer;
          stderr?: string | Buffer;
          code?: number | string | null;
          signal?: NodeJS.Signals | null;
        };
        const stdout = toText(execError.stdout);
        const stderr = toText(execError.stderr);
        const text = formatExecOutput(stdout, stderr, true);
        const toolMessage = buildToolMessage(toolCall, text, true, {
          cwd: path.relative(workingDir, cwd) || ".",
          exitCode: execError.code ?? null,
          signal: execError.signal ?? null
        });
        return { toolMessage };
      }
    }
  };
}

async function handleRead(
  target: string,
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<{ toolMessage: ToolResultMessage }> {
  const resolved = resolveWorkspacePath(workingDir, target);
  const stats = await fs.stat(resolved);
  if (!stats.isFile()) {
    throw new Error("Path is not a file.");
  }

  let content = "";
  let truncated = false;
  if (stats.size > MAX_READ_BYTES) {
    const handle = await fs.open(resolved, "r");
    const buffer = Buffer.alloc(MAX_READ_BYTES);
    await handle.read(buffer, 0, MAX_READ_BYTES, 0);
    await handle.close();
    content = buffer.toString("utf8");
    truncated = true;
  } else {
    content = await fs.readFile(resolved, "utf8");
  }

  const displayPath = path.relative(workingDir, resolved) || ".";
  const suffix = truncated
    ? `\n[truncated to ${MAX_READ_BYTES} bytes from ${stats.size}]`
    : "";
  const text = `File: ${displayPath}\n${content}${suffix}`;

  const toolMessage = buildToolMessage(toolCall, text, false, {
    action: "read",
    path: displayPath,
    bytes: stats.size,
    truncated
  });

  return { toolMessage };
}

async function handleWrite(
  target: string,
  content: string,
  append: boolean,
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<{ toolMessage: ToolResultMessage }> {
  const resolved = resolveWorkspacePath(workingDir, target);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  if (append) {
    await fs.appendFile(resolved, content, "utf8");
  } else {
    await fs.writeFile(resolved, content, "utf8");
  }
  const bytes = Buffer.byteLength(content, "utf8");
  const displayPath = path.relative(workingDir, resolved) || ".";
  const text = `${append ? "Appended" : "Wrote"} ${bytes} bytes to ${displayPath}.`;
  const toolMessage = buildToolMessage(toolCall, text, false, {
    action: "write",
    path: displayPath,
    bytes,
    append
  });
  return { toolMessage };
}

async function handleEdit(
  target: string,
  edits: EditSpec[],
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<{ toolMessage: ToolResultMessage }> {
  const resolved = resolveWorkspacePath(workingDir, target);
  const original = await fs.readFile(resolved, "utf8");
  let updated = original;
  const counts: number[] = [];

  for (const edit of edits) {
    const { next, count } = applyEdit(updated, edit);
    if (count === 0) {
      const preview = edit.search.length > 80 ? `${edit.search.slice(0, 77)}...` : edit.search;
      throw new Error(`Edit not applied: "${preview}" not found.`);
    }
    counts.push(count);
    updated = next;
  }

  await fs.writeFile(resolved, updated, "utf8");
  const displayPath = path.relative(workingDir, resolved) || ".";
  const summary = counts
    .map((count, index) => `edit ${index + 1}: ${count} replacement${count === 1 ? "" : "s"}`)
    .join(", ");
  const text = `Updated ${displayPath} (${summary}).`;
  const toolMessage = buildToolMessage(toolCall, text, false, {
    action: "edit",
    path: displayPath,
    edits: counts
  });
  return { toolMessage };
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
  const next =
    input.slice(0, index) + edit.replace + input.slice(index + edit.search.length);
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

function toText(value: string | Buffer | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

function formatExecOutput(stdout: string, stderr: string, failed: boolean): string {
  const parts: string[] = [];
  if (stdout.trim().length > 0) {
    parts.push(`stdout:\n${stdout.trimEnd()}`);
  }
  if (stderr.trim().length > 0) {
    parts.push(`stderr:\n${stderr.trimEnd()}`);
  }
  if (parts.length === 0) {
    return failed ? "Command failed with no output." : "Command completed with no output.";
  }
  return parts.join("\n\n");
}
