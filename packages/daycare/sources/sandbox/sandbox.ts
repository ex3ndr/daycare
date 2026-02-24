import type { ExecException } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { resolveWorkspacePath } from "../engine/permissions.js";
import { getLogger } from "../log.js";
import { envNormalize } from "../util/envNormalize.js";
import { dockerRunInSandbox } from "./docker/dockerRunInSandbox.js";
import { isWithinSecure, openSecure } from "./pathResolveSecure.js";
import { runInSandbox } from "./runtime.js";
import { sandboxAllowedDomainsResolve } from "./sandboxAllowedDomainsResolve.js";
import { sandboxAllowedDomainsValidate } from "./sandboxAllowedDomainsValidate.js";
import { sandboxCanRead } from "./sandboxCanRead.js";
import { sandboxCanWrite } from "./sandboxCanWrite.js";
import { sandboxFilesystemPolicyBuild } from "./sandboxFilesystemPolicyBuild.js";
import { sandboxPathContainerToHost } from "./sandboxPathContainerToHost.js";
import type {
    SandboxConfig,
    SandboxDockerConfig,
    SandboxExecArgs,
    SandboxExecResult,
    SandboxReadArgs,
    SandboxReadResult,
    SandboxWriteArgs,
    SandboxWriteResult
} from "./sandboxTypes.js";

const logger = getLogger("sandbox");
const READ_MAX_LINES = 2000;
const READ_MAX_BYTES = 50 * 1024;
const DEFAULT_EXEC_TIMEOUT = 30_000;
const MAX_EXEC_BUFFER = 1_000_000;
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";

type TruncationResult = {
    content: string;
    truncated: boolean;
    truncatedBy: "lines" | "bytes" | null;
    totalLines: number;
    outputLines: number;
    firstLineExceedsLimit: boolean;
};

export class Sandbox {
    readonly homeDir: string;
    readonly workingDir: string;
    readonly permissions: SessionPermissions;
    readonly docker: SandboxDockerConfig | undefined;

    constructor(config: SandboxConfig) {
        this.homeDir = path.resolve(config.homeDir);
        this.workingDir = path.resolve(config.permissions.workingDir);
        this.permissions = config.permissions;
        this.docker = config.docker;
    }

    /**
     * Read from the host filesystem with sandbox read checks.
     * Expects: args.path is absolute or relative to workingDir.
     */
    async read(args: SandboxReadArgs): Promise<SandboxReadResult> {
        const permissions = this.permissionsEffectiveResolve();
        const targetPath = await this.readInputPathResolve(args.path);
        await pathRejectIfSymlink(targetPath, "Cannot read symbolic link directly.");
        const resolvedPath = await sandboxCanRead(permissions, targetPath);

        const stats = await fs.lstat(resolvedPath);
        if (stats.isSymbolicLink()) {
            throw new Error("Cannot read symbolic link directly.");
        }
        if (!stats.isFile()) {
            throw new Error("Path is not a file.");
        }

        const displayPath = sandboxDisplayPath(this.workingDir, resolvedPath);
        if (args.binary === true) {
            const binaryContent = await readBinaryFileSecure(resolvedPath);
            return {
                type: "binary",
                content: binaryContent,
                bytes: stats.size,
                resolvedPath,
                displayPath
            };
        }

        const mimeType = await detectSupportedImageMimeTypeFromFile(resolvedPath);
        if (mimeType) {
            const imageContent = await readBinaryFileSecure(resolvedPath);
            return {
                type: "image",
                content: imageContent,
                bytes: stats.size,
                mimeType,
                resolvedPath,
                displayPath
            };
        }

        const textContent = await readTextFileSecure(resolvedPath);
        const allLines = textContent.split("\n");
        const totalFileLines = allLines.length;
        const startLine = args.offset ? Math.max(0, args.offset - 1) : 0;
        if (startLine >= allLines.length) {
            throw new Error(`Offset ${args.offset} is beyond end of file (${allLines.length} lines total)`);
        }

        let selectedContent = allLines.slice(startLine).join("\n");
        let userLimitedLines: number | undefined;
        if (args.limit !== undefined) {
            const endLine = Math.min(startLine + args.limit, allLines.length);
            selectedContent = allLines.slice(startLine, endLine).join("\n");
            userLimitedLines = endLine - startLine;
        }

        if (args.raw === true) {
            return {
                type: "text",
                content: selectedContent,
                bytes: stats.size,
                totalLines: totalFileLines,
                outputLines: selectedContent.split("\n").length,
                truncated: false,
                truncatedBy: null,
                resolvedPath,
                displayPath
            };
        }

        const startLineDisplay = startLine + 1;
        const truncation = truncateHead(selectedContent);
        const outputText = sandboxReadOutputBuild({
            truncation,
            allLines,
            requestedPath: args.path,
            totalFileLines,
            startLine,
            startLineDisplay,
            userLimitedLines
        });

        return {
            type: "text",
            content: outputText,
            bytes: stats.size,
            totalLines: totalFileLines,
            outputLines: truncation.outputLines,
            truncated: truncation.truncated,
            truncatedBy: truncation.truncatedBy,
            resolvedPath,
            displayPath
        };
    }

    /**
     * Write UTF-8 content to host filesystem with sandbox write checks.
     * Expects: args.path is an absolute path.
     */
    async write(args: SandboxWriteArgs): Promise<SandboxWriteResult> {
        const permissions = this.permissionsEffectiveResolve();
        const targetPath = this.pathContainerToHost(args.path);
        sandboxPathAbsoluteEnsure(targetPath);
        await pathRejectIfSymlink(targetPath, "Cannot write to symbolic link.");
        const resolvedPath = await sandboxCanWrite(permissions, targetPath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

        try {
            const stats = await fs.lstat(resolvedPath);
            if (stats.isSymbolicLink()) {
                throw new Error("Cannot write to symbolic link.");
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }

        const handle = await fs.open(resolvedPath, args.append ? "a" : "w");
        try {
            await handle.writeFile(args.content);
        } finally {
            await handle.close();
        }

        return {
            bytes: Buffer.isBuffer(args.content) ? args.content.byteLength : Buffer.byteLength(args.content, "utf8"),
            resolvedPath,
            sandboxPath: sandboxHomePath(this.homeDir, resolvedPath)
        };
    }

    /**
     * Execute a shell command inside sandbox-runtime.
     * Expects: args.command is non-empty and network allowlist is explicit.
     */
    async exec(args: SandboxExecArgs): Promise<SandboxExecResult> {
        const permissions = this.permissionsEffectiveResolve();
        const cwd = sandboxExecCwdResolve(this.workingDir, args.cwd);
        const allowedDomains = sandboxAllowedDomainsResolve(args.allowedDomains, args.packageManagers);
        const domainIssues = sandboxAllowedDomainsValidate(allowedDomains);
        if (domainIssues.length > 0) {
            throw new Error(domainIssues.join(" "));
        }
        const envOverrides = envNormalize(args.env);
        const env = envOverrides ? { ...process.env, ...envOverrides } : process.env;
        const filesystem = sandboxFilesystemPolicyBuild({
            writeDirs: permissions.writeDirs,
            workingDir: permissions.workingDir,
            homeDir: this.homeDir
        });

        const useDocker = this.docker?.enabled === true;
        logger.debug(`exec: command=${JSON.stringify(args.command)} cwd=${cwd} docker=${useDocker}`);

        try {
            const runtimeConfig = {
                filesystem,
                network: {
                    allowedDomains,
                    deniedDomains: []
                },
                ...(this.docker?.enableWeakerNestedSandbox ? { enableWeakerNestedSandbox: true } : {})
            };
            const runtimeOptions = {
                cwd,
                env,
                home: this.homeDir,
                timeoutMs: args.timeoutMs ?? DEFAULT_EXEC_TIMEOUT,
                maxBufferBytes: MAX_EXEC_BUFFER
            };
            const result = useDocker
                ? await dockerRunInSandbox(args.command, runtimeConfig, {
                      ...runtimeOptions,
                      docker: {
                          image: this.docker!.image,
                          tag: this.docker!.tag,
                          socketPath: this.docker!.socketPath,
                          runtime: this.docker!.runtime,
                          readOnly: this.docker!.readOnly,
                          unconfinedSecurity: this.docker!.unconfinedSecurity,
                          capAdd: this.docker!.capAdd,
                          capDrop: this.docker!.capDrop,
                          userId: this.docker!.userId,
                          hostSkillsActiveDir: this.docker!.skillsActiveDir
                      }
                  })
                : await runInSandbox(args.command, runtimeConfig, runtimeOptions);
            return {
                stdout: sandboxText(result.stdout),
                stderr: sandboxText(result.stderr),
                exitCode: 0,
                signal: null,
                failed: false,
                cwd
            };
        } catch (error) {
            const execError = error as ExecException & {
                stdout?: string | Buffer;
                stderr?: string | Buffer;
                code?: number | string | null;
                signal?: NodeJS.Signals | null;
            };
            const exitCode = typeof execError.code === "number" ? execError.code : null;
            const stderr = sandboxText(execError.stderr);
            logger.warn(
                `exec: failed exitCode=${exitCode} signal=${execError.signal ?? "none"} error=${execError.message}` +
                    (stderr ? ` stderr=${stderr.slice(0, 500)}` : "")
            );
            return {
                stdout: sandboxText(execError.stdout),
                stderr,
                exitCode,
                signal: typeof execError.signal === "string" ? execError.signal : null,
                failed: true,
                cwd
            };
        }
    }

    private permissionsEffectiveResolve(): SessionPermissions {
        const readDirs = this.permissions.readDirs
            ? this.permissions.readDirs.map((entry) => path.resolve(entry))
            : undefined;
        return {
            workingDir: this.workingDir,
            writeDirs: Array.from(
                new Set([...this.permissions.writeDirs.map((entry) => path.resolve(entry)), this.homeDir])
            ),
            ...(readDirs ? { readDirs } : {})
        };
    }

    private async readInputPathResolve(rawPath: string): Promise<string> {
        const normalized = sandboxReadPathNormalize(rawPath, this.homeDir);
        const rewritten = this.pathContainerToHost(normalized);
        const resolved = path.isAbsolute(rewritten) ? rewritten : path.resolve(this.workingDir, rewritten);
        if (await pathExists(resolved)) {
            return resolved;
        }
        const amPmVariant = sandboxReadPathMacOSVariant(resolved);
        if (amPmVariant !== resolved && (await pathExists(amPmVariant))) {
            return amPmVariant;
        }
        const nfdVariant = resolved.normalize("NFD");
        if (nfdVariant !== resolved && (await pathExists(nfdVariant))) {
            return nfdVariant;
        }
        const curlyVariant = resolved.replace(/'/g, "\u2019");
        if (curlyVariant !== resolved && (await pathExists(curlyVariant))) {
            return curlyVariant;
        }
        const nfdCurlyVariant = nfdVariant.replace(/'/g, "\u2019");
        if (nfdCurlyVariant !== resolved && (await pathExists(nfdCurlyVariant))) {
            return nfdCurlyVariant;
        }
        return resolved;
    }

    private pathContainerToHost(targetPath: string): string {
        if (!this.docker?.enabled) {
            return targetPath;
        }
        return sandboxPathContainerToHost(this.homeDir, this.docker.userId, targetPath, this.docker.skillsActiveDir);
    }
}

function sandboxReadPathNormalize(rawPath: string, homeDir: string): string {
    const withoutAtPrefix = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
    const normalized = withoutAtPrefix.replace(UNICODE_SPACES, " ");
    if (normalized === "~") {
        return homeDir;
    }
    if (normalized.startsWith("~/")) {
        return homeDir + normalized.slice(1);
    }
    return normalized;
}

function sandboxReadPathMacOSVariant(target: string): string {
    return target.replace(/ (AM|PM)\./g, `${NARROW_NO_BREAK_SPACE}$1.`);
}

function sandboxReadOutputBuild(input: {
    truncation: TruncationResult;
    allLines: string[];
    requestedPath: string;
    totalFileLines: number;
    startLine: number;
    startLineDisplay: number;
    userLimitedLines?: number;
}): string {
    const { truncation, allLines, requestedPath, totalFileLines, startLine, startLineDisplay, userLimitedLines } =
        input;
    if (truncation.firstLineExceedsLimit) {
        const firstLineSize = sandboxSizeFormat(Buffer.byteLength(allLines[startLine] ?? "", "utf8"));
        return `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${sandboxSizeFormat(READ_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${requestedPath} | head -c ${READ_MAX_BYTES}]`;
    }
    if (truncation.truncated) {
        const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
        const nextOffset = endLineDisplay + 1;
        if (truncation.truncatedBy === "lines") {
            return `${truncation.content}\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
        }
        return `${truncation.content}\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${sandboxSizeFormat(READ_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
    }
    if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
        const remaining = allLines.length - (startLine + userLimitedLines);
        const nextOffset = startLine + userLimitedLines + 1;
        return `${truncation.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
    }
    return truncation.content;
}

function sandboxPathAbsoluteEnsure(target: string): void {
    if (!path.isAbsolute(target)) {
        throw new Error("Path must be absolute.");
    }
}

async function pathRejectIfSymlink(target: string, message: string): Promise<void> {
    try {
        const stats = await fs.lstat(target);
        if (stats.isSymbolicLink()) {
            throw new Error(message);
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }
}

function sandboxDisplayPath(workingDir: string, target: string): string {
    if (isWithinSecure(workingDir, target)) {
        return path.relative(workingDir, target) || ".";
    }
    return target;
}

function sandboxHomePath(homeDir: string, target: string): string {
    const homeVariants = sandboxMacPathVariants(homeDir);
    const targetVariants = sandboxMacPathVariants(target);
    for (const homeVariant of homeVariants) {
        for (const targetVariant of targetVariants) {
            if (!isWithinSecure(homeVariant, targetVariant)) {
                continue;
            }
            const relative = path.relative(homeVariant, targetVariant);
            if (relative.length === 0) {
                return "~";
            }
            return `~/${relative}`;
        }
    }
    return target;
}

function sandboxMacPathVariants(target: string): string[] {
    const resolved = path.resolve(target);
    if (resolved.startsWith("/private/")) {
        return [resolved, resolved.slice("/private".length)];
    }
    return [resolved, path.join("/private", resolved)];
}

function sandboxExecCwdResolve(workingDir: string, requestedCwd?: string): string {
    if (!requestedCwd) {
        return workingDir;
    }
    const candidate = path.isAbsolute(requestedCwd)
        ? path.resolve(requestedCwd)
        : path.resolve(workingDir, requestedCwd);
    return resolveWorkspacePath(workingDir, candidate);
}

function sandboxText(value: string | Buffer | undefined): string {
    if (!value) {
        return "";
    }
    return typeof value === "string" ? value : value.toString("utf8");
}

async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

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

function sandboxSizeFormat(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes}B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function truncateHead(content: string): TruncationResult {
    const lines = content.split("\n");
    const totalLines = lines.length;
    const totalBytes = Buffer.byteLength(content, "utf8");
    if (totalLines <= READ_MAX_LINES && totalBytes <= READ_MAX_BYTES) {
        return {
            content,
            truncated: false,
            truncatedBy: null,
            totalLines,
            outputLines: totalLines,
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
            outputLines: 0,
            firstLineExceedsLimit: true
        };
    }

    const outputLines: string[] = [];
    let outputBytes = 0;
    let truncatedBy: "lines" | "bytes" = "lines";
    for (let index = 0; index < lines.length && index < READ_MAX_LINES; index += 1) {
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
    return {
        content: outputLines.join("\n"),
        truncated: true,
        truncatedBy,
        totalLines,
        outputLines: outputLines.length,
        firstLineExceedsLimit: false
    };
}
