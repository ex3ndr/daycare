import path from "node:path";

type FindFormattedEntries = {
    text: string;
    count: number;
    truncated: boolean;
};

/**
 * Formats `fd` output as newline-delimited relative paths with byte-bounded truncation.
 * Expects: stdout is one path per line from `fd --color=never`.
 */
export function findEntriesFormat(stdout: string, workingDir: string, maxBytes = 64 * 1024): FindFormattedEntries {
    const entries = stdout
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => findPathDisplay(workingDir, entry));

    if (entries.length === 0) {
        return {
            text: "No files found.",
            count: 0,
            truncated: false
        };
    }

    const truncated = entriesTruncate(entries, maxBytes);
    return {
        text: truncated.text,
        count: entries.length,
        truncated: truncated.truncated
    };
}

function findPathDisplay(workingDir: string, entry: string): string {
    const resolved = path.isAbsolute(entry) ? path.resolve(entry) : path.resolve(workingDir, entry);
    const relative = path.relative(workingDir, resolved);
    if (!relative || relative === ".") {
        return ".";
    }
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        return relative;
    }
    return entry;
}

function entriesTruncate(entries: string[], maxBytes: number): { text: string; truncated: boolean } {
    const selected: string[] = [];
    let bytes = 0;

    for (const entry of entries) {
        const separatorBytes = selected.length === 0 ? 0 : 1;
        const lineBytes = Buffer.byteLength(entry, "utf8") + separatorBytes;
        if (bytes + lineBytes > maxBytes) {
            break;
        }
        selected.push(entry);
        bytes += lineBytes;
    }

    if (selected.length === entries.length) {
        return { text: selected.join("\n"), truncated: false };
    }

    if (selected.length === 0) {
        const first = entries[0] ?? "";
        return {
            text: `${utf8Truncate(first, maxBytes)}\n\n[Output truncated to ${maxBytes} bytes.]`,
            truncated: true
        };
    }

    const omitted = entries.length - selected.length;
    return {
        text: `${selected.join("\n")}\n\n[Output truncated to ${maxBytes} bytes; ${omitted} entry(s) omitted.]`,
        truncated: true
    };
}

function utf8Truncate(value: string, maxBytes: number): string {
    return Buffer.from(value, "utf8").subarray(0, Math.max(0, maxBytes)).toString("utf8");
}
