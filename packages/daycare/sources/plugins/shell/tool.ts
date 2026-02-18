import { Type, type Static } from "@sinclair/typebox";
import {
  toolExecutionResultOutcomeWithTyped,
  toolMessageTextExtract
} from "../../engine/modules/tools/toolReturnOutcome.js";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ExecException } from "node:child_process";

import type { ToolDefinition, ToolExecutionResult, ToolResultContract } from "@/types";
import type { SessionPermissions } from "@/types";
import { resolveWorkspacePath } from "../../engine/permissions.js";
import { sandboxAllowedDomainsResolve } from "../../sandbox/sandboxAllowedDomainsResolve.js";
import { sandboxAllowedDomainsValidate } from "../../sandbox/sandboxAllowedDomainsValidate.js";
import { sandboxCanRead } from "../../sandbox/sandboxCanRead.js";
import { sandboxCanWrite } from "../../sandbox/sandboxCanWrite.js";
import { runInSandbox } from "../../sandbox/runtime.js";
import { sandboxFilesystemPolicyBuild } from "../../sandbox/sandboxFilesystemPolicyBuild.js";
import { envNormalize } from "../../util/envNormalize.js";
import { permissionTagsApply } from "../../engine/permissions/permissionTagsApply.js";
import { permissionTagsNormalize } from "../../engine/permissions/permissionTagsNormalize.js";
import { permissionTagsValidate } from "../../engine/permissions/permissionTagsValidate.js";
import { resolveEngineSocketPath } from "../../engine/ipc/socket.js";
import {
  isWithinSecure,
  openSecure
} from "../../engine/permissions/pathResolveSecure.js";

const READ_MAX_LINES = 2000;
const READ_MAX_BYTES = 50 * 1024;
const MAX_EXEC_BUFFER = 1_000_000;
const DEFAULT_EXEC_TIMEOUT = 30_000;
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";

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
    home: Type.Optional(Type.String({ minLength: 1 })),
    permissions: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
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
    allowedDomains: Type.Optional(
      Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })
    )
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

const shellReturns: ToolResultContract<ShellResult> = {
  schema: shellResultSchema,
  toLLMText: (result) => result.summary
};

export function buildWorkspaceReadTool(): ToolDefinition {
  return {
    tool: {
      name: "read",
      description:
        `Read file contents (text or images). Supports relative and absolute paths, offset/limit pagination, and truncates text output at ${READ_MAX_LINES} lines or ${Math.floor(READ_MAX_BYTES / 1024)}KB (whichever comes first).`,
      parameters: readSchema
    },
    returns: shellReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as ReadArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Workspace is not configured.");
      }
      const targetPath = await resolveReadInputPath(payload.path, workingDir);
      const resolved = await resolveReadPathSecure(toolContext.permissions, targetPath);
      return handleReadSecure(
        resolved,
        payload.path,
        payload.offset,
        payload.limit,
        workingDir,
        toolCall
      );
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
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Workspace is not configured.");
      }
      ensureAbsolutePath(payload.path);
      const resolved = await resolveWritePathSecure(toolContext.permissions, payload.path);
      return handleWriteSecure(
        resolved,
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
        "Apply one or more find/replace edits to a file in the agent workspace or an allowed write directory. Edits are applied sequentially and must match at least once. Paths must be absolute and within the allowed write set.",
      parameters: editSchema
    },
    returns: shellReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as EditArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Workspace is not configured.");
      }
      ensureAbsolutePath(payload.path);
      const resolved = await resolveWritePathSecure(toolContext.permissions, payload.path);
      return handleEditSecure(resolved, payload.edits, workingDir, toolCall);
    }
  };
}

export function buildExecTool(): ToolDefinition {
  return {
    tool: {
      name: "exec",
      description:
        "Execute a shell command inside the agent workspace (or a subdirectory). The cwd, if provided, must be an absolute path that resolves inside the workspace. By default exec runs with no network, no events socket access, and no write grants. Reads are always allowed (except protected deny-list paths). Use explicit permission tags to re-enable caller-held network, events, or writable path access; @read tags are ignored. Writes are sandboxed to the allowed write directories. Optional home (absolute path within allowed write directories) remaps HOME and related env vars for sandboxed execution. Optional packageManagers language presets auto-allow ecosystem hosts (dart/dotnet/go/java/node/php/python/ruby/rust). Optional allowedDomains enables outbound access to specific domains (supports subdomain wildcards like *.example.com, no global wildcard). Returns stdout/stderr and failure details.",
      parameters: execSchema
    },
    returns: shellReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as ExecArgs;
      const workingDir = toolContext.permissions.workingDir;
      if (!workingDir) {
        throw new Error("Workspace is not configured.");
      }
      const permissions = await resolveExecPermissions(
        toolContext.permissions,
        payload.permissions
      );
      if (payload.cwd) {
        ensureAbsolutePath(payload.cwd);
      }
      if (payload.home) {
        ensureAbsolutePath(payload.home);
      }
      const cwd = payload.cwd
        ? resolveWorkspacePath(workingDir, payload.cwd)
        : workingDir;
      const home = payload.home
        ? await resolveWritePathSecure(permissions, payload.home)
        : undefined;
      const allowedDomains = sandboxAllowedDomainsResolve(
        payload.allowedDomains,
        payload.packageManagers
      );
      const domainIssues = sandboxAllowedDomainsValidate(
        allowedDomains,
        permissions.network
      );
      if (domainIssues.length > 0) {
        throw new Error(domainIssues.join(" "));
      }
      const envOverrides = envNormalize(payload.env);
      const env = envOverrides ? { ...process.env, ...envOverrides } : process.env;
      const timeout = payload.timeoutMs ?? DEFAULT_EXEC_TIMEOUT;
      const socketPath = resolveEngineSocketPath(toolContext.agentSystem.config.current.socketPath);
      const sandboxConfig = buildSandboxConfig(permissions, allowedDomains, socketPath);

      try {
        const result = await runInSandbox(payload.command, sandboxConfig, {
          cwd,
          env,
          home,
          timeoutMs: timeout,
          maxBufferBytes: MAX_EXEC_BUFFER
        });
        const stdout = toText(result.stdout);
        const stderr = toText(result.stderr);

        const text = formatExecOutput(stdout, stderr, false);
        const toolMessage = buildToolMessage(toolCall, text, false, {
          cwd: path.relative(workingDir, cwd) || "."
        });
        return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "exec"));
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
        return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "exec"));
      }
    }
  };
}

/**
 * Secure read handler that uses lstat + openSecure to prevent TOCTOU attacks.
 * The path has already been securely resolved (symlinks followed, containment verified).
 */
async function handleReadSecure(
  resolvedPath: string,
  requestedPath: string,
  offset: number | undefined,
  limit: number | undefined,
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<ToolExecutionResult> {
  // Use lstat to check file type without following symlinks
  const stats = await fs.lstat(resolvedPath);
  if (stats.isSymbolicLink()) {
    throw new Error("Cannot read symbolic link directly.");
  }
  if (!stats.isFile()) {
    throw new Error("Path is not a file.");
  }

  const displayPath = formatDisplayPath(workingDir, resolvedPath);
  const mimeType = await detectSupportedImageMimeTypeFromFile(resolvedPath);

  if (mimeType) {
    const imageBuffer = await readBinaryFileSecure(resolvedPath);
    const text = `Read image file: ${displayPath} [${mimeType}]`;
    const toolMessage = buildToolMessage(toolCall, text, false, {
      action: "read",
      path: displayPath,
      bytes: stats.size,
      mimeType
    });
    toolMessage.content = [
      { type: "text", text },
      { type: "image", data: imageBuffer.toString("base64"), mimeType }
    ];
    return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "read"));
  }

  const textContent = await readTextFileSecure(resolvedPath);
  const allLines = textContent.split("\n");
  const totalFileLines = allLines.length;
  const startLine = offset ? Math.max(0, offset - 1) : 0;
  const startLineDisplay = startLine + 1;
  if (startLine >= allLines.length) {
    throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
  }

  let selectedContent: string;
  let userLimitedLines: number | undefined;
  if (limit !== undefined) {
    const endLine = Math.min(startLine + limit, allLines.length);
    selectedContent = allLines.slice(startLine, endLine).join("\n");
    userLimitedLines = endLine - startLine;
  } else {
    selectedContent = allLines.slice(startLine).join("\n");
  }

  const truncation = truncateHead(selectedContent);
  let outputText: string;
  if (truncation.firstLineExceedsLimit) {
    const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine] ?? "", "utf8"));
    outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(READ_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${requestedPath} | head -c ${READ_MAX_BYTES}]`;
  } else if (truncation.truncated) {
    const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
    const nextOffset = endLineDisplay + 1;
    outputText = truncation.content;
    if (truncation.truncatedBy === "lines") {
      outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
    } else {
      outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(READ_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
    }
  } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
    const remaining = allLines.length - (startLine + userLimitedLines);
    const nextOffset = startLine + userLimitedLines + 1;
    outputText = `${truncation.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
  } else {
    outputText = truncation.content;
  }

  const toolMessage = buildToolMessage(toolCall, outputText, false, {
    action: "read",
    path: displayPath,
    bytes: stats.size,
    truncated: truncation.truncated,
    truncatedBy: truncation.truncatedBy,
    offset: offset ?? null,
    limit: limit ?? null
  });
  return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "read"));
}

/**
 * Secure write handler that prevents TOCTOU attacks.
 * The path has already been securely resolved (symlinks followed, containment verified).
 */
async function handleWriteSecure(
  resolvedPath: string,
  content: string,
  append: boolean,
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<ToolExecutionResult> {
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

  // Check if target is a symlink before writing
  try {
    const stats = await fs.lstat(resolvedPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Cannot write to symbolic link.");
    }
  } catch (error) {
    // File doesn't exist yet - OK for write operations
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Use atomic file operations via file handle
  const flags = append ? "a" : "w";
  const handle = await fs.open(resolvedPath, flags);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }

  const bytes = Buffer.byteLength(content, "utf8");
  const displayPath = formatDisplayPath(workingDir, resolvedPath);
  const text = `${append ? "Appended" : "Wrote"} ${bytes} bytes to ${displayPath}.`;
  const toolMessage = buildToolMessage(toolCall, text, false, {
    action: "write",
    path: displayPath,
    bytes,
    append
  });
  return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "write"));
}

/**
 * Secure edit handler that prevents TOCTOU attacks.
 * Uses file handle to ensure atomic read-modify-write operations.
 */
async function handleEditSecure(
  resolvedPath: string,
  edits: EditSpec[],
  workingDir: string,
  toolCall: { id: string; name: string }
): Promise<ToolExecutionResult> {
  // Check if target is a symlink
  const stats = await fs.lstat(resolvedPath);
  if (stats.isSymbolicLink()) {
    throw new Error("Cannot edit symbolic link.");
  }

  // Open with r+ for read-modify-write atomicity
  const handle = await fs.open(resolvedPath, "r+");
  try {
    const original = await handle.readFile("utf8");
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

    // Truncate and write from beginning
    await handle.truncate(0);
    await handle.write(updated, 0, "utf8");

    const displayPath = formatDisplayPath(workingDir, resolvedPath);
    const summary = counts
      .map((count, index) => `edit ${index + 1}: ${count} replacement${count === 1 ? "" : "s"}`)
      .join(", ");
    const text = `Updated ${displayPath} (${summary}).`;
    const toolMessage = buildToolMessage(toolCall, text, false, {
      action: "edit",
      path: displayPath,
      edits: counts
    });
    return toolExecutionResultOutcomeWithTyped(toolMessage, shellResultBuild(toolMessage, "edit"));
  } finally {
    await handle.close();
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

type TruncationResult = {
  content: string;
  truncated: boolean;
  truncatedBy: "lines" | "bytes" | null;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  lastLinePartial: boolean;
  firstLineExceedsLimit: boolean;
};

async function readTextFileSecure(resolvedPath: string): Promise<string> {
  const handle = await openSecure(resolvedPath, "r");
  try {
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

async function readBinaryFileSecure(resolvedPath: string): Promise<Buffer> {
  const handle = await openSecure(resolvedPath, "r");
  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function detectSupportedImageMimeTypeFromFile(resolvedPath: string): Promise<string | null> {
  const handle = await openSecure(resolvedPath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead === 0) {
      return null;
    }
    return detectSupportedImageMimeTypeFromHeader(header.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

function detectSupportedImageMimeTypeFromHeader(header: Buffer): string | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "image/png";
  }
  if (header.length >= 6) {
    const signature = header.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function truncateHead(content: string): TruncationResult {
  const totalBytes = Buffer.byteLength(content, "utf8");
  const lines = content.split("\n");
  const totalLines = lines.length;

  if (totalLines <= READ_MAX_LINES && totalBytes <= READ_MAX_BYTES) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false
    };
  }

  const firstLineBytes = Buffer.byteLength(lines[0] ?? "", "utf8");
  if (firstLineBytes > READ_MAX_BYTES) {
    return {
      content: "",
      truncated: true,
      truncatedBy: "bytes",
      totalLines,
      totalBytes,
      outputLines: 0,
      outputBytes: 0,
      lastLinePartial: false,
      firstLineExceedsLimit: true
    };
  }

  const outputLines: string[] = [];
  let outputBytes = 0;
  let truncatedBy: "lines" | "bytes" = "lines";
  for (let index = 0; index < lines.length && index < READ_MAX_LINES; index++) {
    const line = lines[index] ?? "";
    const lineBytes = Buffer.byteLength(line, "utf8") + (index > 0 ? 1 : 0);
    if (outputBytes + lineBytes > READ_MAX_BYTES) {
      truncatedBy = "bytes";
      break;
    }
    outputLines.push(line);
    outputBytes += lineBytes;
  }
  if (outputLines.length >= READ_MAX_LINES && outputBytes <= READ_MAX_BYTES) {
    truncatedBy = "lines";
  }

  const outputContent = outputLines.join("\n");
  return {
    content: outputContent,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: outputLines.length,
    outputBytes: Buffer.byteLength(outputContent, "utf8"),
    lastLinePartial: false,
    firstLineExceedsLimit: false
  };
}

function normalizeReadPathUnicodeSpaces(value: string): string {
  return value.replace(UNICODE_SPACES, " ");
}

function normalizeReadPathAtPrefix(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function normalizeReadPathInput(rawPath: string): string {
  const normalized = normalizeReadPathUnicodeSpaces(normalizeReadPathAtPrefix(rawPath));
  if (normalized === "~") {
    return os.homedir();
  }
  if (normalized.startsWith("~/")) {
    return os.homedir() + normalized.slice(1);
  }
  return normalized;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function readPathTryMacOSScreenshotVariant(target: string): string {
  return target.replace(/ (AM|PM)\./g, `${NARROW_NO_BREAK_SPACE}$1.`);
}

function readPathTryNfdVariant(target: string): string {
  return target.normalize("NFD");
}

function readPathTryCurlyQuoteVariant(target: string): string {
  return target.replace(/'/g, "\u2019");
}

/**
 * Resolves a read path with compatibility fallbacks for common macOS screenshot naming variants.
 */
async function resolveReadInputPath(rawPath: string, workingDir: string): Promise<string> {
  const normalized = normalizeReadPathInput(rawPath);
  const resolved = path.isAbsolute(normalized) ? normalized : path.resolve(workingDir, normalized);
  if (await pathExists(resolved)) {
    return resolved;
  }
  const amPmVariant = readPathTryMacOSScreenshotVariant(resolved);
  if (amPmVariant !== resolved && (await pathExists(amPmVariant))) {
    return amPmVariant;
  }
  const nfdVariant = readPathTryNfdVariant(resolved);
  if (nfdVariant !== resolved && (await pathExists(nfdVariant))) {
    return nfdVariant;
  }
  const curlyVariant = readPathTryCurlyQuoteVariant(resolved);
  if (curlyVariant !== resolved && (await pathExists(curlyVariant))) {
    return curlyVariant;
  }
  const nfdCurlyVariant = readPathTryCurlyQuoteVariant(nfdVariant);
  if (nfdCurlyVariant !== resolved && (await pathExists(nfdCurlyVariant))) {
    return nfdCurlyVariant;
  }
  return resolved;
}

function ensureAbsolutePath(target: string): void {
  if (!path.isAbsolute(target)) {
    throw new Error("Path must be absolute.");
  }
}

async function resolveWritePathSecure(
  permissions: SessionPermissions,
  target: string
): Promise<string> {
  return sandboxCanWrite(permissions, target);
}

async function resolveReadPathSecure(
  permissions: SessionPermissions,
  target: string
): Promise<string> {
  return sandboxCanRead(permissions, target);
}

function formatDisplayPath(workingDir: string, target: string): string {
  if (isWithinSecure(workingDir, target)) {
    return path.relative(workingDir, target) || ".";
  }
  return target;
}

function buildSandboxConfig(
  permissions: SessionPermissions,
  allowedDomains: string[],
  socketPath: string
) {
  const filesystem = sandboxFilesystemPolicyBuild({ permissions });
  return {
    filesystem,
    network: {
      allowedDomains,
      deniedDomains: []
    },
    ...(permissions.events ? { allowUnixSockets: [socketPath] } : {}),
    enableWeakerNestedSandbox: true
  };
}

async function resolveExecPermissions(
  currentPermissions: SessionPermissions,
  requestedTags: string[] | undefined
): Promise<SessionPermissions> {
  const execPermissions: SessionPermissions = {
    workingDir: currentPermissions.workingDir,
    writeDirs: [],
    readDirs: [],
    network: false,
    events: false
  };
  if (!requestedTags || requestedTags.length === 0) {
    return execPermissions;
  }
  const permissionTags = permissionTagsNormalize(requestedTags);
  const nonReadTags = permissionTags.filter((tag) => !tag.startsWith("@read:"));
  await permissionTagsValidate(currentPermissions, nonReadTags);
  permissionTagsApply(execPermissions, nonReadTags);
  execPermissions.readDirs = [];
  return execPermissions;
}
