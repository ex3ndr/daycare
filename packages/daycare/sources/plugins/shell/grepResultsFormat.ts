import path from "node:path";

type GrepFormattedResults = {
    text: string;
    count: number;
    truncated: boolean;
};

const NO_MATCHES_TEXT = "No matches found.";

/**
 * Formats ripgrep JSON output into `file:line:content` lines with byte-bounded output.
 * Expects: stdout is newline-delimited JSON from `rg --json`.
 */
export function grepResultsFormat(stdout: string, workingDir: string, maxBytes = 64 * 1024): GrepFormattedResults {
    const rows = stdout.split("\n");
    const formatted: string[] = [];
    let matchCount = 0;

    for (const row of rows) {
        if (!row.trim()) {
            continue;
        }
        const event = grepEventParse(row);
        if (!event) {
            continue;
        }
        if (event.type === "match") {
            matchCount += 1;
        }
        const filePath = grepPathDisplay(workingDir, event.path);
        const lineText = event.lineText.replace(/\r?\n$/, "");
        formatted.push(`${filePath}:${event.lineNumber}:${lineText}`);
    }

    if (formatted.length === 0) {
        return {
            text: NO_MATCHES_TEXT,
            count: 0,
            truncated: false
        };
    }

    const truncated = grepLinesTruncate(formatted, maxBytes);
    return {
        text: truncated.text,
        count: matchCount,
        truncated: truncated.truncated
    };
}

function grepEventParse(
    row: string
): { type: "match" | "context"; path: string; lineNumber: number; lineText: string } | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(row);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return null;
    }

    const type = recordStringGet(parsed, "type");
    if (type !== "match" && type !== "context") {
        return null;
    }

    const data = recordObjectGet(parsed, "data");
    const pathRecord = data ? recordObjectGet(data, "path") : null;
    const linesRecord = data ? recordObjectGet(data, "lines") : null;
    const filePath = pathRecord ? recordStringGet(pathRecord, "text") : null;
    const lineText = linesRecord ? recordStringGet(linesRecord, "text") : null;
    const lineNumber = data ? recordNumberGet(data, "line_number") : null;
    if (!filePath || !lineText || lineNumber === null) {
        return null;
    }

    return {
        type,
        path: filePath,
        lineNumber,
        lineText
    };
}

function recordObjectGet(value: unknown, key: string): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const next = (value as Record<string, unknown>)[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
        return null;
    }
    return next as Record<string, unknown>;
}

function recordStringGet(value: unknown, key: string): string | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const next = (value as Record<string, unknown>)[key];
    return typeof next === "string" ? next : null;
}

function recordNumberGet(value: unknown, key: string): number | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }
    const next = (value as Record<string, unknown>)[key];
    return typeof next === "number" && Number.isFinite(next) ? next : null;
}

function grepPathDisplay(workingDir: string, filePath: string): string {
    const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(workingDir, filePath);
    const relative = path.relative(workingDir, resolved);
    if (!relative || relative === ".") {
        return ".";
    }
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        return relative;
    }
    return filePath;
}

function grepLinesTruncate(lines: string[], maxBytes: number): { text: string; truncated: boolean } {
    const selected: string[] = [];
    let bytes = 0;

    for (const line of lines) {
        const separatorBytes = selected.length === 0 ? 0 : 1;
        const lineBytes = Buffer.byteLength(line, "utf8") + separatorBytes;
        if (bytes + lineBytes > maxBytes) {
            break;
        }
        selected.push(line);
        bytes += lineBytes;
    }

    if (selected.length === lines.length) {
        return { text: selected.join("\n"), truncated: false };
    }

    if (selected.length === 0) {
        const first = lines[0] ?? "";
        return {
            text: `${utf8Truncate(first, maxBytes)}\n\n[Output truncated to ${maxBytes} bytes.]`,
            truncated: true
        };
    }

    const omitted = lines.length - selected.length;
    return {
        text: `${selected.join("\n")}\n\n[Output truncated to ${maxBytes} bytes; ${omitted} line(s) omitted.]`,
        truncated: true
    };
}

function utf8Truncate(value: string, maxBytes: number): string {
    return Buffer.from(value, "utf8").subarray(0, Math.max(0, maxBytes)).toString("utf8");
}
