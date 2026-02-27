import { createRequire } from "node:module";

import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export type LogFormat = "pretty" | "json";
export type LogDestination = "stdout" | "stderr" | string;

export type LogConfig = {
    level: string;
    format: LogFormat;
    destination: LogDestination;
    redact: string[];
    service: string;
    environment: string;
};

const DEFAULT_REDACT = ["token", "password", "secret", "apiKey", "*.token", "*.password", "*.secret", "*.apiKey"];

const VALID_FORMATS = new Set<LogFormat>(["pretty", "json"]);
const nodeRequire = createRequire(import.meta.url);

let rootLogger: Logger | null = null;

const MODULE_WIDTH = 20;
const PLUGIN_MODULE_PREFIX = "plugin.";
const ANSI_RESET = "\u001b[0m";
const MODULE_COLORS = [
    196, 202, 208, 214, 220, 226, 190, 154, 118, 82, 48, 50, 51, 45, 39, 33, 27, 21, 57, 93, 129, 165, 201, 213, 177,
    141, 105, 69
] as const;
const PRETTY_RESERVED_FIELDS = new Set([
    "pid",
    "hostname",
    "level",
    "time",
    "timestamp",
    "__time",
    "__level",
    "lvl",
    "service",
    "environment",
    "module",
    "msg"
]);
const moduleColorCache = new Map<string, string>();

export function initLogging(overrides: Partial<LogConfig> = {}): Logger {
    if (rootLogger) {
        return rootLogger;
    }

    const config = resolveLogConfig(overrides);
    rootLogger = buildLogger(config);
    return rootLogger;
}

export function getLogger(moduleName?: string): Logger {
    const logger = rootLogger ?? initLogging();
    const resolvedModule = normalizeModule(moduleName);
    return logger.child({ module: resolvedModule });
}

export function resetLogging(): void {
    rootLogger = null;
}

export function resolveLogConfig(overrides: Partial<LogConfig> = {}): LogConfig {
    const isDev = process.env.NODE_ENV !== "production";
    const isUnitTest = isUnitTestRun();
    const level =
        overrides.level ??
        envValue("DAYCARE_LOG_LEVEL") ??
        envValue("LOG_LEVEL") ??
        (isUnitTest ? "silent" : isDev ? "debug" : "info");
    const destination =
        overrides.destination ??
        envValue("DAYCARE_LOG_DEST") ??
        envValue("LOG_DEST") ??
        (process.stdout.isTTY ? "stderr" : "stdout");
    const forceJson = parseBooleanFlag(envValue("DAYCARE_LOG_JSON")) ?? parseBooleanFlag(envValue("LOG_JSON")) ?? false;
    let format =
        overrides.format ??
        parseFormat(envValue("DAYCARE_LOG_FORMAT")) ??
        parseFormat(envValue("LOG_FORMAT")) ??
        (forceJson ? "json" : "pretty");
    const service = overrides.service ?? envValue("DAYCARE_LOG_SERVICE") ?? "daycare";
    const environment = overrides.environment ?? envValue("NODE_ENV") ?? "development";

    if (!isStdDestination(destination)) {
        format = "json";
    }

    const redact = overrides.redact ?? mergeRedactList(DEFAULT_REDACT, envValue("DAYCARE_LOG_REDACT"));

    return {
        level,
        format,
        destination,
        redact,
        service,
        environment
    };
}

function buildLogger(config: LogConfig): Logger {
    const options: LoggerOptions = {
        level: config.level,
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            service: config.service,
            environment: config.environment
        },
        redact: config.redact.length > 0 ? { paths: config.redact, censor: "[REDACTED]" } : undefined,
        errorKey: "error",
        serializers: {
            error: pino.stdSerializers.err
        }
    };

    const destination = resolveDestination(config.destination);

    if (config.format === "pretty") {
        const prettyFactory = resolvePrettyFactory();
        if (!prettyFactory) {
            return destination ? pino(options, destination) : pino(options);
        }
        const prettyStream = prettyFactory({
            colorize: true,
            translateTime: false,
            ignore: "pid,hostname,level,service,environment,module",
            hideObject: true,
            levelKey: "__level",
            timestampKey: "__time",
            messageFormat: formatPrettyMessage,
            singleLine: false,
            destination: config.destination === "stderr" ? 2 : 1
        }) as DestinationStream;
        return pino(options, prettyStream);
    }

    return destination ? pino(options, destination) : pino(options);
}

export function formatPrettyMessage(
    log: Record<string, unknown>,
    messageKey: string,
    _levelLabel: string,
    extra?: {
        colors?: {
            gray?: (value: string) => string;
            grey?: (value: string) => string;
            cyan?: (value: string) => string;
            yellow?: (value: string) => string;
        };
    }
): string {
    const colors = extra?.colors;
    const gray = colors?.gray ?? (colors as { grey?: (value: string) => string } | undefined)?.grey;
    const hasPrettyColors =
        typeof gray === "function" || typeof colors?.cyan === "function" || typeof colors?.yellow === "function";
    const colorTime = typeof gray === "function" ? gray : (value: string) => value;
    const level = resolveLogLevel(log);
    const colorMessage =
        level === 40 && typeof colors?.yellow === "function"
            ? colors.yellow
            : typeof colors?.cyan === "function"
              ? colors.cyan
              : (value: string) => value;
    const timeValue = log.time ?? log.timestamp ?? Date.now();
    const time = formatLogTime(timeValue);
    const rawModule = normalizeModule(typeof log.module === "string" ? log.module : undefined);
    const module = formatModuleLabel(rawModule);
    const moduleLabel =
        hasPrettyColors && shouldColorizeModule(rawModule) ? `${moduleColor(rawModule)}${module}${ANSI_RESET}` : module;
    const messageValue = log[messageKey];
    const message = messageValue === undefined || messageValue === null ? "" : String(messageValue);
    const details = formatPrettyDetails(log, messageKey, message);
    const timeLabel = colorTime(`[${time}]`);
    const content =
        message.length > 0
            ? `${moduleLabel} ${message}${details.length > 0 ? ` ${details}` : ""}`
            : `${moduleLabel}${details.length > 0 ? ` ${details}` : ""}`;
    return `${timeLabel} ${colorMessage(content)}`;
}

function resolveLogLevel(log: Record<string, unknown>): number | null {
    const candidates = [log.level, (log as Record<string, unknown>).__level, log.lvl];
    for (const raw of candidates) {
        if (typeof raw === "number") {
            return raw;
        }
        if (typeof raw === "string") {
            const normalized = raw.trim().toLowerCase();
            switch (normalized) {
                case "trace":
                    return 10;
                case "debug":
                    return 20;
                case "info":
                    return 30;
                case "warn":
                case "warning":
                    return 40;
                case "error":
                    return 50;
                case "fatal":
                    return 60;
                default: {
                    const parsed = Number(normalized);
                    if (Number.isFinite(parsed)) {
                        return parsed;
                    }
                }
            }
        }
    }
    return null;
}

function normalizeModule(moduleName?: string): string {
    if (typeof moduleName !== "string") {
        return "unknown";
    }
    const trimmed = moduleName.trim();
    return trimmed.length > 0 ? trimmed : "unknown";
}

function shouldColorizeModule(moduleName: string): boolean {
    if (process.env.NO_COLOR) {
        return false;
    }
    return moduleName.length > 0;
}

function moduleColor(moduleName: string): string {
    const cached = moduleColorCache.get(moduleName);
    if (cached) {
        return cached;
    }
    const hash = murmurHash3(moduleName);
    const colorCode = MODULE_COLORS[hash % MODULE_COLORS.length];
    const color = `\u001b[38;5;${colorCode}m`;
    moduleColorCache.set(moduleName, color);
    return color;
}

function murmurHash3(value: string, seed = 0): number {
    let hash = seed ^ value.length;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
        hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
        hash ^= hash >>> 16;
    }
    return hash >>> 0;
}

function formatModuleLabel(moduleValue: unknown): string {
    const rawModule = normalizeModule(typeof moduleValue === "string" ? moduleValue : undefined);
    const isPlugin = rawModule.startsWith(PLUGIN_MODULE_PREFIX);
    const baseName = isPlugin ? rawModule.slice(PLUGIN_MODULE_PREFIX.length) : rawModule;
    const normalized = normalizeModuleName(baseName);
    return isPlugin ? `(${normalized})` : `[${normalized}]`;
}

function formatPrettyDetails(log: Record<string, unknown>, messageKey: string, message: string): string {
    const details: string[] = [];
    for (const [key, value] of Object.entries(log)) {
        if (key === messageKey || PRETTY_RESERVED_FIELDS.has(key)) {
            continue;
        }
        if (value === undefined) {
            continue;
        }
        if (messageContainsKey(message, key)) {
            continue;
        }
        const formatted = formatPrettyDetailValue(key, value);
        if (!formatted) {
            continue;
        }
        details.push(`${key}=${formatted}`);
    }
    return details.join(" ");
}

function messageContainsKey(message: string, key: string): boolean {
    if (message.length === 0) {
        return false;
    }
    const pattern = new RegExp(`\\b${escapeRegExp(key)}=`);
    return pattern.test(message);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPrettyDetailValue(key: string, value: unknown): string | null {
    if (value === null) {
        return "null";
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (typeof value === "string") {
        return formatPrettyTextValue(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (key === "error") {
        return formatPrettyErrorValue(value);
    }
    if (Array.isArray(value)) {
        return formatPrettyTextValue(value.join(","));
    }
    if (value instanceof Error) {
        return formatPrettyTextValue(value.message);
    }
    if (typeof value === "object") {
        return formatPrettyObjectValue(value);
    }
    return formatPrettyTextValue(String(value));
}

function formatPrettyObjectValue(value: object): string {
    try {
        return formatPrettyTextValue(JSON.stringify(value));
    } catch {
        return formatPrettyTextValue(String(value));
    }
}

function formatPrettyErrorValue(value: unknown): string {
    if (value instanceof Error) {
        return formatPrettyTextValue(value.message);
    }
    if (typeof value === "object" && value !== null) {
        const error = value as Record<string, unknown>;
        const type = typeof error.type === "string" ? error.type : null;
        const name = typeof error.name === "string" ? error.name : null;
        const code = typeof error.code === "string" || typeof error.code === "number" ? String(error.code) : null;
        const message = typeof error.message === "string" ? error.message : null;
        const parts = [type ?? name, code ? `code:${code}` : null, message].filter((item): item is string =>
            Boolean(item)
        );
        if (parts.length > 0) {
            return formatPrettyTextValue(parts.join(":"));
        }
    }
    return formatPrettyTextValue(String(value));
}

function formatPrettyTextValue(value: string): string {
    const trimmed = value.trim();
    const raw = trimmed.length > 0 ? value : "";
    const truncated = truncatePrettyValue(raw);
    if (truncated.length === 0) {
        return '""';
    }
    if (/[=\s]/.test(truncated)) {
        return JSON.stringify(truncated);
    }
    return truncated;
}

function truncatePrettyValue(value: string): string {
    const MAX_LENGTH = 180;
    if (value.length <= MAX_LENGTH) {
        return value;
    }
    return `${value.slice(0, MAX_LENGTH)}...`;
}

function normalizeModuleName(value: string): string {
    const trimmed = value.trim();
    const base = trimmed.length > 0 ? trimmed : "unknown";
    if (base.length === MODULE_WIDTH) {
        return base;
    }
    if (base.length > MODULE_WIDTH) {
        return base.slice(0, MODULE_WIDTH);
    }
    return base.padEnd(MODULE_WIDTH, " ");
}

function formatLogTime(value: unknown): string {
    let date: Date;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === "number" || typeof value === "string") {
        date = new Date(value);
    } else {
        date = new Date();
    }
    if (Number.isNaN(date.getTime())) {
        date = new Date();
    }
    return `${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
}

function padTime(value: number): string {
    return String(value).padStart(2, "0");
}

function resolveDestination(destination: LogDestination): DestinationStream | undefined {
    if (destination === "stdout") {
        return undefined;
    }

    if (destination === "stderr") {
        return pino.destination(2);
    }

    return pino.destination({ dest: destination, mkdir: true, sync: false });
}

function resolvePrettyFactory(): ((options: Record<string, unknown>) => DestinationStream) | null {
    try {
        return nodeRequire("pino-pretty");
    } catch {
        return null;
    }
}

function parseFormat(value?: string | null): LogFormat | null {
    if (!value) {
        return null;
    }
    const normalized = value.toLowerCase().trim();
    if (VALID_FORMATS.has(normalized as LogFormat)) {
        return normalized as LogFormat;
    }
    return null;
}

function parseBooleanFlag(value?: string | null): boolean | null {
    if (!value) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
        return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
        return false;
    }
    return null;
}

function envValue(key: string): string | null {
    const value = process.env[key];
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function mergeRedactList(base: string[], extra: string | null): string[] {
    if (!extra) {
        return [...base];
    }

    const additions = extra
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    return [...new Set([...base, ...additions])];
}

function isStdDestination(destination: LogDestination): boolean {
    return destination === "stdout" || destination === "stderr";
}

function isUnitTestRun(): boolean {
    return process.env.VITEST === "true" || process.env.VITEST === "1";
}
